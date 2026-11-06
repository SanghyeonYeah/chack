// 틀린 코드 차단 목록 · 해제 (C2/D4: 50회 이상 24시간 차단은 최고 관리자가 해제)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin({ superOnly: true });
  const rows = must(await supabaseAdmin().rpc('code_lookup_list'));
  return json({ ok: true, rows: rows.map((r) => ({ ...r, label: `${r.ip_hash.split(':')[0]} · ${r.ip_hash.split(':')[1]?.slice(0, 10)}…` })) });
});

export const DELETE = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const { ip_hash } = await readJson(req);
  if (typeof ip_hash !== 'string' || !ip_hash) throw new HttpError(400, 'BAD_REQUEST');
  must(await supabaseAdmin().rpc('code_lookup_clear', { p_ip_hash: ip_hash }));
  return json({ ok: true });
});
