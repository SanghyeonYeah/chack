// GET /api/sites?region=&q= — T-U-04 / P-U-03 목록 (이름·별칭 검색 2글자부터)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, must, route, serviceOf, uuidOrNull } from '@/lib/server/http';
import { optionalToken } from '@/lib/server/optional-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const service = serviceOf(req);
  const sp = new URL(req.url).searchParams;
  const token = await optionalToken(req, service);
  let sites = must(
    await supabaseAdmin().rpc('user_sites', {
      p_service: service,
      p_region: uuidOrNull(sp.get('region')),
      p_token: token?.id ?? null,
    }),
    'sites',
  );
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  if (q.length >= 2) {
    sites = sites.filter((s) => [s.name, ...(s.aliases ?? [])].some((n) => n.toLowerCase().includes(q)));
  }
  return json({ ok: true, sites });
});
