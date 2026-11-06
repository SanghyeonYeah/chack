// T-A-05 리더 수정: 이름 · 연결 지점 · 비활성 · PIN · 등록 코드 재발급 · 삭제
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireCheckpointAccess, requireReaderAccess } from '@/lib/server/auth';
import { text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

async function ctx(params) {
  const a = await requireAdmin();
  const { id } = await params;
  const rid = uuidOrNull(id);
  if (!rid) throw new HttpError(404, 'NOT_FOUND');
  const reader = await requireReaderAccess(a, rid);
  return { a, rid, reader };
}

export const PUT = route(async (req, { params }) => {
  const { a, rid, reader } = await ctx(params);
  const b = await readJson(req);
  const sb = supabaseAdmin();
  const patch = {};
  if ('name' in b) {
    patch.name = text(b.name, 100);
    if (!patch.name) throw new HttpError(400, 'NAME_REQUIRED');
  }
  if ('is_active' in b) patch.is_active = b.is_active === true;
  if ('checkpoint_id' in b) {
    const cid = uuidOrNull(b.checkpoint_id);
    if (cid) {
      const cp = await requireCheckpointAccess(a, cid);
      const site = must(await sb.from('sites').select('organization_id').eq('id', cp.site_id).single());
      if (site.organization_id !== reader.organization_id) throw new HttpError(400, 'OTHER_ORG_CHECKPOINT');
    }
    patch.checkpoint_id = cid;
  }
  if ('pin' in b) {
    if (b.pin === null || b.pin === '') patch.pin_hash = null;
    else if (/^\d{4}$/.test(String(b.pin))) {
      patch.pin_hash = must(await sb.rpc('sha256_hex', { p: `${rid}:${b.pin}` }));
    } else throw new HttpError(400, 'PIN_FORMAT');
  }
  if (Object.keys(patch).length) must(await sb.from('readers').update(patch).eq('id', rid));
  let reg_code;
  if (b.issue_code) reg_code = must(await sb.rpc('issue_reader_code', { p_reader_id: rid }));
  return json({ ok: true, reg_code });
});

export const DELETE = route(async (req, { params }) => {
  const { rid } = await ctx(params);
  must(await supabaseAdmin().from('readers').delete().eq('id', rid));
  return json({ ok: true });
});
