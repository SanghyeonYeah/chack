// S-01 기관 관리 — 목록(두 웹 모두) · 만들기
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin({ superOnly: true });
  const sb = supabaseAdmin();
  const [orgs, admins] = await Promise.all([
    sb.from('organizations').select('*, sites(id, name)').order('service').order('name').then((r) => must(r)),
    sb.from('admins').select('id, user_id, role, organization_id, display_name, is_active, created_at').order('created_at').then((r) => must(r)),
  ]);
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const email = new Map((users?.users ?? []).map((u) => [u.id, u.email]));
  return json({ ok: true, orgs, admins: admins.map((x) => ({ ...x, email: email.get(x.user_id) ?? null })) });
});

export const POST = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  if (!['tour', 'pilgrim'].includes(b.service)) throw new HttpError(400, 'SERVICE_REQUIRED');
  const name = text(b.name, 100);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED');
  const d = must(
    await supabaseAdmin()
      .from('organizations')
      .insert({ service: b.service, name, contact_name: text(b.contact_name, 50), contact_phone: text(b.contact_phone, 50), contact_email: text(b.contact_email, 100) })
      .select('id')
      .single(),
  );
  return json({ ok: true, id: d.id });
});
