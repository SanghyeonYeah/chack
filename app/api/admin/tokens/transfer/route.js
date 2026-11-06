// POST /api/admin/tokens/transfer {old_code, new_code} — 분실 처리 + 기록 이전 (B5, 한 트랜잭션: DB 함수)
// GET  /api/admin/tokens/transfer?code= — 새 키링 후보 확인 (stock + 기록 없음)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { normalizeKeyringCode, isKeyringCodeFormat } from '@/lib/keyring-code';

export const dynamic = 'force-dynamic';

const ERRORS = {
  OLD_NOT_FOUND: 404, NEW_NOT_FOUND: 404, SAME_TOKEN: 400, NOT_YOUR_TOKEN: 403,
  OLD_ALREADY_LOST: 409, SERVICE_MISMATCH: 400, NEW_HAS_RECORDS: 409,
};

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const code = normalizeKeyringCode(new URL(req.url).searchParams.get('code'));
  if (!isKeyringCodeFormat(code)) throw new HttpError(400, 'BAD_CODE');
  const sb = supabaseAdmin();
  const t = must(await sb.from('tokens').select('id, code, status, service, organization_id').eq('code', code).maybeSingle());
  if (!t || t.service !== a.service || (a.role !== 'super' && t.organization_id !== a.orgId)) throw new HttpError(404, 'NEW_NOT_FOUND');
  const tables = ['visits', 'completions', 'photos', 'notes', 'point_ledger', 'token_badges'];
  const counts = await Promise.all(tables.map((tb) => sb.from(tb).select('id', { count: 'exact', head: true }).eq('token_id', t.id)));
  const hasRecords = counts.some((c) => (c.count ?? 0) > 0);
  return json({ ok: true, code: t.code, status: t.status, eligible: t.status === 'stock' && !hasRecords });
});

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  const oldCode = normalizeKeyringCode(b.old_code);
  const newCode = normalizeKeyringCode(b.new_code);
  if (!isKeyringCodeFormat(oldCode) || !isKeyringCodeFormat(newCode)) throw new HttpError(400, 'BAD_CODE');
  const sb = supabaseAdmin();
  const old = must(await sb.from('tokens').select('service').eq('code', oldCode).maybeSingle());
  if (!old || old.service !== a.service) throw new HttpError(404, 'OLD_NOT_FOUND');
  const r = must(await sb.rpc('transfer_token', { p_old_code: oldCode, p_new_code: newCode, p_actor_org: a.role === 'super' ? null : a.orgId }));
  if (!r.ok) throw new HttpError(ERRORS[r.error] ?? 400, r.error);
  return json(r);
});
