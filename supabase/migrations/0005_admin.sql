-- 착(CHAK) 0005: 관리자 통계 · 키링 목록 · 차단 관리 함수 (실행 권한은 서버 secret key만)
-- 통계 범위(B4): "우리 기관 관광지에서 찍힌 도장" 기준. p_org가 null이면 그 웹 전체(최고 관리자)

-- T-A-02 / P-A-02 대시보드 숫자
create or replace function public.admin_dashboard(p_service text, p_org uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with my_sites as (
    select id from public.sites where service = p_service and (p_org is null or organization_id = p_org)
  ),
  v as (select * from public.visits where site_id in (select id from my_sites)),
  c as (select * from public.completions where site_id in (select id from my_sites)),
  today as (select (now() at time zone 'Asia/Seoul')::date as d)
  select jsonb_build_object(
    'today_keyrings',     (select count(distinct token_id) from v where visit_date = (select d from today)),
    'today_stamps',       (select count(*) from v where visit_date = (select d from today)),
    'total_keyrings',     (select count(distinct token_id) from v),
    'total_stamps',       (select count(*) from v),
    'total_completions',  (select count(*) from c),
    'completed_keyrings', (select count(distinct token_id) from c),
    'today',              (select d from today)
  )
$$;

-- T-A-07 / P-A-09 통계 (기간: 한국 날짜 p_from ~ p_to)
-- 단계별 이탈(B6/D6): 대상 = 기간 안에 우리 기관 관광지에서 첫 도장을 받은 키링
--   ① 첫 태그 ② 서로 다른 지점 2곳 이상 ③ 완주 1곳 이상 ④ 사진 1장 이상(순례: 사진 또는 메모, 개수만)
--   ⑤ 재태그: 분모 = 그 키링의 같은 웹 전체 마지막 도장 후 7일이 지난 키링
--            분자 = 마지막 도장 7일 후 이후 token_views(nfc/manual) 1건 이상. menu는 제외
create or replace function public.admin_stats(p_service text, p_org uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
  with my_sites as (
    select id from public.sites where service = p_service and (p_org is null or organization_id = p_org)
  ),
  v  as (select * from public.visits where site_id in (select id from my_sites)),
  vp as (select * from v where visit_date between p_from and p_to),
  days as (select d::date as date from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d),
  daily as (
    select dd.date,
           count(distinct vp.token_id) as keyrings,
           count(vp.id) as stamps
      from days dd left join vp on vp.visit_date = dd.date
     group by dd.date order by dd.date
  ),
  by_cp as (
    select cp.id, cp.name, s.name as site_name, count(vp.id) as cnt
      from public.checkpoints cp
      join public.sites s on s.id = cp.site_id
      left join vp on vp.checkpoint_id = cp.id
     where s.id in (select id from my_sites)
     group by cp.id, cp.name, s.name, s.sort_order, cp.sort_order
     order by s.sort_order, s.name, cp.sort_order
  ),
  hourly as (
    select h, (select count(*) from vp where extract(hour from vp.tagged_at at time zone 'Asia/Seoul') = h) as cnt
      from generate_series(0, 23) h
  ),
  first_at as (select token_id, min(visit_date) as first_date from v group by token_id),
  target as (select token_id from first_at where first_date between p_from and p_to),
  s2 as (
    select token_id from v where token_id in (select token_id from target)
     group by token_id having count(distinct checkpoint_id) >= 2
  ),
  s3 as (
    select distinct token_id from public.completions
     where site_id in (select id from my_sites) and token_id in (select token_id from target)
  ),
  s4 as (
    select distinct x.token_id from (
      select p.token_id from public.photos p join v on v.id = p.visit_id
      union all
      select n.token_id from public.notes n join v on v.id = n.visit_id where p_service = 'pilgrim'
    ) x where x.token_id in (select token_id from target)
  ),
  last_stamp as (
    select vv.token_id, max(vv.tagged_at) as last_at
      from public.visits vv
      join public.tokens t on t.id = vv.token_id and t.service = p_service
     where vv.token_id in (select token_id from target)
     group by vv.token_id
  ),
  eligible7 as (select * from last_stamp where last_at + interval '7 days' <= now()),
  retag as (
    select e.token_id,
           bool_or(tv.via = 'nfc') as by_nfc,
           bool_or(tv.via = 'manual') as by_manual
      from eligible7 e
      join public.token_views tv
        on tv.token_id = e.token_id and tv.via in ('nfc', 'manual')
       and tv.opened_at >= e.last_at + interval '7 days'
     group by e.token_id
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'keyrings', (select count(distinct token_id) from vp),
    'stamps',   (select count(*) from vp),
    'completions', (select count(*) from public.completions c
                     where c.site_id in (select id from my_sites)
                       and (c.completed_at at time zone 'Asia/Seoul')::date between p_from and p_to),
    'daily',  coalesce((select jsonb_agg(jsonb_build_object('date', date, 'keyrings', keyrings, 'stamps', stamps)) from daily), '[]'::jsonb),
    'by_checkpoint', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'site_name', site_name, 'count', cnt)) from by_cp), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour', h, 'count', cnt) order by h) from hourly), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'first_tag',   (select count(*) from target),
      'two_points',  (select count(*) from s2),
      'completed',   (select count(*) from s3),
      'photo',       (select count(*) from s4),
      'retag_base',  (select count(*) from eligible7),
      'retag',       (select count(*) from retag),
      'retag_nfc',   (select count(*) from retag where by_nfc),
      'retag_manual',(select count(*) from retag where by_manual)
    )
  )
$$;

-- T-A-06 / P-A-07 키링 목록. 도장 수는 우리 기관 관광지에서 받은 도장만 (B4)
create or replace function public.org_tokens(
  p_service text, p_org uuid, p_q text, p_status text, p_limit int, p_offset int
) returns table (
  id uuid, code text, status text, first_used_at timestamptz, chip_uid text,
  organization_id uuid, org_name text, batch_label text, replaced_by_code text,
  stamp_count bigint, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select t.* from public.tokens t
     where t.service = p_service
       and (p_org is null or t.organization_id = p_org)
       and (p_status is null or t.status = p_status)
       and (p_q is null or p_q = '' or t.code like '%' || upper(p_q) || '%')
  )
  select b.id, b.code, b.status, b.first_used_at, b.chip_uid, b.organization_id, o.name, b.batch_label, r.code,
         (select count(*) from public.visits v join public.sites s on s.id = v.site_id
           where v.token_id = b.id and (p_org is null or s.organization_id = p_org)),
         count(*) over ()
    from base b
    left join public.organizations o on o.id = b.organization_id
    left join public.tokens r on r.id = b.replaced_by_token_id
   order by b.created_at desc, b.code
   limit p_limit offset p_offset
$$;

-- S-04 기관별 요약
create or replace function public.super_org_summary(p_service text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', o.id, 'name', o.name, 'is_active', o.is_active,
      'sites', (select count(*) from public.sites s where s.organization_id = o.id),
      'tokens', (select count(*) from public.tokens t where t.organization_id = o.id),
      'keyrings', (select count(distinct v.token_id) from public.visits v join public.sites s on s.id = v.site_id where s.organization_id = o.id),
      'stamps', (select count(*) from public.visits v join public.sites s on s.id = v.site_id where s.organization_id = o.id),
      'completions', (select count(*) from public.completions c join public.sites s on s.id = c.site_id where s.organization_id = o.id)
    ) as x
    from public.organizations o where o.service = p_service
  ) q
$$;

-- 틀린 코드 차단 목록 · 해제 (최고 관리자)
create or replace function public.code_lookup_list() returns setof private.code_lookup_guard
language sql stable security definer set search_path = public, private as $$
  select * from private.code_lookup_guard
   where blocked_until > now() or fail_count >= 10
   order by blocked_until desc nulls last
$$;

create or replace function public.code_lookup_clear(p_ip_hash text) returns void
language sql security definer set search_path = public, private as $$
  delete from private.code_lookup_guard where ip_hash = p_ip_hash
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_dashboard(text,uuid)',
    'public.admin_stats(text,uuid,date,date)',
    'public.org_tokens(text,uuid,text,text,integer,integer)',
    'public.super_org_summary(text)',
    'public.code_lookup_list()',
    'public.code_lookup_clear(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
