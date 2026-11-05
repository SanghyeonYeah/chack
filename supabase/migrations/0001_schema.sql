-- 착(CHAK) 0001: 기본 테이블 17개 (기획서 11장)
-- 모든 테이블에 id(PK), created_at, updated_at. service = 'tour' / 'pilgrim'
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 공용 도우미 ----------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.sha256_hex(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p, 'sha256'), 'hex')
$$;

-- 1. 지역: 도(sido) > 시·군(sigungu)  (S-02)
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('sido', 'sigungu')),
  parent_id uuid references public.regions(id),
  is_active boolean not null default true,
  badge_image_path text,                 -- 없으면 기본 뱃지 이미지 + 지역 이름
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check ((level = 'sido' and parent_id is null) or (level = 'sigungu' and parent_id is not null))
);

-- 2. 기관 (S-01)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('tour', 'pilgrim')),
  name text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. 관리자 (Supabase Auth 계정과 연결)
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('super', 'org')),
  organization_id uuid references public.organizations(id),
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'super' and organization_id is null) or (role = 'org' and organization_id is not null))
);

-- 4. 관광지 / 성지
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('tour', 'pilgrim')),
  organization_id uuid not null references public.organizations(id),
  region_id uuid not null references public.regions(id),          -- 시·군
  name text not null,
  aliases text[] not null default '{}',                            -- 검색용 별칭
  address text,
  lat double precision,
  lng double precision,
  intro text,
  photo_paths text[] not null default '{}',
  opening_hours text,
  closed_days text,
  admission_fee text,
  parking text,
  phone text,
  stamp_image_path text,
  base_points int check (base_points is null or base_points >= 0), -- 비우면 settings.base_points (B1)
  sort_order int not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index sites_region_idx on public.sites(region_id);

create or replace function public.sites_guard() returns trigger language plpgsql as $$
begin
  if (select level from public.regions where id = new.region_id) <> 'sigungu' then
    raise exception 'SITE_REGION_MUST_BE_SIGUNGU';
  end if;
  if (select service from public.organizations where id = new.organization_id) <> new.service then
    raise exception 'SITE_SERVICE_MISMATCH';
  end if;
  return new;
end $$;
create trigger sites_guard before insert or update on public.sites
  for each row execute function public.sites_guard();

-- 5. 지점
create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  name text not null,
  sort_order int not null default 0,
  description text,
  summary text,
  photo_paths text[] not null default '{}',
  lat double precision,
  lng double precision,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index checkpoints_site_idx on public.checkpoints(site_id);

-- 6. 현장 리더 (T-A-05 / P-A-06)
create table public.readers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  name text not null,
  token_hash text unique,              -- 리더 토큰은 해시로만 저장
  reg_code text,                       -- 6자리 등록 코드 (24시간)
  reg_code_expires_at timestamptz,
  pin_hash text,                       -- sha256(리더id || ':' || PIN)
  is_active boolean not null default true,
  registered_at timestamptz,
  last_seen_at timestamptz,
  pending_count int not null default 0,
  user_agent text,
  created_at timestamptz not null default now()
);
create unique index readers_reg_code_uq on public.readers(reg_code) where reg_code is not null;

-- 7. 키링
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('tour', 'pilgrim')),
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$'),
  chip_uid text unique,
  status text not null default 'stock' check (status in ('stock', 'issued', 'lost')),
  organization_id uuid references public.organizations(id),
  first_used_at timestamptz,
  replaced_by_token_id uuid references public.tokens(id),
  batch_label text,
  created_at timestamptz not null default now()
);
create index tokens_org_idx on public.tokens(organization_id);

-- 8. 방문(도장)
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  checkpoint_id uuid not null references public.checkpoints(id),
  site_id uuid not null references public.sites(id),
  reader_id uuid references public.readers(id) on delete set null,
  visit_date date not null,            -- tagged_at의 한국 날짜
  tagged_at timestamptz not null,      -- 실제 태그 시각 (오프라인 포함)
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token_id, checkpoint_id, visit_date)
);
create index visits_token_idx on public.visits(token_id, tagged_at);
create index visits_site_date_idx on public.visits(site_id, visit_date);

-- 9. 완주
create table public.completions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  site_id uuid not null references public.sites(id),
  completed_at timestamptz not null,
  seen_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  unique (token_id, site_id)
);

-- 10. 사진 (방문 1건에 붙음, 비공개 저장소)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  visit_id uuid not null references public.visits(id) on delete cascade,
  storage_path text not null unique,
  width int,
  height int,
  bytes int,
  created_at timestamptz not null default now()
);
create index photos_visit_idx on public.photos(visit_id);

-- 11. 메모 (방문 1건에 1개)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

-- 12. 포인트 내역 (5.2: 잔액은 합계로 계산)
create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  kind text not null check (kind in ('site_complete', 'sigungu_bonus', 'sido_bonus', 'exchange', 'adjust')),
  points int not null,
  ref_id uuid,                         -- site_complete: 관광지 id / 보너스: 지역 id
  memo text,
  created_at timestamptz not null default now(),
  unique (token_id, kind, ref_id)      -- 사유 + 대상 중복 지급 방지
);

-- 13. 뱃지 (시·군, 도)
create table public.token_badges (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  region_id uuid not null references public.regions(id),
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token_id, region_id)
);

-- 14. 열람 기록 (재태그 지표)
create table public.token_views (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id),
  via text not null check (via in ('nfc', 'manual', 'menu')),
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index token_views_token_idx on public.token_views(token_id, opened_at);

-- 15. 신부님 (P-A-07)
create table public.priests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  name text not null,
  baptismal_name text,
  role_title text,
  photo_url text,
  greeting text check (greeting is null or char_length(greeting) <= 200),
  consent_checked boolean not null default false,
  consent_note text,
  is_visible boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (not is_visible or consent_checked)   -- 동의 없이 표시 불가
);

-- 16. 성경 구절 (P-A-08)
create table public.verses (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  source text,
  is_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 17. 설정 (S-05)
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.setting_int(p_key text, p_default int) returns int
language sql stable set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.settings where key = p_key), p_default)
$$;
create or replace function public.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.settings where key = p_key), p_default)
$$;

-- 모든 테이블: updated_at 칸 + 자동 갱신
do $$
declare t text;
begin
  foreach t in array array['regions','organizations','admins','sites','checkpoints','readers','tokens',
    'visits','completions','photos','notes','point_ledger','token_badges','token_views',
    'priests','verses','settings'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated', t);
  end loop;
end $$;

-- 사진 3장 제한 (settings.photo_limit_per_visit, 13장)
create or replace function public.photos_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_token uuid; v_count int;
begin
  select token_id into v_token from public.visits where id = new.visit_id for update;
  if v_token is null or v_token <> new.token_id then
    raise exception 'PHOTO_VISIT_MISMATCH';
  end if;
  select count(*) into v_count from public.photos where visit_id = new.visit_id;
  if v_count >= public.setting_int('photo_limit_per_visit', 3) then
    raise exception 'PHOTO_LIMIT';
  end if;
  return new;
end $$;
create trigger photos_guard before insert on public.photos
  for each row execute function public.photos_guard();

-- 내부: 틀린 코드 차단 카운터 (D4, IP는 해시)
create table private.code_lookup_guard (
  ip_hash text primary key,
  fail_count int not null default 0,
  last_fail_at timestamptz not null default now(),
  blocked_until timestamptz
);
