import { createClient } from '@supabase/supabase-js';

let cached = null;

/** 브라우저용(공개 키). 공개 정보만 읽을 수 있고, 키링 기록은 서버 API를 거친다. */
export function supabaseBrowser() {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return cached;
}
