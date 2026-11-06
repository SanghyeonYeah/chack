// T-A-06 / P-A-07 키링 관리 — 목록(?q=&status=&page=) · 상태 변경(PUT {id, status})
// 도장 수는 우리 기관 관광지에서 받은 도장만 (B4). 분실 처리는 기록 이전과 함께 /transfer 에서
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, scopeOrg } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
const PAGE = 50;

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const org = scopeOrg(a, uuidOrNull(sp.get('org')));
  const status = ['stock', 'issued', 'lost'].includes(sp.get('status')) ? sp.get('status') : null;
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const rows = must(
    await supabaseAdmin().rpc('org_tokens', {
      p_service: a.service, p_org: org, p_q: (sp.get('q') ?? '').slice(0, 8), p_status: status, p_limit: PAGE, p_offset: page * PAGE,
    }),
    'tokens',
  );
  return json({ ok: true, tokens: rows, total: Number(rows[0]?.total_count ?? 0), page, page_size: PAGE });
});

export const PUT = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  const id = uuidOrNull(b.id);
  if (!id || !['stock', 'issued', 'lost'].includes(b.status)) throw new HttpError(400, 'BAD_REQUEST');
  const sb = supabaseAdmin();
  const t = must(await sb.from('tokens').select('id, service, organization_id, status').eq('id', id).maybeSingle());
  if (!t || t.service !== a.service || (a.role !== 'super' && t.organization_id !== a.orgId)) throw new HttpError(404, 'NOT_FOUND');
  if (t.status === 'lost' && b.status !== 'lost' && a.role !== 'super') throw new HttpError(403, 'LOST_ONLY_SUPER');
  must(await sb.from('tokens').update({ status: b.status }).eq('id', id));
  return json({ ok: true });
});
