// P-A-05 신부님 관리 — 목록(?site=) · 등록. 동의 체크 없이는 표시 불가 (DB CHECK + 여기서 한 번 더)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireSiteAccess } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { priestSpec } from './spec';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  if (a.service !== 'pilgrim') throw new HttpError(404, 'NOT_FOUND');
  const sid = uuidOrNull(new URL(req.url).searchParams.get('site'));
  if (!sid) throw new HttpError(400, 'SITE_REQUIRED');
  await requireSiteAccess(a, sid);
  const rows = must(await supabaseAdmin().from('priests').select('*').eq('site_id', sid).order('sort_order').order('created_at'));
  return json({ ok: true, priests: rows });
});

export const POST = route(async (req) => {
  const a = await requireAdmin();
  if (a.service !== 'pilgrim') throw new HttpError(404, 'NOT_FOUND');
  const b = await readJson(req);
  const sid = uuidOrNull(b.site_id);
  if (!sid) throw new HttpError(400, 'SITE_REQUIRED');
  await requireSiteAccess(a, sid);
  const row = pick(b, priestSpec);
  if (!row.name) throw new HttpError(400, 'NAME_REQUIRED');
  if (row.is_visible && !row.consent_checked) throw new HttpError(400, 'CONSENT_REQUIRED');
  const d = must(await supabaseAdmin().from('priests').insert({ ...row, site_id: sid }).select('id').single());
  return json({ ok: true, id: d.id });
});
