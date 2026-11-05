-- 착(CHAK) 0003: 권한(RLS) · 저장소
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'super' and is_active)
$$;
create or replace function public.my_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.admins where user_id = auth.uid() and role = 'org' and is_active
$$;

do $$
declare t text;
begin
  foreach t in array array['regions','organizations','admins','sites','checkpoints','readers','tokens',
    'visits','completions','photos','notes','point_ledger','token_badges','token_views',
    'priests','verses','settings'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 누구나 읽기 (공개 정보만)
create policy regions_read     on public.regions     for select using (true);
create policy settings_read    on public.settings    for select using (true);
create policy verses_read      on public.verses      for select using (is_visible);
create policy sites_read       on public.sites       for select using (is_public);
create policy checkpoints_read on public.checkpoints for select using (
  is_public and exists (select 1 from public.sites s where s.id = site_id and s.is_public));
create policy priests_read     on public.priests     for select using (is_visible and consent_checked);

-- 최고 관리자 전용
create policy regions_super  on public.regions  for all to authenticated using (public.is_super()) with check (public.is_super());
create policy settings_super on public.settings for all to authenticated using (public.is_super()) with check (public.is_super());
create policy verses_super   on public.verses   for all to authenticated using (public.is_super()) with check (public.is_super()); -- B8
create policy orgs_super     on public.organizations for all to authenticated using (public.is_super()) with check (public.is_super());
create policy admins_super   on public.admins   for all to authenticated using (public.is_super()) with check (public.is_super());

-- 기관 관리자: 자기 기관 범위
create policy orgs_own_read   on public.organizations for select to authenticated using (id = public.my_org_id());
create policy orgs_own_update on public.organizations for update to authenticated
  using (id = public.my_org_id()) with check (id = public.my_org_id());
create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

create policy sites_admin on public.sites for all to authenticated
  using (public.is_super() or organization_id = public.my_org_id())
  with check (public.is_super() or organization_id = public.my_org_id());

create policy checkpoints_admin on public.checkpoints for all to authenticated
  using (public.is_super() or exists (select 1 from public.sites s where s.id = site_id and s.organization_id = public.my_org_id()))
  with check (public.is_super() or exists (select 1 from public.sites s where s.id = site_id and s.organization_id = public.my_org_id()));

create policy readers_admin on public.readers for all to authenticated
  using (public.is_super() or organization_id = public.my_org_id())
  with check (public.is_super() or organization_id = public.my_org_id());

create policy priests_admin on public.priests for all to authenticated
  using (public.is_super() or exists (select 1 from public.sites s where s.id = site_id and s.organization_id = public.my_org_id()))
  with check (public.is_super() or exists (select 1 from public.sites s where s.id = site_id and s.organization_id = public.my_org_id()));

-- 키링: 배정된 기관만 보기, 상태만 변경 (T-A-06)
create policy tokens_admin_read on public.tokens for select to authenticated
  using (public.is_super() or organization_id = public.my_org_id());
create policy tokens_admin_status on public.tokens for update to authenticated
  using (public.is_super() or organization_id = public.my_org_id())
  with check (public.is_super() or organization_id = public.my_org_id());
revoke insert, update, delete on public.tokens from anon, authenticated;
grant update (status) on public.tokens to authenticated;

-- 방문·완주: 우리 기관 관광지에서 찍힌 것만 (B4)
create policy visits_admin_read on public.visits for select to authenticated
  using (public.is_super() or exists (select 1 from public.sites s where s.id = site_id and s.organization_id = public.my_org_id()));
create policy completions_admin_read on public.completions for select to authenticated
  using (public.is_super() or exists (select 1 from public.sites s where s.id = site_id and s.organization_id = public.my_org_id()));
revoke insert, update, delete on public.visits, public.completions from anon, authenticated;

-- 사진·메모·포인트·뱃지·열람 기록: 정책 없음 = 서버(secret key)만 접근
-- (순례자 사진·메모는 최고 관리자도 열람 불가 — 기획서 10장)
revoke all on public.photos, public.notes, public.point_ledger, public.token_badges, public.token_views
  from anon, authenticated;
revoke all on private.code_lookup_guard from anon, authenticated;

-- 저장소: photos(비공개, 서버만) / media(공개, 관광지·지점 사진·도장·뱃지 이미지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
       ('media',  'media',  true,  10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
