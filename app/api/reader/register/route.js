import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { explicitHostService } from '@/lib/service';
import { ipKey, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const preferredRegion = 'icn1';
export const dynamic = 'force-dynamic';

/** 리더 등록: 6자리 등록 코드 → 리더 토큰 발급 (T-A-05에서 발급한 코드, 24시간 유효) */
export async function POST(req) {
  const sb = supabaseAdmin();
  const key = ipKey(req, 'reader-register');

  const blocked = await sb.rpc('code_lookup_blocked', { p_ip_hash: key });
  if (blocked.data) return json({ ok: false, error: 'BLOCKED', until: blocked.data }, 429);

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return json({ ok: false, error: 'CODE_INVALID' }, 400);

  const readerToken = randomBytes(32).toString('base64url');
  const { data, error } = await sb.rpc('register_reader', {
    p_code: code,
    p_token: readerToken,
    p_user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    p_expected_service: explicitHostService(req.headers.get('host')),
  });
  if (error) {
    console.error('[register_reader]', error);
    return json({ ok: false, error: 'SERVER_ERROR' }, 500);
  }
  if (!data?.ok) {
    if (data?.error === 'CODE_INVALID') await sb.rpc('code_lookup_failed', { p_ip_hash: key });
    return json(data, 400);
  }
  return json({ ...data, reader_token: readerToken });
}
