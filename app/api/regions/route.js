// GET /api/regions?token= — 지역 + 보이는 관광지 수 + (키링 있으면) 내 완주 수
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route, serviceOf } from '@/lib/server/http';
import { optionalToken } from '@/lib/server/optional-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const service = serviceOf(req);
  const token = await optionalToken(req, service);
  const regions = must(
    await supabaseAdmin().rpc('user_regions', { p_service: service, p_token: token?.id ?? null }),
    'regions',
  );
  return json({ ok: true, regions });
});
