// GET /api/sites/{id}/nearby?token= — T-U-11 주변 미완주 관광지 (최대 5곳)
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
  const sb = supabaseAdmin();
  const site = must(await sb.from('sites').select('id, name, service').eq('id', sid).maybeSingle(), 'site');
  if (!site || site.service !== service) throw new HttpError(404, 'NOT_FOUND');
  const sites = must(await sb.rpc('nearby_sites', { p_site: sid, p_token: token?.id ?? null, p_limit: 5 }), 'nearby');
  return json({ ok: true, site_name: site.name, sites });
});
