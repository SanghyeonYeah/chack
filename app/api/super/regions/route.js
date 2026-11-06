// S-02 지역 관리 — 목록 · 추가 (도 / 시·군)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { int, text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin({ superOnly: true });
  const rows = must(await supabaseAdmin().from('regions').select('*, sites(id, service)').order('sort_order').order('name'));
  return json({ ok: true, regions: rows.map((r) => ({ ...r, sites: undefined, tour_sites: r.sites.filter((s) => s.service === 'tour').length, pilgrim_sites: r.sites.filter((s) => s.service === 'pilgrim').length })) });
});

export const POST = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  const name = text(b.name, 50);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED');
  const parent = uuidOrNull(b.parent_id);
  const level = parent ? 'sigungu' : 'sido';
  const sb = supabaseAdmin();
  const dup = must(await sb.from('regions').select('id').eq('name', name).eq('level', level).filter('parent_id', parent ? 'eq' : 'is', parent ?? null));
  if (dup.length) throw new HttpError(409, 'DUPLICATE');
  const d = must(await sb.from('regions').insert({ name, level, parent_id: parent, sort_order: int(b.sort_order) ?? 0, is_active: b.is_active !== false }).select('id').single());
  return json({ ok: true, id: d.id });
});
