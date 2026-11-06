'use client';
// T-U-01 착 소개(첫 방문 1회) + T-U-02 시작 화면

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Shell from './Shell';
import Onboarding from './Onboarding';
import { useService } from './ServiceProvider';
import { getFlag } from '@/lib/client/keyrings';
import { cachedApi } from '@/lib/client/api';
import { Stamp } from './Stamp';

export default function HomeTour() {
  const { service, t, primary, ready } = useService();
  const sp = useSearchParams();
  const [onboard, setOnboard] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!ready) return;
    setOnboard(sp.get('intro') === '1' || !getFlag(service, 'onboardingSeen'));
  }, [ready, service, sp]);

  useEffect(() => {
    if (!primary) {
      setSummary(null);
      return;
    }
    const apply = (d) => setSummary({ completed: d.completed_count, points: d.points });
    cachedApi(`/api/tokens/${primary}/records`, { onCached: apply })
      .then(apply)
      .catch(() => setSummary(null));
  }, [primary]);

  if (onboard === null) return <div className="min-h-dvh" />;
  if (onboard) return <Onboarding onDone={() => setOnboard(false)} />;

  return (
    <Shell>
      <section className="flex min-h-[70dvh] flex-col justify-center">
        <p className="font-serif text-[20px] font-bold tracking-[.3em] text-primary">CHAK · 착</p>
        <div className="relative mt-8 mb-10 h-56 overflow-hidden rounded-[var(--r-card)] border border-line bg-surface">
          <HanjiHero />
          <div className="absolute right-6 bottom-5 rotate-[-8deg] opacity-90">
            <Stamp name="현충사" size={96} />
          </div>
        </div>
        <h1 className="title">여행을 시작해볼까요?</h1>
        <p className="muted mt-3 text-[18px]">
          키링 하나로 도장을 모으고
          <br />
          그날의 기억을 간직하세요
        </p>
        {summary && (
          <p className="mt-5 inline-flex self-start rounded-full bg-sunk px-4 py-1.5 small font-semibold">
            {t.summaryLine(summary.completed, summary.points)}
          </p>
        )}
        <div className="mt-10 space-y-3">
          <Link href="/regions" className="btn btn-primary btn-block">
            {t.start}
          </Link>
          {primary && (
            <Link href="/me?via=menu" className="btn btn-secondary btn-block">
              {t.myRecordsBtn}
            </Link>
          )}
        </div>
      </section>
    </Shell>
  );
}

/** 대표 이미지 자리: 한지 위 먹선 산·처마 */
function HanjiHero() {
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect width="400" height="220" fill="var(--c-surface)" />
      <circle cx="300" cy="62" r="30" fill="var(--c-accent)" opacity=".18" />
      <path d="M0 170 C60 120 110 130 160 150 C210 110 260 100 320 140 C350 125 380 128 400 135 V220 H0Z" fill="var(--c-sunk)" />
      <path d="M0 190 C80 160 140 175 200 182 C270 160 330 165 400 178 V220 H0Z" fill="var(--c-line)" opacity=".7" />
      <g stroke="var(--c-ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".75">
        <path d="M70 150 Q110 128 150 150" />
        <path d="M60 152 Q110 120 160 152" />
        <path d="M82 152 V182 M138 152 V182" />
        <path d="M74 182 H146" />
      </g>
    </svg>
  );
}
