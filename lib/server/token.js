import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, ipKey, must } from '@/lib/server/http';
import { normalizeKeyringCode, isKeyringCodeFormat } from '@/lib/keyring-code';
import { originFor } from '@/lib/service';

/**
 * 키링 코드 확인 (사용자 웹 공통)
 * - 틀린 코드: IP별 10회 5분 / 20회 10분 / 30회 30분 / 50회 이상 24시간 (C2). 코드 조회만 차단
 * - 다른 웹 키링: 그 웹의 /k/코드 주소를 돌려줌 (13장)
 */
export async function requireToken(req, rawCode, service) {
  const sb = supabaseAdmin();
  const key = ipKey(req, 'code');
  const blocked = must(await sb.rpc('code_lookup_blocked', { p_ip_hash: key }), 'blocked');
  if (blocked) throw new HttpError(429, 'BLOCKED', { until: blocked });

  const code = normalizeKeyringCode(rawCode);
  let token = null;
  if (isKeyringCodeFormat(code)) {
    token = must(
      await sb
        .from('tokens')
        .select('id, code, service, status, replaced_by_token_id, first_used_at')
        .eq('code', code)
        .maybeSingle(),
      'token',
    );
  }
  if (!token) {
    const until = must(await sb.rpc('code_lookup_failed', { p_ip_hash: key }), 'failed');
    if (until && new Date(until) > new Date()) throw new HttpError(429, 'BLOCKED', { until });
    throw new HttpError(404, 'UNKNOWN_TOKEN');
  }
  if (token.service !== service) {
    const origin = originFor(token.service);
    throw new HttpError(409, 'OTHER_SERVICE', { redirect: origin ? `${origin}/k/${token.code}` : null });
  }
  if (token.status === 'lost') throw new HttpError(410, 'LOST_TOKEN');
  return token;
}

/** 이 키링의 방문(visit)인지 확인 */
export async function requireOwnVisit(tokenId, visitId) {
  const v = must(
    await supabaseAdmin()
      .from('visits')
      .select('id, token_id, site_id, checkpoint_id, tagged_at, visit_date')
      .eq('id', visitId)
      .maybeSingle(),
    'visit',
  );
  if (!v || v.token_id !== tokenId) throw new HttpError(404, 'VISIT_NOT_FOUND');
  return v;
}

/** 요청에서 키링 코드 꺼내기: 헤더 x-chak-token → 쿼리 token */
export function tokenCodeFrom(req) {
  return req.headers.get('x-chak-token') || new URL(req.url).searchParams.get('token') || '';
}
