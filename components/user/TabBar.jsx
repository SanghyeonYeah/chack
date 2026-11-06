'use client';
// 하단 공통 메뉴: 관광지 = 홈·관광지·내 기록·내 정보 / 순례 = 홈·성지·순례 수첩·내 기록 (B9)

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useService } from './ServiceProvider';

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  places: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  records: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
};

export default function TabBar() {
  const { t } = useService();
  const path = usePathname();
  const items = [
    { href: '/', label: t.navHome, icon: 'home', match: (p) => p === '/' },
    { href: '/regions', label: t.navPlaces, icon: 'places', match: (p) => p.startsWith('/regions') || p.startsWith('/sites') },
    { href: '/me', label: t.navRecords, icon: 'records', match: (p) => p === '/me' || p.startsWith('/me/visits') || p.startsWith('/me/complete') || p.startsWith('/me/nearby') },
    { href: '/me/profile', label: t.navProfile, icon: 'profile', match: (p) => p.startsWith('/me/profile') },
  ];
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      <div className="tabbar-inner">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="tab" aria-current={it.match(path) ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[it.icon]}
            </svg>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
