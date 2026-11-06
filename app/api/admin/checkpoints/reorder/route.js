// POST /api/admin/checkpoints/reorder {site_id, ids:[...]} — 끌어서 순서 변경 (T-A-04)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireSiteAccess } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  const sid = uuidOrNull(b.site_id);
  if (!sid || !Array.isArray(b.ids)) throw new HttpError(400, 'BAD_REQUEST');
  await requireSiteAccess(a, sid);
  const sb = supabaseAdmin();
  const own = new Set(must(await sb.from('checkpoints').select('id').eq('site_id', sid)).map((x) => x.id));
  const ids = b.ids.filter((x) => own.has(x));
  for (let i = 0; i < ids.length; i++) {
    must(await sb.from('checkpoints').update({ sort_order: i + 1 }).eq('id', ids[i]));
  }
  return json({ ok: true });
});
