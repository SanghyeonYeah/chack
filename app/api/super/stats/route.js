// S-04 전체 통계: 두 웹 전체 + 기관별 (참여 키링, 도장, 완주, 재태그)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { periodOf } from '@/lib/server/admin-data';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const { from, to } = periodOf(new URL(req.url).searchParams);
  const sb = supabaseAdmin();
  const out = {};
  for (const service of ['tour', 'pilgrim']) {
    const [stats, dash, orgs] = await Promise.all([
      sb.rpc('admin_stats', { p_service: service, p_org: null, p_from: from, p_to: to }).then((r) => must(r)),
      sb.rpc('admin_dashboard', { p_service: service, p_org: null }).then((r) => must(r)),
      sb.rpc('super_org_summary', { p_service: service }).then((r) => must(r)),
    ]);
    out[service] = { period: stats, total: dash, orgs };
  }
  return json({ ok: true, from, to, ...out });
});
