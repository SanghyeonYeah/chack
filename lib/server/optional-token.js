import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeKeyringCode, isKeyringCodeFormat } from '@/lib/keyring-code';
import { tokenCodeFrom } from '@/lib/server/token';

/**
 * 목록·상세 화면에서 "내 상태"를 붙일 때 쓰는 키링 (틀려도 오류 없이 null).
 * 이미 localStorage에 저장된 코드를 보내는 경우라 차단 카운터는 올리지 않는다.
 */
export async function optionalToken(req, service) {
  const code = normalizeKeyringCode(tokenCodeFrom(req));
  if (!isKeyringCodeFormat(code)) return null;
  const { data } = await supabaseAdmin()
    .from('tokens')
    .select('id, code, service, status')
    .eq('code', code)
    .maybeSingle();
  if (!data || data.service !== service || data.status === 'lost') return null;
  return data;
}
