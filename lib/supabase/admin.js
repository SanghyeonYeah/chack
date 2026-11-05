import 'server-only';
import { createClient } from '@supabase/supabase-js';

let cached = null;

/** secret key로 접속하는 서버 전용 클라이언트. 브라우저 코드에서 import하지 마세요. */
export function supabaseAdmin() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 없습니다');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
