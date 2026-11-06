// 접속 주소로 관광지/순례를 판별해 /[service]/... 로 연결 (다른 파일 import 없음)
import { NextResponse } from 'next/server';

const SERVICES = ['tour', 'pilgrim'];
const PASS = ['/reader', '/admin', '/super', '/dev', '/api'];

const bare = (h) => (h || '').toLowerCase().split(':')[0];
const hostList = (v) => (v || '').split(',').map((s) => bare(s.trim())).filter(Boolean);

function serviceFromHost(hostHeader) {
  const host = bare(hostHeader);
  if (hostList(process.env.TOUR_HOSTS).includes(host)) return 'tour';
  if (hostList(process.env.PILGRIM_HOSTS).includes(host)) return 'pilgrim';
  if (host === 'pilgrim.localhost') return 'pilgrim';
  return SERVICES.includes(process.env.DEFAULT_SERVICE) ? process.env.DEFAULT_SERVICE : 'tour';
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const service = serviceFromHost(request.headers.get('host'));
  const headers = new Headers(request.headers);
  headers.set('x-chak-service', service);

  if (PASS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next({ request: { headers } });
  }
  const first = pathname.split('/')[1];
  if (SERVICES.includes(first)) return NextResponse.rewrite(new URL('/__chak_not_found', request.url));

  const url = request.nextUrl.clone();
  url.pathname = `/${service}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|woff2?)$).*)'],
};
