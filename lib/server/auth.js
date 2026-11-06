import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError } from '@/lib/server/http';
import { resolveService } from '@/lib/service';

/** 쿠키 세션으로 로그인 확인하는 Supabase 클라이언트 (관리자 로그인 전용) */
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* 서버 컴포넌트에서는 쿠키를 쓸 수 없음 (미들웨어 없이도 동작) */
        }
      },
    },
  });
}

/**
 * 현재 관리자 (없으면 null)
 * { userId, email, role: 'super'|'org', orgId, org, service }
 * service: 기관 관리자 = 기관의 웹 / 최고 관리자 = 접속 주소의 웹 (관리자 화면은 접속한 웹 기준)
 */
export async function currentAdmin() {
  const sb = await supabaseSession();
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if (!user) return null;
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('admins')
    .select('id, role, organization_id, display_name, is_active, organizations(id, name, service, is_active)')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!row || !row.is_active) return null;
  const hostService = resolveService((await headers()).get('host'));
  if (row.role === 'org') {
    if (!row.organizations?.is_active) return null;
    return {
      userId: user.id, email: user.email, role: 'org', orgId: row.organization_id,
      org: row.organizations, service: row.organizations.service, hostService, name: row.display_name,
    };
  }
  return { userId: user.id, email: user.email, role: 'super', orgId: null, org: null, service: hostService, hostService, name: row.display_name };
}

/** 화면용: 로그인 안 했으면 로그인 화면으로 */
export async function requireAdminPage({ superOnly = false } = {}) {
  const a = await currentAdmin();
  if (!a) redirect('/admin/login');
  if (superOnly && a.role !== 'super') redirect('/admin');
  return a;
}

/** API용: 권한 없으면 401/403 (규칙 15) */
export async function requireAdmin({ superOnly = false } = {}) {
  const a = await currentAdmin();
  if (!a) throw new HttpError(401, 'UNAUTHORIZED');
  if (superOnly && a.role !== 'super') throw new HttpError(403, 'FORBIDDEN');
  return a;
}

/** 이 관리자가 이 관광지를 다룰 수 있는지 (자기 기관 + 자기 웹) */
export async function requireSiteAccess(admin, siteId) {
  const { data } = await supabaseAdmin().from('sites').select('id, organization_id, service, name').eq('id', siteId).maybeSingle();
  if (!data || data.service !== admin.service) throw new HttpError(404, 'NOT_FOUND');
  if (admin.role !== 'super' && data.organization_id !== admin.orgId) throw new HttpError(404, 'NOT_FOUND');
  return data;
}

export async function requireCheckpointAccess(admin, checkpointId) {
  const { data } = await supabaseAdmin().from('checkpoints').select('id, site_id, name').eq('id', checkpointId).maybeSingle();
  if (!data) throw new HttpError(404, 'NOT_FOUND');
  await requireSiteAccess(admin, data.site_id);
  return data;
}

export async function requireReaderAccess(admin, readerId) {
  const { data } = await supabaseAdmin()
    .from('readers')
    .select('id, organization_id, organizations(service)')
    .eq('id', readerId)
    .maybeSingle();
  if (!data || data.organizations?.service !== admin.service) throw new HttpError(404, 'NOT_FOUND');
  if (admin.role !== 'super' && data.organization_id !== admin.orgId) throw new HttpError(404, 'NOT_FOUND');
  return data;
}

/** 기관 범위 (최고 관리자: ?org= 로 고를 수 있음, 없으면 전체 = null) */
export function scopeOrg(admin, requested) {
  if (admin.role === 'org') return admin.orgId;
  return requested || null;
}
