// S-01 관리자 계정 비활성 · 다시 활성 · 비밀번호 초기화
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }) => {
  const me = await requireAdmin({ superOnly: true });
  const aid = uuidOrNull((await params).id);
  if (!aid) throw new HttpError(404, 'NOT_FOUND');
  const b = await readJson(req);
  const sb = supabaseAdmin();
  const row = must(await sb.from('admins').select('id, user_id').eq('id', aid).maybeSingle());
  if (!row) throw new HttpError(404, 'NOT_FOUND');
  if (row.user_id === me.userId && b.is_active === false) throw new HttpError(400, 'CANNOT_DISABLE_SELF');
  if ('is_active' in b) must(await sb.from('admins').update({ is_active: b.is_active === true }).eq('id', aid));
  if (b.reset_password) {
    const password = randomBytes(9).toString('base64url');
    must(await sb.auth.admin.updateUserById(row.user_id, { password }));
    return json({ ok: true, temp_password: password });
  }
  return json({ ok: true });
});
