// T-A-04 / P-A-04 지점 관리 — 목록(?site=) · 등록
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireSiteAccess } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { checkpointSpec } from './spec';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const sid = uuidOrNull(new URL(req.url).searchParams.get('site'));
  if (!sid) throw new HttpError(400, 'SITE_REQUIRED');
  await requireSiteAccess(a, sid);
  const sb = supabaseAdmin();
  const rows = must(await sb.from('checkpoints').select('*, readers(id, name, is_active, last_seen_at)').eq('site_id', sid).order('sort_order').order('created_at'));
  return json({ ok: true, checkpoints: rows });
});

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  const sid = uuidOrNull(b.site_id);
  if (!sid) throw new HttpError(400, 'SITE_REQUIRED');
  await requireSiteAccess(a, sid);
  const row = pick(b, checkpointSpec);
  if (!row.name) throw new HttpError(400, 'NAME_REQUIRED');
  const sb = supabaseAdmin();
  if (row.sort_order == null) {
    const { data } = await sb.from('checkpoints').select('sort_order').eq('site_id', sid).order('sort_order', { ascending: false }).limit(1);
    row.sort_order = (data?.[0]?.sort_order ?? 0) + 1;
  }
  const d = must(await sb.from('checkpoints').insert({ ...row, site_id: sid }).select('id').single());
  return json({ ok: true, id: d.id });
});
