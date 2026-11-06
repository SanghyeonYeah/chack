// GET /api/verses — 노출 구절 목록 (P-U-01, 순서대로)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route } from '@/lib/server/http';

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
  return json({ ok: true, verses });
});
