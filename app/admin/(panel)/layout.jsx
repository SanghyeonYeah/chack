// 관리자 화면 틀 (T-A / P-A / S): 로그인 확인 + 왼쪽 메뉴. 메뉴는 웹·권한에 따라 다름
import { requireAdminPage } from '@/lib/server/auth';
import AdminNav from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }) {
  const a = await requireAdminPage();
  return (
    <div className="flex min-h-dvh min-w-[1280px]">
      <AdminNav role={a.role} service={a.service} email={a.email} orgName={a.org?.name} />
      <main className="flex-1 px-10 py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
