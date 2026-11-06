// GET /api/tokens/{code}/summary — T-U-12 / P-U-09 기록: 포인트·지역 완료율·뱃지
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
  const sb = supabaseAdmin();
  const [summary, regions, settings] = await Promise.all([
    sb.rpc('token_summary', { p_token: token.id }).then((r) => must(r, 'summary')),
    sb.rpc('user_regions', { p_service: service, p_token: token.id }).then((r) => must(r, 'regions')),
    getSettings(),
  ]);
  const showPoints = pointsOn(service, settings);
  return json({
    ok: true,
    code: token.code,
    points: showPoints ? { balance: summary.balance, ledger: summary.ledger } : null,
    exchange_enabled: showPoints && settings.point_exchange_enabled === true,
    badges: summary.badges,
    regions,
  });
});
