// GET /api/tokens/{code}/records — T-U-07 / P-U-06: 관광지별 → 날짜별 방문, 미확인 완주
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route, serviceOf } from '@/lib/server/http';
import { requireToken } from '@/lib/server/token';
import { getSettings, pointsOn } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => {
  const { code } = await params;
  const service = serviceOf(req);
  const token = await requireToken(req, code, service);
  const [data, settings] = await Promise.all([
    supabaseAdmin().rpc('token_records', { p_token: token.id }).then((r) => must(r, 'records')),
    getSettings(),
  ]);
  const showPoints = pointsOn(service, settings);
  return json({
    ok: true,
    code: token.code,
    ...data,
    points: showPoints ? data.points : null,
    photo_limit: settings.photo_limit_per_visit,
  });
});
