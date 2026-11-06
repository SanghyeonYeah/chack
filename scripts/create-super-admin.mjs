// 최고 관리자 계정 만들기: npm run admin:create
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();

if (!url || !secret || !email) {
  console.error('.env에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, SUPER_ADMIN_EMAIL을 넣어 주세요');
  process.exit(1);
}

const given = process.env.SUPER_ADMIN_PASSWORD?.trim();
const password = given || randomBytes(12).toString('base64url');
const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  let userId;
  const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // 이미 있는 계정이면 찾아서 권한만 부여
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (data.users.length < 200) break;
    }
    if (!userId) throw created.error ?? new Error('계정을 만들지 못했어요');
    console.log('이미 있는 계정이라 비밀번호는 바꾸지 않았어요.');
  }

  const { error } = await sb
    .from('admins')
    .upsert(
      { user_id: userId, role: 'super', organization_id: null, display_name: '최고 관리자' },
      { onConflict: 'user_id' },
    );
  if (error) throw error;

  console.log(`최고 관리자 준비 완료: ${email}`);
  if (created.data.user && !given) console.log(`임시 비밀번호: ${password}  (첫 로그인 후 바꿔 주세요)`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
