// GET /api/admin/stats?period=today|7d|30d|custom&from=&to=&org= — T-A-07 / P-A-09 통계
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, scopeOrg } from '@/lib/server/auth';
import { periodOf } from '@/lib/server/admin-data';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const org = scopeOrg(a, uuidOrNull(sp.get('org')));
  const { from, to } = periodOf(sp);
  const stats = must(
    await supabaseAdmin().rpc('admin_stats', { p_service: a.service, p_org: org, p_from: from, p_to: to }),
    'stats',
  );
  return json({ ok: true, service: a.service, ...stats });
});
