// GET /api/admin/org — 화면 선택지: 지역(시·군), 기관(최고 관리자), 내 관광지·지점
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const a = await requireAdmin();
  const sb = supabaseAdmin();
  let sq = sb.from('sites').select('id, name, organization_id, checkpoints(id, name, sort_order)').eq('service', a.service).order('sort_order').order('name');
  if (a.role !== 'super') sq = sq.eq('organization_id', a.orgId);
  const [regions, orgs, sites] = await Promise.all([
    sb.from('regions').select('id, name, level, parent_id, is_active').order('sort_order').then((r) => must(r)),
    a.role === 'super'
      ? sb.from('organizations').select('id, name, is_active').eq('service', a.service).order('name').then((r) => must(r))
      : Promise.resolve([]),
    sq.then((r) => must(r)),
  ]);
  return json({
    ok: true,
    regions,
    orgs,
    sites: sites.map((s) => ({ ...s, checkpoints: [...s.checkpoints].sort((x, y) => x.sort_order - y.sort_order) })),
  });
});
