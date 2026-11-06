// GET /api/visits/{id}?token= — T-U-09 / P-U-08 추억 상세 (사진 서명 링크, 순례 메모)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, route, serviceOf, uuidOrNull } from '@/lib/server/http';
import { requireOwnVisit, requireToken, tokenCodeFrom } from '@/lib/server/token';
import { signPhotos } from '@/lib/server/storage';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => {
  const { id } = await params;
  const vid = uuidOrNull(id);
  if (!vid) throw new HttpError(404, 'VISIT_NOT_FOUND');
  const service = serviceOf(req);
  const token = await requireToken(req, tokenCodeFrom(req), service);
  const visit = await requireOwnVisit(token.id, vid);
  const sb = supabaseAdmin();
  const [cp, site, photos, note, settings] = await Promise.all([
    sb.from('checkpoints').select('id, name, summary, photo_paths').eq('id', visit.checkpoint_id).single().then((r) => must(r)),
    sb.from('sites').select('id, name').eq('id', visit.site_id).single().then((r) => must(r)),
    sb.from('photos').select('id, storage_path, width, height').eq('visit_id', vid).order('created_at').then((r) => must(r)),
    service === 'pilgrim'
      ? sb.from('notes').select('body, updated_at').eq('visit_id', vid).maybeSingle().then((r) => must(r))
      : Promise.resolve(null),
    getSettings(),
  ]);
  const urls = await signPhotos(photos.map((p) => p.storage_path));
  return json({
    ok: true,
    visit: { id: visit.id, tagged_at: visit.tagged_at, visit_date: visit.visit_date },
    site,
    checkpoint: cp,
    photos: photos.map((p) => ({ id: p.id, url: urls[p.storage_path] ?? null, width: p.width, height: p.height })),
    note: service === 'pilgrim' ? note : undefined,
    photo_limit: settings.photo_limit_per_visit,
  });
});
