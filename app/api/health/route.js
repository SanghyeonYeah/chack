import { supabaseAdmin } from '@/lib/supabase/admin';
import { json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 연결 확인용: 웹 판별, 환경변수 입력 여부, DB 응답. 운영 전에 지우세요. */
export async function GET(req) {
  const env = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    secretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    kakaoJsKey: Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY),
    ipHashSalt: Boolean(process.env.IP_HASH_SALT),
  };
  let db = 'skipped (secret key 없음)';
  if (env.supabaseUrl && env.secretKey) {
    const { error } = await supabaseAdmin().from('settings').select('key', { count: 'exact', head: true });
    db = error ? 'error (SQL 0001~0004 실행 여부 확인)' : 'ok';
  }
  return json({ host: req.headers.get('host'), service: req.headers.get('x-chak-service'), env, db, time: new Date().toISOString() });
}
