-- 착(CHAK) 0002: 서버 함수 (실행 권한은 서버 secret key만)

-- 키링 코드: 31자(0·O·1·I·L 제외) 중 8자리
create or replace function public.generate_token_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea; v int; i int; code text := '';
begin
  while length(code) < 8 loop
    b := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v := get_byte(b, i);
      if v < 248 and length(code) < 8 then        -- 248 = 31*8, 편향 제거
        code := code || substr(alphabet, (v % 31) + 1, 1);
      end if;
    end loop;
  end loop;
  return code;
end $$;

-- 키링 발급 (S-03)
create or replace function public.issue_tokens(
  p_service text, p_count int, p_organization_id uuid default null, p_batch_label text default null
) returns setof public.tokens
language plpgsql security definer set search_path = public, extensions as $$
declare n int := 0; t public.tokens;
begin
  if p_count < 1 or p_count > 5000 then raise exception 'COUNT_OUT_OF_RANGE'; end if;
  while n < p_count loop
    begin
      insert into public.tokens (service, code, organization_id, batch_label)
      values (p_service, public.generate_token_code(), p_organization_id, p_batch_label)
      returning * into t;
      n := n + 1;
      return next t;
    exception when unique_violation then
      null; -- 코드가 겹치면 다시 생성
    end;
  end loop;
end $$;

-- 리더 등록 코드 발급 (6자리, 24시간, T-A-05)
create or replace function public.issue_reader_code(p_reader_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text; b bytea;
begin
  update public.readers set reg_code = null, reg_code_expires_at = null
   where reg_code_expires_at < now();
  loop
    b := extensions.gen_random_bytes(3);
    v_code := lpad(((get_byte(b,0) * 65536 + get_byte(b,1) * 256 + get_byte(b,2)) % 1000000)::text, 6, '0');
    begin
      update public.readers
         set reg_code = v_code, reg_code_expires_at = now() + interval '24 hours'
       where id = p_reader_id;
      if not found then raise exception 'READER_NOT_FOUND'; end if;
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
end $$;

create or replace function public.reader_info(p_reader_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'reader_id', r.id, 'reader_name', r.name, 'is_active', r.is_active, 'pin_hash', r.pin_hash,
    'checkpoint_name', c.name, 'site_name', s.name, 'service', s.service)
  from public.readers r
  left join public.checkpoints c on c.id = r.checkpoint_id
  left join public.sites s on s.id = c.site_id
  where r.id = p_reader_id
$$;

-- 리더 등록: 코드 확인 → 새 리더 토큰(해시) 저장
create or replace function public.register_reader(
  p_code text, p_token text, p_user_agent text, p_expected_service text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.readers; v_service text;
begin
  select * into r from public.readers
   where reg_code = p_code and reg_code_expires_at > now() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'CODE_INVALID'); end if;
  if not r.is_active then return jsonb_build_object('ok', false, 'error', 'READER_INACTIVE'); end if;
  if r.checkpoint_id is null then return jsonb_build_object('ok', false, 'error', 'NO_CHECKPOINT'); end if;

  select s.service into v_service
    from public.checkpoints c join public.sites s on s.id = c.site_id
   where c.id = r.checkpoint_id;
  if p_expected_service is not null and v_service <> p_expected_service then
    return jsonb_build_object('ok', false, 'error', 'WRONG_HOST', 'service', v_service);
  end if;

  update public.readers
     set token_hash = public.sha256_hex(p_token), reg_code = null, reg_code_expires_at = null,
         registered_at = now(), last_seen_at = now(), user_agent = p_user_agent
   where id = r.id;
  return public.reader_info(r.id) || jsonb_build_object('ok', true);
end $$;

-- 리더 신호 (1분마다)
create or replace function public.reader_heartbeat(p_token text, p_pending int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.readers;
begin
  select * into r from public.readers where token_hash = public.sha256_hex(p_token);
  if not found then return jsonb_build_object('ok', false, 'error', 'READER_INVALID'); end if;
  update public.readers set last_seen_at = now(), pending_count = greatest(coalesce(p_pending, 0), 0)
   where id = r.id;
  if not r.is_active or r.checkpoint_id is null then
    return jsonb_build_object('ok', false, 'error', 'READER_INACTIVE');
  end if;
  return public.reader_info(r.id) || jsonb_build_object('ok', true);
end $$;

-- 지역 전부 완주 여부 (B2: 공개 + 공개 지점 1개 이상인 곳만 분모)
create or replace function public.region_all_completed(
  p_token uuid, p_service text, p_region uuid, p_level text
) returns boolean
language sql stable set search_path = public as $$
  with eligible as (
    select s.id from public.sites s
     where s.service = p_service and s.is_public
       and exists (select 1 from public.checkpoints c where c.site_id = s.id and c.is_public)
       and ((p_level = 'sigungu' and s.region_id = p_region)
         or (p_level = 'sido' and s.region_id in (select r.id from public.regions r where r.parent_id = p_region)))
  )
  select exists (select 1 from eligible)
     and not exists (
       select 1 from eligible e
        where not exists (select 1 from public.completions x where x.token_id = p_token and x.site_id = e.id))
$$;

-- ★ 도장 기록 (11.1 순서, 한 트랜잭션)
create or replace function public.record_stamp(
  p_reader_token text, p_code text, p_chip_uid text, p_tagged_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_reader public.readers;
  v_cp public.checkpoints;
  v_site public.sites;
  v_token public.tokens;
  v_sigungu public.regions;
  v_sido_name text;
  v_tagged timestamptz;
  v_date date;
  v_visit_id uuid;
  v_seen_before boolean;
  v_total int;
  v_done int;
  v_completed_before boolean;
  v_completion_id uuid;
  v_points_on boolean;
  v_base int;
  v_site_points int;
  v_bonus_points int;
  v_badge_id uuid;
  v_bonuses jsonb := '[]'::jsonb;
  v_result text;
begin
  -- 1. 리더 확인
  select * into v_reader from public.readers where token_hash = public.sha256_hex(p_reader_token);
  if not found then return jsonb_build_object('result', 'READER_INVALID'); end if;
  if not v_reader.is_active or v_reader.checkpoint_id is null then
    return jsonb_build_object('result', 'READER_INACTIVE');
  end if;
  update public.readers set last_seen_at = now() where id = v_reader.id;
  select * into v_cp from public.checkpoints where id = v_reader.checkpoint_id;
  select * into v_site from public.sites where id = v_cp.site_id;

  -- 2. 키링 확인 (코드 → 실패 시 칩 UID)
  if p_code is not null then
    select * into v_token from public.tokens where code = upper(p_code) for update;
  end if;
  if v_token.id is null and p_chip_uid is not null then
    select * into v_token from public.tokens where chip_uid = upper(p_chip_uid) for update;
  end if;
  if v_token.id is null then return jsonb_build_object('result', 'UNKNOWN_TOKEN'); end if;
  if v_token.service <> v_site.service then return jsonb_build_object('result', 'WRONG_SERVICE'); end if;
  if v_token.status = 'lost' then return jsonb_build_object('result', 'LOST_TOKEN'); end if;

  -- 칩 UID 기억 [추정]
  if p_chip_uid is not null and v_token.chip_uid is null then
    update public.tokens set chip_uid = upper(p_chip_uid)
     where id = v_token.id
       and not exists (select 1 from public.tokens t where t.chip_uid = upper(p_chip_uid));
  end if;

  -- 태그 시각: 기기 시각 사용, 5분 넘게 미래면 서버 시각 (C3)
  if p_tagged_at is null or p_tagged_at > now() + interval '5 minutes' then
    v_tagged := now();
  else
    v_tagged := p_tagged_at;
  end if;
  v_date := (v_tagged at time zone 'Asia/Seoul')::date;

  -- 3. stock → issued, 첫 사용일
  update public.tokens
     set status = case when status = 'stock' then 'issued' else status end,
         first_used_at = least(coalesce(first_used_at, v_tagged), v_tagged)
   where id = v_token.id;

  -- 4. 방문 기록 (같은 날 같은 지점은 1번만)
  select exists (select 1 from public.visits where token_id = v_token.id and checkpoint_id = v_cp.id)
    into v_seen_before;
  insert into public.visits (token_id, checkpoint_id, site_id, reader_id, visit_date, tagged_at)
  values (v_token.id, v_cp.id, v_site.id, v_reader.id, v_date, v_tagged)
  on conflict (token_id, checkpoint_id, visit_date) do nothing
  returning id into v_visit_id;

  select count(*) into v_total from public.checkpoints where site_id = v_site.id and is_public;
  select count(distinct v.checkpoint_id) into v_done
    from public.visits v join public.checkpoints c on c.id = v.checkpoint_id
   where v.token_id = v_token.id and c.site_id = v_site.id and c.is_public;
  select exists (select 1 from public.completions where token_id = v_token.id and site_id = v_site.id)
    into v_completed_before;

  if v_visit_id is null then
    return jsonb_build_object('result', 'ALREADY_TODAY', 'checkpoint_name', v_cp.name,
      'site_name', v_site.name, 'service', v_site.service,
      'done', v_done, 'total', v_total, 'completed', v_completed_before);
  end if;

  -- 5. 완주 판정 (처음일 때만)
  if not v_completed_before and v_total > 0 and v_done >= v_total then
    insert into public.completions (token_id, site_id, completed_at)
    values (v_token.id, v_site.id, v_tagged)
    on conflict (token_id, site_id) do nothing
    returning id into v_completion_id;
  end if;

  -- 6. 포인트 · 보너스 · 뱃지 (B1, B2)
  if v_completion_id is not null then
    v_points_on := v_site.service = 'tour' or public.setting_bool('pilgrim_points_enabled', false);
    v_base := public.setting_int('base_points', 100);
    v_site_points := coalesce(v_site.base_points, v_base);

    if v_points_on then
      insert into public.point_ledger (token_id, kind, points, ref_id)
      values (v_token.id, 'site_complete', v_site_points, v_site.id)
      on conflict do nothing;
    end if;

    -- b. 시·군
    select * into v_sigungu from public.regions where id = v_site.region_id;
    if public.region_all_completed(v_token.id, v_site.service, v_sigungu.id, 'sigungu') then
      insert into public.token_badges (token_id, region_id, earned_at)
      values (v_token.id, v_sigungu.id, v_tagged)
      on conflict (token_id, region_id) do nothing
      returning id into v_badge_id;
      if v_badge_id is not null then
        v_bonus_points := null;
        if v_points_on then
          v_bonus_points := v_base * public.setting_int('sigungu_multiplier', 5);
          insert into public.point_ledger (token_id, kind, points, ref_id)
          values (v_token.id, 'sigungu_bonus', v_bonus_points, v_sigungu.id)
          on conflict do nothing;
        end if;
        v_bonuses := v_bonuses || jsonb_build_object('kind', 'sigungu',
          'region_name', v_sigungu.name, 'points', v_bonus_points);
      end if;
    end if;

    -- c. 도
    v_badge_id := null;
    if v_sigungu.parent_id is not null
       and public.region_all_completed(v_token.id, v_site.service, v_sigungu.parent_id, 'sido') then
      insert into public.token_badges (token_id, region_id, earned_at)
      values (v_token.id, v_sigungu.parent_id, v_tagged)
      on conflict (token_id, region_id) do nothing
      returning id into v_badge_id;
      if v_badge_id is not null then
        select name into v_sido_name from public.regions where id = v_sigungu.parent_id;
        v_bonus_points := null;
        if v_points_on then
          v_bonus_points := v_base * public.setting_int('sido_multiplier', 10);
          insert into public.point_ledger (token_id, kind, points, ref_id)
          values (v_token.id, 'sido_bonus', v_bonus_points, v_sigungu.parent_id)
          on conflict do nothing;
        end if;
        v_bonuses := v_bonuses || jsonb_build_object('kind', 'sido',
          'region_name', v_sido_name, 'points', v_bonus_points);
      end if;
    end if;
  end if;

  -- 7. 결과 (REVISIT: 다른 날 같은 지점 재방문, B3②·D5)
  if v_completion_id is not null then v_result := 'COMPLETED';
  elsif v_seen_before then v_result := 'REVISIT';
  else v_result := 'STAMPED';
  end if;

  return jsonb_build_object(
    'result', v_result, 'checkpoint_name', v_cp.name, 'site_name', v_site.name,
    'service', v_site.service, 'done', v_done, 'total', v_total,
    'completed', v_completed_before or v_completion_id is not null,
    'points', case when v_completion_id is not null and v_points_on then v_site_points end,
    'bonuses', v_bonuses, 'visit_date', v_date);
end $$;

-- 분실 처리 + 기록 이전 (B5, 한 트랜잭션). p_actor_org: 기관 관리자면 기관 id, 최고 관리자면 null
create or replace function public.transfer_token(p_old_code text, p_new_code text, p_actor_org uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.tokens; n public.tokens;
begin
  select * into o from public.tokens where code = upper(p_old_code) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'OLD_NOT_FOUND'); end if;
  select * into n from public.tokens where code = upper(p_new_code) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NEW_NOT_FOUND'); end if;
  if o.id = n.id then return jsonb_build_object('ok', false, 'error', 'SAME_TOKEN'); end if;
  if p_actor_org is not null
     and (o.organization_id is distinct from p_actor_org or n.organization_id is distinct from p_actor_org) then
    return jsonb_build_object('ok', false, 'error', 'NOT_YOUR_TOKEN');
  end if;
  if o.status = 'lost' then return jsonb_build_object('ok', false, 'error', 'OLD_ALREADY_LOST'); end if;
  if o.service <> n.service then return jsonb_build_object('ok', false, 'error', 'SERVICE_MISMATCH'); end if;
  if n.status <> 'stock'
     or exists (select 1 from public.visits where token_id = n.id)
     or exists (select 1 from public.completions where token_id = n.id)
     or exists (select 1 from public.photos where token_id = n.id)
     or exists (select 1 from public.notes where token_id = n.id)
     or exists (select 1 from public.point_ledger where token_id = n.id)
     or exists (select 1 from public.token_badges where token_id = n.id) then
    return jsonb_build_object('ok', false, 'error', 'NEW_HAS_RECORDS'); -- "기록이 없는 새 키링만 선택할 수 있어요"
  end if;

  update public.visits       set token_id = n.id where token_id = o.id;
  update public.completions  set token_id = n.id where token_id = o.id;
  update public.photos       set token_id = n.id where token_id = o.id;
  update public.notes        set token_id = n.id where token_id = o.id;
  update public.point_ledger set token_id = n.id where token_id = o.id;
  update public.token_badges set token_id = n.id where token_id = o.id;
  -- token_views는 옮기지 않음 (옛 키링 기록으로 유지)

  update public.tokens set status = 'lost', replaced_by_token_id = n.id where id = o.id;
  update public.tokens set status = 'issued', first_used_at = o.first_used_at where id = n.id;
  return jsonb_build_object('ok', true, 'old_code', o.code, 'new_code', n.code);
end $$;

-- 틀린 코드 차단 (D4): 10회 5분 / 20회 10분 / 30회 30분 / 50회 이상 24시간
create or replace function public.code_lookup_blocked(p_ip_hash text) returns timestamptz
language plpgsql security definer set search_path = public, private as $$
declare v_until timestamptz;
begin
  delete from private.code_lookup_guard
   where last_fail_at < now() - interval '24 hours' and (blocked_until is null or blocked_until < now());
  select blocked_until into v_until from private.code_lookup_guard
   where ip_hash = p_ip_hash and blocked_until > now();
  return v_until;
end $$;

create or replace function public.code_lookup_failed(p_ip_hash text) returns timestamptz
language plpgsql security definer set search_path = public, private as $$
declare g private.code_lookup_guard;
begin
  insert into private.code_lookup_guard (ip_hash) values (p_ip_hash) on conflict (ip_hash) do nothing;
  select * into g from private.code_lookup_guard where ip_hash = p_ip_hash for update;
  if g.last_fail_at < now() - interval '24 hours' then g.fail_count := 0; end if;  -- 24시간 무사고면 초기화
  g.fail_count := g.fail_count + 1;
  g.blocked_until := case
    when g.fail_count >= 50 then now() + interval '24 hours'
    when g.fail_count = 30 then now() + interval '30 minutes'
    when g.fail_count = 20 then now() + interval '10 minutes'
    when g.fail_count = 10 then now() + interval '5 minutes'
    else g.blocked_until end;
  update private.code_lookup_guard
     set fail_count = g.fail_count, last_fail_at = now(), blocked_until = g.blocked_until
   where ip_hash = p_ip_hash;
  return g.blocked_until;
end $$;

-- 실행 권한: 서버(secret key)만
do $$
declare f text;
begin
  foreach f in array array[
    'public.sha256_hex(text)',
    'public.generate_token_code()',
    'public.issue_tokens(text,integer,uuid,text)',
    'public.issue_reader_code(uuid)',
    'public.reader_info(uuid)',
    'public.register_reader(text,text,text,text)',
    'public.reader_heartbeat(text,integer)',
    'public.region_all_completed(uuid,text,uuid,text)',
    'public.record_stamp(text,text,text,timestamp with time zone)',
    'public.transfer_token(text,text,uuid)',
    'public.code_lookup_blocked(text)',
    'public.code_lookup_failed(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
