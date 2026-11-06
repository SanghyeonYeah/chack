// S-02 지역 수정(이름·활성·순서·뱃지 이미지) · 삭제(관광지 없을 때만)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { int, text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }) => {
  await requireAdmin({ superOnly: true });
  const rid = uuidOrNull((await params).id);
  if (!rid) throw new HttpError(404, 'NOT_FOUND');
  const b = await readJson(req);
  const patch = {};
  if ('name' in b) patch.name = text(b.name, 50);
  if ('is_active' in b) patch.is_active = b.is_active === true;
  if ('sort_order' in b) patch.sort_order = int(b.sort_order) ?? 0;
  if ('badge_image_path' in b) patch.badge_image_path = text(b.badge_image_path, 500);
  if ('name' in patch && !patch.name) throw new HttpError(400, 'NAME_REQUIRED');
  must(await supabaseAdmin().from('regions').update(patch).eq('id', rid));
  return json({ ok: true });
});

export const DELETE = route(async (req, { params }) => {
  await requireAdmin({ superOnly: true });
  const rid = uuidOrNull((await params).id);
  if (!rid) throw new HttpError(404, 'NOT_FOUND');
  const sb = supabaseAdmin();
  const [{ count: s }, { count: c }, { count: b }] = await Promise.all([
    sb.from('sites').select('id', { count: 'exact', head: true }).eq('region_id', rid),
    sb.from('regions').select('id', { count: 'exact', head: true }).eq('parent_id', rid),
    sb.from('token_badges').select('id', { count: 'exact', head: true }).eq('region_id', rid),
  ]);
  if ((s ?? 0) + (c ?? 0) + (b ?? 0) > 0) throw new HttpError(409, 'IN_USE');
  must(await sb.from('regions').delete().eq('id', rid));
  return json({ ok: true });
});
