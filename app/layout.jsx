import { headers } from 'next/headers';
import { Noto_Serif_KR } from 'next/font/google';
import { SERVICE_LABEL } from '@/lib/service';
import './globals.css';

const serif = Noto_Serif_KR({
  weight: ['400', '600', '700'],
  preload: false,
  display: 'swap',
  variable: '--font-serif-kr',
});

async function currentService() {
  return (await headers()).get('x-chak-service') === 'pilgrim' ? 'pilgrim' : 'tour';
}

export async function generateMetadata() {
  const s = await currentService();
  return { title: SERVICE_LABEL[s].name, description: '키링을 대면 그날의 기록이 다시 열립니다.' };
}

export const viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }) {
  const service = await currentService();
  return (
    <html lang="ko" data-service={service} className={serif.variable}>
      <head>
        {/* Pretendard(무료, OFL) — CDN 실패 시 시스템 고딕으로 대체 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
