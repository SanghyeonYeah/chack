// T-A-03 / P-A-03 관광지 상세 · 수정 · 삭제(기록 없을 때만, 있으면 비공개 처리 안내)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireSiteAccess } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { siteSpec } from '../spec';

export const dynamic = 'force-dynamic';

async function ctx(params) {
  const a = await requireAdmin();
  const { id } = await params;
  const sid = uuidOrNull(id);
  if (!sid) throw new HttpError(404, 'NOT_FOUND');
  await requireSiteAccess(a, sid);
  return { a, sid };
}

export const GET = route(async (req, { params }) => {
  const { sid } = await ctx(params);
  const site = must(await supabaseAdmin().from('sites').select('*').eq('id', sid).single());
  return json({ ok: true, site });
});

export const PUT = route(async (req, { params }) => {
  const { a, sid } = await ctx(params);
  const b = await readJson(req);
  const patch = pick(b, siteSpec(a.service));
  if ('name' in patch && !patch.name) throw new HttpError(400, 'NAME_REQUIRED');
  if ('region_id' in b) patch.region_id = uuidOrNull(b.region_id);
  if (a.role === 'super' && 'organization_id' in b) patch.organization_id = uuidOrNull(b.organization_id);
  const { error } = await supabaseAdmin().from('sites').update(patch).eq('id', sid);
  if (error) {
    if (/SITE_\w+/.test(error.message)) throw new HttpError(400, error.message.match(/SITE_\w+/)[0]);
    throw error;
  }
  return json({ ok: true });
});

export const DELETE = route(async (req, { params }) => {
  const { sid } = await ctx(params);
  const sb = supabaseAdmin();
  const [{ count: v }, { count: c }] = await Promise.all([
    sb.from('visits').select('id', { count: 'exact', head: true }).eq('site_id', sid),
    sb.from('completions').select('id', { count: 'exact', head: true }).eq('site_id', sid),
  ]);
  if ((v ?? 0) + (c ?? 0) > 0) throw new HttpError(409, 'HAS_RECORDS');
  const cps = must(await sb.from('checkpoints').select('id').eq('site_id', sid)).map((x) => x.id);
  if (cps.length) {
    must(await sb.from('readers').update({ checkpoint_id: null }).in('checkpoint_id', cps));
    must(await sb.from('checkpoints').delete().in('id', cps));
  }
  must(await sb.from('priests').delete().eq('site_id', sid));
  must(await sb.from('sites').delete().eq('id', sid));
  return json({ ok: true });
});
