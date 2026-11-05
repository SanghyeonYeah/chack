import { NextResponse } from 'next/server';
import { resolveService } from '@/lib/service';

/**
 * 접속 주소로 관광지/순례를 판별한다.
 *  - 화면: /k/ABC → /tour/k/ABC 처럼 내부 경로로 바꿔 app/[service]/ 아래 화면을 연다
 *  - API(/api/*), 리더(/reader): 경로는 그대로, x-chak-service 헤더만 붙인다
 * 관광지 주소에서 /pilgrim/... 을 직접 열면 /tour/pilgrim/... 이 되어 404가 된다(교차 접근 차단).
 */
export function middleware(req) {
  const service = resolveService(req.headers.get('host'));
  const headers = new Headers(req.headers);
  headers.set('x-chak-service', service);

  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/') || pathname === '/reader' || pathname.startsWith('/reader/')) {
    return NextResponse.next({ request: { headers } });
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${service}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
