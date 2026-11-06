// GET /api/sites/{id} — T-U-05 / P-U-04 상세 + 지점 (+ 표시 켜진 신부님만)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, route, serviceOf, uuidOrNull } from '@/lib/server/http';
import { optionalToken } from '@/lib/server/optional-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => {
  const { id } = await params;
  const sid = uuidOrNull(id);
  if (!sid) throw new HttpError(404, 'NOT_FOUND');
  const service = serviceOf(req);
  const token = await optionalToken(req, service);
  const d = must(await supabaseAdmin().rpc('user_site', { p_site: sid, p_token: token?.id ?? null }), 'site');
  if (!d || d.site.service !== service) throw new HttpError(404, 'NOT_FOUND');
  if (service === 'tour') delete d.priests;
  return json({ ok: true, ...d });
});
