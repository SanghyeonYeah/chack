// T-A-04 / P-A-04 지점 수정 · 삭제(도장 기록이 없을 때만)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireCheckpointAccess } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { checkpointSpec } from '../spec';

export const dynamic = 'force-dynamic';

async function ctx(params) {
  const a = await requireAdmin();
  const { id } = await params;
  const cid = uuidOrNull(id);
  if (!cid) throw new HttpError(404, 'NOT_FOUND');
  await requireCheckpointAccess(a, cid);
  return { a, cid };
}

export const PUT = route(async (req, { params }) => {
  const { cid } = await ctx(params);
  const patch = pick(await readJson(req), checkpointSpec);
  if ('name' in patch && !patch.name) throw new HttpError(400, 'NAME_REQUIRED');
  must(await supabaseAdmin().from('checkpoints').update(patch).eq('id', cid));
  return json({ ok: true });
});

export const DELETE = route(async (req, { params }) => {
  const { cid } = await ctx(params);
  const sb = supabaseAdmin();
  const { count } = await sb.from('visits').select('id', { count: 'exact', head: true }).eq('checkpoint_id', cid);
  if ((count ?? 0) > 0) throw new HttpError(409, 'HAS_RECORDS');
  must(await sb.from('readers').update({ checkpoint_id: null }).eq('checkpoint_id', cid));
  must(await sb.from('checkpoints').delete().eq('id', cid));
  return json({ ok: true });
});
