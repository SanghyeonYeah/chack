'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function AdminNav({ role, service, email, orgName }) {
  const path = usePathname();
  const p = service === 'pilgrim';
  const id = (t, s) => (p ? s : t);
  const items = [
    ['/admin', '대시보드', id('T-A-02', 'P-A-02')],
    ['/admin/sites', p ? '성지 관리' : '관광지 관리', id('T-A-03', 'P-A-03')],
    ['/admin/checkpoints', '지점 관리', id('T-A-04', 'P-A-04')],
    p && ['/admin/priests', '신부님 관리', 'P-A-05'],
    ['/admin/readers', '리더 관리', id('T-A-05', 'P-A-06')],
    ['/admin/tokens', '키링 관리', id('T-A-06', 'P-A-07')],
    p && ['/admin/verses', '성경 구절', 'P-A-08'],
    ['/admin/stats', '통계', id('T-A-07', 'P-A-09')],
    ['/admin/export', '데이터 내보내기', id('T-A-08', 'P-A-10')],
    role === 'org' && ['/admin/account', '기관 정보 · 계정', 'T-A-09'],
  ].filter(Boolean);
  const supers = [
    ['/super/orgs', '기관 · 계정', 'S-01'],
    ['/super/regions', '지역', 'S-02'],
    ['/super/tokens', '키링 발급', 'S-03'],
    ['/super/stats', '전체 통계', 'S-04'],
    ['/super/settings', '서비스 설정', 'S-05'],
    ['/super/guard', '코드 차단 해제', ''],
    ['/admin/account', '내 비밀번호', ''],
  ];
  const active = (href) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  const link = ([href, label, sid]) => (
    <Link key={href + label} href={href} aria-current={active(href) ? 'page' : undefined}
      className={`flex items-center justify-between rounded-[var(--r-btn)] px-3 py-2.5 ${active(href) ? 'bg-primary text-on-primary font-semibold' : 'hover:bg-sunk'}`}>
      <span>{label}</span>
      {sid && <span className={`text-[13px] ${active(href) ? 'opacity-80' : 'muted'}`}>{sid}</span>}
    </Link>
  );

  return (
    <aside className="sticky top-0 flex h-dvh w-[260px] shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
      <p className="px-3 font-serif text-[18px] font-bold tracking-[.25em] text-primary">CHAK · 착</p>
      <p className="mt-1 px-3 small muted">{p ? '순례 웹' : '관광지 웹'} 관리자</p>
      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
        {items.map(link)}
        {role === 'super' && (
          <>
            <p className="px-3 pt-6 pb-1 small font-semibold muted">최고 관리자</p>
            {supers.map(link)}
            {process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true' && link(['/dev/reader-sim', '가상 리더', 'DEV'])}
          </>
        )}
      </nav>
      <div className="mt-4 border-t border-line pt-4 px-3">
        <p className="small font-semibold truncate">{orgName ?? '최고 관리자'}</p>
        <p className="small muted truncate">{email}</p>
        <button
          className="btn btn-ghost btn-sm mt-2 -ml-3"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            location.href = '/admin/login';
          }}
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
