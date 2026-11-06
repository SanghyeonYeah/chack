// GET /api/admin/me — 로그인한 관리자 정보 / PUT — T-A-09 기관 정보 수정 / POST {password} — 비밀번호 변경
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const a = await requireAdmin();
  let org = null;
  if (a.orgId) {
    org = must(await supabaseAdmin().from('organizations').select('id, name, service, contact_name, contact_phone, contact_email').eq('id', a.orgId).single());
  }
  return json({ ok: true, role: a.role, email: a.email, service: a.service, org });
});

export const PUT = route(async (req) => {
  const a = await requireAdmin();
  if (!a.orgId) throw new HttpError(400, 'NO_ORG');
  const b = await readJson(req);
  const patch = {};
  for (const k of ['name', 'contact_name', 'contact_phone', 'contact_email']) if (typeof b[k] === 'string') patch[k] = b[k].trim() || null;
  if (patch.name === null) throw new HttpError(400, 'NAME_REQUIRED');
  must(await supabaseAdmin().from('organizations').update(patch).eq('id', a.orgId));
  return json({ ok: true });
});

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const { password } = await readJson(req);
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'PASSWORD_SHORT');
  must(await supabaseAdmin().auth.admin.updateUserById(a.userId, { password }));
  return json({ ok: true });
});
