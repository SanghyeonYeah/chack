// P-A-08 성경 구절 수정 · 삭제 (최고 관리자만)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { verseSpec } from '../spec';

export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }) => {
  await requireAdmin({ superOnly: true });
  const vid = uuidOrNull((await params).id);
  if (!vid) throw new HttpError(404, 'NOT_FOUND');
  must(await supabaseAdmin().from('verses').update(pick(await readJson(req), verseSpec)).eq('id', vid));
  return json({ ok: true });
});

export const DELETE = route(async (req, { params }) => {
  await requireAdmin({ superOnly: true });
  const vid = uuidOrNull((await params).id);
  if (!vid) throw new HttpError(404, 'NOT_FOUND');
  must(await supabaseAdmin().from('verses').delete().eq('id', vid));
  return json({ ok: true });
});
