// 개발용 가상 리더: ENABLE_DEV_TOOLS=true + 최고 관리자만
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/server/auth';
import ReaderSim from './ReaderSim';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function Page() {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') notFound();
  await requireAdminPage({ superOnly: true });
  return <ReaderSim />;
}
