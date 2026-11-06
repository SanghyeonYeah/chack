-- 착(CHAK) 0006: 사용자 화면 조회 함수 (실행 권한은 서버 secret key만)
-- "보이는 관광지" = 공개 + 공개 지점 1개 이상 (B2, 11장). 완료율 분모도 같은 기준

create or replace function public.eligible_sites(p_service text)
returns setof public.sites
language sql stable security definer set search_path = public as $$
  select s.* from public.sites s
   where s.service = p_service and s.is_public
     and exists (select 1 from public.checkpoints c where c.site_id = s.id and c.is_public)
$$;

-- T-U-03 / P-U-02, T-U-12 완료율: 지역 + 보이는 관광지 수 + 내가 완주한 수
create or replace function public.user_regions(p_service text, p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with es as (select id, region_id from public.eligible_sites(p_service)),
  done as (select site_id from public.completions where token_id = p_token),
  per_sigungu as (
    select r.id, count(es.id) as total, count(d.site_id) as done
      from public.regions r
      left join es on es.region_id = r.id
      left join done d on d.site_id = es.id
     where r.level = 'sigungu' group by r.id
  ),
  per_sido as (
    select p.id, coalesce(sum(ps.total), 0) as total, coalesce(sum(ps.done), 0) as done
      from public.regions p
      left join public.regions c on c.parent_id = p.id
      left join per_sigungu ps on ps.id = c.id
     where p.level = 'sido' group by p.id
  ),
  counts as (select * from per_sigungu union all select * from per_sido)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'level', r.level, 'parent_id', r.parent_id,
      'is_active', r.is_active, 'badge_image_path', r.badge_image_path,
      'total', c.total, 'done', c.done) order by r.level, r.sort_order, r.name), '[]'::jsonb)
    from public.regions r join counts c on c.id = r.id
$$;

-- T-U-04 / P-U-03 관광지 목록 (검색은 화면에서 이름·별칭으로 거름)
create or replace function public.user_sites(p_service text, p_region uuid, p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'aliases', s.aliases, 'photo', s.photo_paths[1],
      'lat', s.lat, 'lng', s.lng, 'diocese', s.diocese, 'region_id', s.region_id,
      'total', (select count(*) from public.checkpoints c where c.site_id = s.id and c.is_public),
      'done', (select count(distinct v.checkpoint_id) from public.visits v
                 join public.checkpoints c on c.id = v.checkpoint_id
                where v.token_id = p_token and c.site_id = s.id and c.is_public),
      'completed_at', (select x.completed_at from public.completions x where x.token_id = p_token and x.site_id = s.id)
    ) order by s.sort_order, s.name), '[]'::jsonb)
    from public.eligible_sites(p_service) s
   where p_region is null or s.region_id = p_region
$$;

-- T-U-05 / P-U-04 관광지 상세 + 지점 + 내 도장 + 신부님(표시 켜진 분만)
create or replace function public.user_site(p_site uuid, p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'site', to_jsonb(s) - 'organization_id' - 'created_at' - 'updated_at',
    'region', (select jsonb_build_object('id', r.id, 'name', r.name, 'sido', p.name)
                 from public.regions r left join public.regions p on p.id = r.parent_id where r.id = s.region_id),
    'checkpoints', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', c.name, 'sort_order', c.sort_order, 'summary', c.summary,
          'description', c.description, 'photo_paths', c.photo_paths, 'lat', c.lat, 'lng', c.lng,
          'stamped_at', (select min(v.tagged_at) from public.visits v where v.token_id = p_token and v.checkpoint_id = c.id),
          'visits', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'tagged_at', v.tagged_at) order by v.tagged_at)
                                from public.visits v where v.token_id = p_token and v.checkpoint_id = c.id), '[]'::jsonb)
        ) order by c.sort_order, c.name)
        from public.checkpoints c where c.site_id = s.id and c.is_public), '[]'::jsonb),
    'priests', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'baptismal_name', pr.baptismal_name,
          'role_title', pr.role_title, 'photo_url', pr.photo_url, 'greeting', pr.greeting) order by pr.sort_order, pr.name)
        from public.priests pr where pr.site_id = s.id and pr.is_visible and pr.consent_checked), '[]'::jsonb),
    'completed_at', (select x.completed_at from public.completions x where x.token_id = p_token and x.site_id = s.id)
  )
  from public.eligible_sites((select service from public.sites where id = p_site)) s
  where s.id = p_site
$$;

-- T-U-07 / P-U-06 내 기록: 관광지별(최근 방문순) → 날짜별(B3①) → 지점 도장(시간순)
create or replace function public.token_records(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with v as (
    select v.id, v.site_id, v.checkpoint_id, v.visit_date, v.tagged_at, c.name as cp_name, c.sort_order as cp_order,
           (select count(*) from public.photos p where p.visit_id = v.id) as photo_count,
           exists (select 1 from public.notes n where n.visit_id = v.id) as has_note
      from public.visits v join public.checkpoints c on c.id = v.checkpoint_id
     where v.token_id = p_token
  ),
  site_ids as (
    select site_id from v union select site_id from public.completions where token_id = p_token
  ),
  per_site as (
    select s.id, s.name, s.stamp_image_path,
           (select count(*) from public.checkpoints c where c.site_id = s.id and c.is_public) as total,
           (select count(distinct vv.checkpoint_id) from v vv
              join public.checkpoints c on c.id = vv.checkpoint_id and c.is_public where vv.site_id = s.id) as done,
           (select x.completed_at from public.completions x where x.token_id = p_token and x.site_id = s.id) as completed_at,
           coalesce((select max(vv.tagged_at) from v vv where vv.site_id = s.id),
                    (select x.completed_at from public.completions x where x.token_id = p_token and x.site_id = s.id)) as last_at,
           coalesce((
             select jsonb_agg(jsonb_build_object('date', d.visit_date, 'visits', d.items) order by d.visit_date)
               from (select vv.visit_date,
                            jsonb_agg(jsonb_build_object('id', vv.id, 'checkpoint_id', vv.checkpoint_id, 'name', vv.cp_name,
                              'order', vv.cp_order, 'tagged_at', vv.tagged_at, 'photo_count', vv.photo_count,
                              'has_note', vv.has_note) order by vv.tagged_at) as items
                       from v vv where vv.site_id = s.id group by vv.visit_date) d), '[]'::jsonb) as dates
      from public.sites s where s.id in (select site_id from site_ids)
  )
  select jsonb_build_object(
    'today', (now() at time zone 'Asia/Seoul')::date,
    'sites', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'stamp_image_path', stamp_image_path, 'total', total, 'done', done,
        'completed_at', completed_at, 'last_at', last_at, 'dates', dates) order by last_at desc) from per_site), '[]'::jsonb),
    'completed_count', (select count(*) from public.completions where token_id = p_token),
    'points', (select coalesce(sum(points), 0) from public.point_ledger where token_id = p_token),
    'unseen', coalesce((select jsonb_agg(id order by completed_at, created_at)
                          from public.completions where token_id = p_token and not seen_by_user), '[]'::jsonb),
    'last_visit_id', (select id from v order by tagged_at desc limit 1)
  )
$$;

-- T-U-10 / P-U-09 완주 화면: 그 완주로 생긴 보너스·뱃지만 (C4)
create or replace function public.completion_detail(p_token uuid, p_completion uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', x.id, 'site_id', s.id, 'site_name', s.name, 'stamp_image_path', s.stamp_image_path,
    'completed_at', x.completed_at, 'seen', x.seen_by_user,
    'points', (select l.points from public.point_ledger l where l.token_id = p_token and l.kind = 'site_complete' and l.ref_id = s.id),
    'bonuses', coalesce((
      select jsonb_agg(jsonb_build_object('level', r.level, 'region_name', r.name, 'badge_image_path', r.badge_image_path,
          'points', (select l.points from public.point_ledger l where l.token_id = p_token
                      and l.kind = (r.level || '_bonus') and l.ref_id = r.id)) order by r.level desc)
        from public.token_badges b join public.regions r on r.id = b.region_id
       where b.token_id = p_token and b.earned_at = x.completed_at
         and (r.id = s.region_id or r.id = (select parent_id from public.regions where id = s.region_id))), '[]'::jsonb)
  )
  from public.completions x join public.sites s on s.id = x.site_id
  where x.id = p_completion and x.token_id = p_token
$$;

-- T-U-11 주변 관광지: 미완주 공개 관광지, 같은 시·군 우선 → 같은 도, 직선거리 순 최대 5곳
create or replace function public.nearby_sites(p_site uuid, p_token uuid, p_limit int default 5)
returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select s.*, r.parent_id as sido_id from public.sites s join public.regions r on r.id = s.region_id where s.id = p_site
  ),
  cand as (
    select e.*, (e.region_id = b.region_id) as same_sigungu,
           case when e.lat is null or b.lat is null then null else
             2 * 6371 * asin(sqrt(power(sin(radians(e.lat - b.lat) / 2), 2)
               + cos(radians(b.lat)) * cos(radians(e.lat)) * power(sin(radians(e.lng - b.lng) / 2), 2))) end as km
      from base b
      join public.eligible_sites(b.service) e on e.id <> b.id
      join public.regions r on r.id = e.region_id
     where r.parent_id = b.sido_id
       and not exists (select 1 from public.completions x where x.token_id = p_token and x.site_id = e.id)
  ),
  picked as (select * from cand order by same_sigungu desc, km nulls last, sort_order limit p_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'photo', p.photo_paths[1], 'diocese', p.diocese, 'km', round(p.km::numeric, 1),
      'total', (select count(*) from public.checkpoints c where c.site_id = p.id and c.is_public),
      'done', (select count(distinct v.checkpoint_id) from public.visits v join public.checkpoints c on c.id = v.checkpoint_id
                where v.token_id = p_token and c.site_id = p.id and c.is_public)
    ) order by p.same_sigungu desc, p.km nulls last, p.sort_order), '[]'::jsonb)
    from picked p
$$;

-- T-U-12 포인트 내역 + 뱃지
create or replace function public.token_summary(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', (select coalesce(sum(points), 0) from public.point_ledger where token_id = p_token),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object('kind', l.kind, 'points', l.points, 'created_at', l.created_at,
          'label', coalesce((select s.name from public.sites s where s.id = l.ref_id),
                            (select r.name from public.regions r where r.id = l.ref_id), l.memo)) order by l.created_at desc)
        from public.point_ledger l where l.token_id = p_token), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('region_id', b.region_id, 'earned_at', b.earned_at))
        from public.token_badges b where b.token_id = p_token), '[]'::jsonb)
  )
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.eligible_sites(text)',
    'public.user_regions(text,uuid)',
    'public.user_sites(text,uuid,uuid)',
    'public.user_site(uuid,uuid)',
    'public.token_records(uuid)',
    'public.completion_detail(uuid,uuid)',
    'public.nearby_sites(uuid,uuid,integer)',
    'public.token_summary(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
