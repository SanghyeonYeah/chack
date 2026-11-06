// 가상 리더 (/dev/reader-sim): NFC 기기 없이 실제와 같은 도장 함수로 태그 (최고 관리자 + ENABLE_DEV_TOOLS=true)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { normalizeKeyringCode } from '@/lib/keyring-code';

export const dynamic = 'force-dynamic';

function devOn() {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') throw new HttpError(404, 'NOT_FOUND');
}

export const GET = route(async () => {
  devOn();
  await requireAdmin({ superOnly: true });
  const sb = supabaseAdmin();
  const readers = must(await sb.from('readers').select('id, name, is_active, checkpoints(name, sites(name, service))').not('checkpoint_id', 'is', null).order('name'));
  const tokens = must(await sb.from('tokens').select('code, service, status').neq('status', 'lost').order('created_at').limit(40));
  return json({ ok: true, readers, tokens });
});

export const POST = route(async (req) => {
  devOn();
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  const rid = uuidOrNull(b.reader_id);
  if (!rid) throw new HttpError(400, 'READER_REQUIRED');
  const at = b.tagged_at && !Number.isNaN(Date.parse(b.tagged_at)) ? new Date(b.tagged_at).toISOString() : new Date().toISOString();
  const code = normalizeKeyringCode(b.code) || null;
  const sb = supabaseAdmin();
  const r = must(await sb.rpc('record_stamp_by_reader', { p_reader_id: rid, p_code: code, p_chip_uid: null, p_tagged_at: at }));
  await sb.from('stamp_logs').insert({ reader_id: rid, code, tagged_at: at, result: r.result, error: 'sim' });
  return json({ ok: true, result: r });
});
