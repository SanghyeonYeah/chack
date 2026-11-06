// S-01 기관 수정(이름·연락처·활성) · 관광지 배정(assign_site)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }) => {
  await requireAdmin({ superOnly: true });
  const oid = uuidOrNull((await params).id);
  if (!oid) throw new HttpError(404, 'NOT_FOUND');
  const b = await readJson(req);
  const sb = supabaseAdmin();
  if (b.assign_site) {
    const sid = uuidOrNull(b.assign_site);
    const { error } = await sb.from('sites').update({ organization_id: oid }).eq('id', sid);
    if (error) throw new HttpError(400, /SERVICE_MISMATCH/.test(error.message) ? 'SITE_SERVICE_MISMATCH' : 'ASSIGN_FAILED');
    return json({ ok: true });
  }
  const patch = {};
  for (const k of ['name', 'contact_name', 'contact_phone', 'contact_email']) if (k in b) patch[k] = text(b[k], 100);
  if ('name' in patch && !patch.name) throw new HttpError(400, 'NAME_REQUIRED');
  if ('is_active' in b) patch.is_active = b.is_active === true;
  must(await sb.from('organizations').update(patch).eq('id', oid));
  return json({ ok: true });
});
