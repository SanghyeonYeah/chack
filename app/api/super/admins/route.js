// S-01 기관 관리자 계정 발급 (임시 비밀번호는 응답에 한 번만)
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'BAD_EMAIL');
  const role = b.role === 'super' ? 'super' : 'org';
  const orgId = role === 'org' ? uuidOrNull(b.organization_id) : null;
  if (role === 'org' && !orgId) throw new HttpError(400, 'ORG_REQUIRED');
  const sb = supabaseAdmin();
  const password = randomBytes(9).toString('base64url');
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new HttpError(409, /already/i.test(error.message) ? 'EMAIL_EXISTS' : 'CREATE_FAILED');
  const ins = await sb.from('admins').insert({ user_id: data.user.id, role, organization_id: orgId, display_name: text(b.display_name, 50) });
  if (ins.error) {
    await sb.auth.admin.deleteUser(data.user.id);
    throw ins.error;
  }
  return json({ ok: true, email, temp_password: password });
});
