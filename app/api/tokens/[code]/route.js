// GET /api/tokens/{code}?via=nfc|manual|menu — 키링 상태 확인 + 열람 기록(token_views)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, route, serviceOf } from '@/lib/server/http';
import { requireToken } from '@/lib/server/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => {
  const { code } = await params;
  const service = serviceOf(req);
  const token = await requireToken(req, code, service);
  const via = new URL(req.url).searchParams.get('via');
  if (['nfc', 'manual', 'menu'].includes(via)) {
    await supabaseAdmin().from('token_views').insert({ token_id: token.id, via });
  }
  return json({ ok: true, code: token.code, status: token.status, service });
});
