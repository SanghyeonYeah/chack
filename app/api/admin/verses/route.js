// P-A-08 성경 구절 관리 — 최고 관리자만 수정 (B8). 기관 관리자는 읽기만
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { verseSpec } from './spec';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const a = await requireAdmin();
  if (a.service !== 'pilgrim') throw new HttpError(404, 'NOT_FOUND');
  const rows = must(await supabaseAdmin().from('verses').select('*').order('sort_order').order('created_at'));
  return json({ ok: true, verses: rows, can_edit: a.role === 'super' });
});

export const POST = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const row = pick(await readJson(req), verseSpec);
  if (!row.text) throw new HttpError(400, 'TEXT_REQUIRED');
  const d = must(await supabaseAdmin().from('verses').insert(row).select('id').single());
  return json({ ok: true, id: d.id });
});
