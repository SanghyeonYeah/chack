// 테스트용: PGlite(메모리 Postgres)에 Supabase 흉내 + migrations 0001~0005 적용
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const STUB = `
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`;

export async function freshDb({ seed = false } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(STUB);
  const dir = path.resolve(import.meta.dirname, '../supabase/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (!seed && f.includes('seed')) continue;
    try {
      await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }
  return db;
}

export async function one(db, sql, params = []) {
  const r = await db.query(sql, params);
  return r.rows[0];
}
