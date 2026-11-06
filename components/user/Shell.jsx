'use client';
// 사용자 화면 틀: 가운데 430px + 하단 메뉴 (+ 순례: "공식 인증 아님" 문구)

import Link from 'next/link';
import TabBar from './TabBar';
import { useService } from './ServiceProvider';

export default function Shell({ children, tabbar = true, back, className = '' }) {
  const { service } = useService();
  return (
    <div className={tabbar ? 'has-tabbar' : ''}>
      <main className={`page ${tabbar ? '' : 'page-bare'} ${className}`}>
        {back && (
          <Link href={back.href} className="back -ml-1 mb-2">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m15 5-7 7 7 7" />
            </svg>
            {back.label ?? '뒤로'}
          </Link>
        )}
        {children}
        <footer className="mt-14 space-y-1 text-center small muted">
          {service === 'pilgrim' && <p>착 순례 기록은 개인 기록용이며 교회의 공식 인증이 아닙니다</p>}
          <p>
            <Link href="/privacy" className="underline underline-offset-4">
              개인정보 안내
            </Link>
          </p>
        </footer>
      </main>
      {tabbar && <TabBar />}
    </div>
  );
}

export function Loading({ label = '불러오는 중…' }) {
  return (
    <div className="py-20 text-center muted" role="status">
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="card text-center" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary mt-4" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Progress({ done, total, label }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="small font-semibold">{label}</span>
        <span className="small muted tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
