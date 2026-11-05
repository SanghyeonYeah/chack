import { supabaseAdmin } from '@/lib/supabase/admin';
import { bearer, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const preferredRegion = 'icn1';
export const dynamic = 'force-dynamic';

/** 리더 상태 신호(1분마다): 마지막 접속 시각·대기 전송 수 기록, 이름·PIN 변경 반영 */
export async function POST(req) {
  const token = bearer(req);
  if (!token) return json({ ok: false, error: 'READER_INVALID' }, 401);

  const body = await req.json().catch(() => null);
  const pending =
    typeof body?.pending === 'number' && Number.isFinite(body.pending)
      ? Math.max(0, Math.min(10_000, Math.floor(body.pending)))
      : 0;

  const { data, error } = await supabaseAdmin().rpc('reader_heartbeat', { p_token: token, p_pending: pending });
  if (error) {
    console.error('[reader_heartbeat]', error);
    return json({ ok: false, error: 'SERVER_ERROR' }, 500);
  }
  return json(data, data?.ok ? 200 : 401);
}
