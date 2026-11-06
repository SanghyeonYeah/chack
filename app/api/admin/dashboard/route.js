// GET /api/admin/dashboard?org= — T-A-02 / P-A-02 대시보드 (우리 기관 관광지에서 찍힌 도장 기준, B4)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, scopeOrg } from '@/lib/server/auth';
import { listReaders } from '@/lib/server/admin-data';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const org = scopeOrg(a, uuidOrNull(new URL(req.url).searchParams.get('org')));
  const [numbers, readers] = await Promise.all([
    supabaseAdmin().rpc('admin_dashboard', { p_service: a.service, p_org: org }).then((r) => must(r, 'dashboard')),
    listReaders(a.service, org),
  ]);
  const rate = numbers.total_keyrings > 0 ? Math.floor((numbers.completed_keyrings / numbers.total_keyrings) * 100) : 0;
  return json({
    ok: true,
    ...numbers,
    completion_rate: rate,
    readers: {
      total: readers.length,
      ok: readers.filter((r) => r.state === 'ok').length,
      down: readers.filter((r) => r.state === 'down'),
      unregistered: readers.filter((r) => r.state === 'unregistered').length,
    },
  });
});
