import { notFound } from 'next/navigation';
import { isService } from '@/lib/service';
import { ServiceProvider } from '@/components/user/ServiceProvider';
import UploadProvider from '@/components/user/UploadProvider';

export default async function ServiceLayout({ children, params }) {
  const { service } = await params;
  if (!isService(service)) notFound();
  return (
    <ServiceProvider service={service}>
      <UploadProvider>{children}</UploadProvider>
    </ServiceProvider>
  );
}
