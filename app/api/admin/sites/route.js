// T-A-03 관광지 관리 / P-A-03 성지 관리 — 목록 · 등록
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, scopeOrg } from '@/lib/server/auth';
import { siteSpec } from './spec';
import { pick } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const org = scopeOrg(a, uuidOrNull(new URL(req.url).searchParams.get('org')));
  let q = supabaseAdmin()
    .from('sites')
    .select('id, name, organization_id, region_id, is_public, sort_order, base_points, photo_paths, organizations(name), regions(name), checkpoints(id, is_public)')
    .eq('service', a.service)
    .order('sort_order')
    .order('name');
  if (org) q = q.eq('organization_id', org);
  const rows = must(await q, 'sites');
  return json({
    ok: true,
    sites: rows.map((s) => ({
      id: s.id, name: s.name, organization_id: s.organization_id, org_name: s.organizations?.name,
      region_id: s.region_id, region_name: s.regions?.name, is_public: s.is_public, sort_order: s.sort_order,
      base_points: s.base_points, photo: s.photo_paths?.[0] ?? null,
      checkpoints: s.checkpoints.length, public_checkpoints: s.checkpoints.filter((c) => c.is_public).length,
    })),
  });
});

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  const row = pick(b, siteSpec(a.service));
  if (!row.name) throw new HttpError(400, 'NAME_REQUIRED');
  const region = uuidOrNull(b.region_id);
  if (!region) throw new HttpError(400, 'REGION_REQUIRED');
  const orgId = a.role === 'super' ? uuidOrNull(b.organization_id) : a.orgId;
  if (!orgId) throw new HttpError(400, 'ORG_REQUIRED');
  const { data, error } = await supabaseAdmin()
    .from('sites')
    .insert({ ...row, region_id: region, organization_id: orgId, service: a.service })
    .select('id')
    .single();
  if (error) {
    if (/SITE_REGION_MUST_BE_SIGUNGU|SITE_SERVICE_MISMATCH/.test(error.message)) throw new HttpError(400, error.message.match(/SITE_\w+/)[0]);
    throw error;
  }
  return json({ ok: true, id: data.id });
});
