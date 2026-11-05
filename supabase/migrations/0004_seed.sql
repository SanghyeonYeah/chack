-- 착(CHAK) 0004: 임시 시연 데이터 (주소·좌표·소개는 모두 [임시], 관리자 화면에서 교체)
insert into public.settings (key, value) values
  ('base_points', '100'), ('sigungu_multiplier', '5'), ('sido_multiplier', '10'),
  ('pilgrim_points_enabled', 'false'), ('point_exchange_enabled', 'false'),
  ('photo_limit_per_visit', '3')
on conflict (key) do nothing;

do $$
declare
  v_sido uuid; v_asan uuid; v_cheonan uuid;
  o_hc uuid; o_oe uuid; o_ca uuid; o_pg uuid;
  v_id uuid;
  r record;
begin
  if exists (select 1 from public.regions) then
    raise notice '이미 시드 데이터가 있어 건너뜁니다';
    return;
  end if;

  insert into public.regions (name, level, sort_order) values ('충청남도', 'sido', 1) returning id into v_sido;
  insert into public.regions (name, level, parent_id, sort_order) values ('아산시', 'sigungu', v_sido, 1) returning id into v_asan;
  insert into public.regions (name, level, parent_id, sort_order) values ('천안시', 'sigungu', v_sido, 2) returning id into v_cheonan;

  insert into public.organizations (service, name) values ('tour', '현충사 [임시]') returning id into o_hc;
  insert into public.organizations (service, name) values ('tour', '외암민속마을 [임시]') returning id into o_oe;
  insert into public.organizations (service, name) values ('tour', '천안 임시 관광지 [임시]') returning id into o_ca;
  insert into public.organizations (service, name) values ('pilgrim', '아산 임시 성지 [임시]') returning id into o_pg;

  -- 현충사: 지점 이름은 기획서 와이어프레임 값
  insert into public.sites (service, organization_id, region_id, name, address, lat, lng, intro, sort_order, is_public)
  values ('tour', o_hc, v_asan, '현충사', '충청남도 아산시 [임시 주소]', 36.800, 127.020, '[임시 소개글]', 1, true)
  returning id into v_id;
  insert into public.checkpoints (site_id, name, sort_order, summary, lat, lng, is_public)
  select v_id, t.n, t.i::int, '[임시] 요약 설명', 36.800 + t.i * 0.0004, 127.020, true
    from unnest(array['홍살문','본전','유물전시관','고택','활터']) with ordinality as t(n, i);

  insert into public.sites (service, organization_id, region_id, name, address, lat, lng, intro, sort_order, is_public)
  values ('tour', o_oe, v_asan, '외암민속마을', '충청남도 아산시 [임시 주소]', 36.730, 127.020, '[임시 소개글]', 2, true)
  returning id into v_id;
  insert into public.checkpoints (site_id, name, sort_order, summary, lat, lng, is_public)
  select v_id, '[임시] 지점 ' || i, i, '[임시] 요약 설명', 36.730 + i * 0.0004, 127.020, true
    from generate_series(1, 4) as i;

  insert into public.sites (service, organization_id, region_id, name, address, lat, lng, intro, sort_order, is_public)
  values ('tour', o_ca, v_cheonan, '천안 임시 관광지', '충청남도 천안시 [임시 주소]', 36.810, 127.150, '[임시 소개글]', 3, true)
  returning id into v_id;
  insert into public.checkpoints (site_id, name, sort_order, summary, lat, lng, is_public)
  select v_id, '[임시] 지점 ' || i, i, '[임시] 요약 설명', 36.810 + i * 0.0004, 127.150, true
    from generate_series(1, 3) as i;

  insert into public.sites (service, organization_id, region_id, name, address, lat, lng, intro, sort_order, is_public)
  values ('pilgrim', o_pg, v_asan, '아산 임시 성지', '충청남도 아산시 [임시 주소]', 36.790, 127.000, '[임시 소개글]', 1, true)
  returning id into v_id;
  insert into public.checkpoints (site_id, name, sort_order, summary, lat, lng, is_public)
  select v_id, '[임시] 순례 지점 ' || i, i, '[임시] 요약 설명', 36.790 + i * 0.0004, 127.000, true
    from generate_series(1, 3) as i;

  -- 지점마다 리더 1대 + 등록 코드
  for r in
    select c.id as cp_id, c.name as cp_name, s.name as site_name, s.organization_id as org
      from public.checkpoints c join public.sites s on s.id = c.site_id
  loop
    insert into public.readers (organization_id, checkpoint_id, name)
    values (r.org, r.cp_id, r.site_name || ' · ' || r.cp_name || ' 리더')
    returning id into v_id;
    perform public.issue_reader_code(v_id);
  end loop;

  -- 시험용 키링
  perform public.issue_tokens('tour', 10, o_hc, 'seed');
  perform public.issue_tokens('tour', 5, o_oe, 'seed');
  perform public.issue_tokens('pilgrim', 5, o_pg, 'seed');

  insert into public.verses (text, source, sort_order) values
    ('[임시 구절 1] 관리자 화면에서 교체해 주세요', '[출처]', 1),
    ('[임시 구절 2] 관리자 화면에서 교체해 주세요', '[출처]', 2),
    ('[임시 구절 3] 관리자 화면에서 교체해 주세요', '[출처]', 3);
end $$;
