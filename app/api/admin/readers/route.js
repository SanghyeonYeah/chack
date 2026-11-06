// T-A-05 / P-A-06 리더 관리 — 목록 · 추가(6자리 등록 코드 24시간 발급)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireCheckpointAccess, scopeOrg } from '@/lib/server/auth';
import { listReaders } from '@/lib/server/admin-data';
import { text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const org = scopeOrg(a, uuidOrNull(new URL(req.url).searchParams.get('org')));
  return json({ ok: true, readers: await listReaders(a.service, org) });
});

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  const name = text(b.name, 100);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED');
  const cid = uuidOrNull(b.checkpoint_id);
  let orgId = a.orgId;
  if (cid) {
    const cp = await requireCheckpointAccess(a, cid);
    const site = must(await supabaseAdmin().from('sites').select('organization_id').eq('id', cp.site_id).single());
    orgId = site.organization_id;
  }
  if (!orgId) throw new HttpError(400, 'CHECKPOINT_REQUIRED');
  const sb = supabaseAdmin();
  const r = must(await sb.from('readers').insert({ name, organization_id: orgId, checkpoint_id: cid }).select('id').single());
  const code = must(await sb.rpc('issue_reader_code', { p_reader_id: r.id }));
  return json({ ok: true, id: r.id, reg_code: code });
});
