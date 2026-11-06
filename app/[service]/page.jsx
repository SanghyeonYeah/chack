// T-U-01 착 소개 + T-U-02 시작 화면 / P-U-01 첫 화면 (성경 구절)
import HomeTour from '@/components/user/HomeTour';
import HomePilgrim from '@/components/user/HomePilgrim';

export default async function Home({ params }) {
  const { service } = await params;
  return service === 'pilgrim' ? <HomePilgrim /> : <HomeTour />;
}
