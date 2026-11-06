'use client';
import { createBrowserClient } from '@supabase/ssr';

let cached = null;

/** 브라우저용(공개 키). 관리자 로그인 세션(쿠키)만 다루고, 데이터는 서버 API를 거친다 */
export function supabaseBrowser() {
  if (cached) return cached;
  cached = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return cached;
}
