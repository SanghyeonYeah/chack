import { supabaseAdmin } from '@/lib/supabase/admin';
import { bearer, json } from '@/lib/server/http';
import { KEYRING_CODE_RE } from '@/lib/keyring-code';

export const runtime = 'nodejs';
export const preferredRegion = 'icn1'; // 서울: 태그→결과 1.5초 목표
export const dynamic = 'force-dynamic';

const UID_RE = /^[0-9A-F]{8,20}$/;

function parseItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code =
    typeof raw.code === 'string' && KEYRING_CODE_RE.test(raw.code.toUpperCase()) ? raw.code.toUpperCase() : null;
  const uid =
    typeof raw.chip_uid === 'string' && UID_RE.test(raw.chip_uid.toUpperCase()) ? raw.chip_uid.toUpperCase() : null;
  const tagged =
    typeof raw.tagged_at === 'string' && !Number.isNaN(Date.parse(raw.tagged_at))
      ? new Date(raw.tagged_at).toISOString()
      : null;
  if (!code && !uid) return null;
  return { code, chip_uid: uid, tagged_at: tagged };
}

/**
 * POST /api/reader/stamp
 * header: Authorization: Bearer <리더 토큰>
 * body:   { items: [{ code, chip_uid, tagged_at }] }  실시간 1건, 오프라인 재전송 최대 50건
 * 도장 판정은 DB 함수 record_stamp(기획서 11.1 순서)가 한 트랜잭션으로 처리한다.
 */
export async function POST(req) {
  const token = bearer(req);
  if (!token) return json({ ok: false, error: 'READER_INVALID', results: [] }, 401);

  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0 || items.length > 50) return json({ ok: false, error: 'BAD_REQUEST', results: [] }, 400);

  const sb = supabaseAdmin();
  const results = [];
  for (const raw of items) {
    const item = parseItem(raw);
    if (!item) {
      results.push({ result: 'UNREADABLE' });
      continue;
    }
    const { data, error } = await sb.rpc('record_stamp', {
      p_reader_token: token,
      p_code: item.code,
      p_chip_uid: item.chip_uid,
      p_tagged_at: item.tagged_at,
    });
    if (error) {
      console.error('[record_stamp]', error);
      return json({ ok: false, error: 'SERVER_ERROR', results }, 500); // 처리된 건수만큼 results 반환
    }
    if (data.result === 'READER_INVALID' || data.result === 'READER_INACTIVE') {
      return json({ ok: false, error: data.result, results }, 401);
    }
    results.push(data);
  }
  return json({ ok: true, results });
}
