// GET /api/verses — 노출 구절 목록 (P-U-01, 순서대로)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PUBLIC_CACHE, json, must, route } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const verses = must(
    await supabaseAdmin()
      .from('verses')
      .select('id, text, source')
      .eq('is_visible', true)
      .order('sort_order')
      .order('created_at'),
    'verses',
  );
  // 모든 순례자에게 같은 데이터라 서버 캐시 사용 (관리자 수정은 최대 5분 뒤 반영)
  return json({ ok: true, verses }, 200, { cache: PUBLIC_CACHE });
});
