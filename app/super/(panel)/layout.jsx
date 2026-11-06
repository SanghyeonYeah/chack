// 최고 관리자 화면 (S-01~S-05): 관리자 틀 + 최고 관리자 권한
import { requireAdminPage } from '@/lib/server/auth';
import AdminNav from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function SuperLayout({ children }) {
  const a = await requireAdminPage({ superOnly: true });
  return (
    <div className="flex min-h-dvh min-w-[1280px]">
      <AdminNav role={a.role} service={a.service} email={a.email} />
      <main className="flex-1 px-10 py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
