import { notFound } from 'next/navigation';
import { isService } from '@/lib/service';

export default async function ServiceLayout({ children, params }) {
  const { service } = await params;
  if (!isService(service)) notFound();
  return <>{children}</>;
}
