'use client';
// T-U-01 착 소개: 좌우로 넘기는 카드 4장 + 점 + 건너뛰기

import { useRef, useState } from 'react';
import { useService } from './ServiceProvider';
import { setFlag } from '@/lib/client/keyrings';
import { Stamp } from './Stamp';

const CARDS = [
  { title: '착은 문화유산 여행을 간직하는 서비스예요', body: '직접 걸은 하루가 나만의 기록이 됩니다', art: 'book' },
  { title: '키링을 지점에 대면 도장이 찍혀요', body: '관광지 곳곳의 착 리더에 키링을 대 보세요', art: 'reader' },
  { title: '키링을 폰에 대면 내 기록이 열려요', body: '사진을 남기고, 언제든 다시 꺼내 볼 수 있어요', art: 'phone' },
  { title: '코스를 완주하면 도장 쾅! 포인트도 받아요', body: '', art: 'stamp' },
];

export default function Onboarding({ onDone }) {
  const { service } = useService();
  const [i, setI] = useState(0);
  const ref = useRef(null);

  const finish = () => {
    setFlag(service, 'onboardingSeen', true);
    onDone();
  };
  const go = (n) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-[var(--gutter)] pt-4 pb-8">
      <div className="flex justify-end">
        <button className="btn btn-ghost btn-sm" onClick={finish}>
          건너뛰기
        </button>
      </div>
      <div
        ref={ref}
        className="swipe flex-1"
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {CARDS.map((c, n) => (
          <section key={n} className="flex flex-col justify-center px-1" aria-roledescription="slide" aria-label={`${n + 1} / 4`}>
            <div className="mb-10 grid h-60 place-items-center rounded-[var(--r-card)] border border-line bg-surface">
              <Art kind={c.art} />
            </div>
            <h2 className="title text-[26px]">{c.title}</h2>
            {c.body && <p className="muted mt-3 text-[18px]">{c.body}</p>}
          </section>
        ))}
      </div>
      <div className="dots my-6" aria-hidden>
        {CARDS.map((_, n) => (
          <i key={n} data-on={n === i} />
        ))}
      </div>
      {i < 3 ? (
        <button className="btn btn-secondary btn-block" onClick={() => go(i + 1)}>
          다음
        </button>
      ) : (
        <button className="btn btn-primary btn-block" onClick={finish}>
          시작하기
        </button>
      )}
    </main>
  );
}

function Art({ kind }) {
  const s = { fill: 'none', stroke: 'var(--c-ink)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'stamp') return <Stamp name="완주" size={150} className="rotate-[-8deg]" />;
  return (
    <svg viewBox="0 0 200 160" width="200" height="160" aria-hidden>
      {kind === 'book' && (
        <g {...s}>
          <path d="M100 40 C80 28 50 28 30 36 V130 C50 122 80 122 100 134 C120 122 150 122 170 130 V36 C150 28 120 28 100 40Z" fill="var(--c-surface)" />
          <path d="M100 40 V134" />
          <path d="M48 62 H82 M48 80 H82 M118 62 H152" stroke="var(--c-line)" />
          <circle cx="135" cy="92" r="16" stroke="var(--c-stamp)" />
        </g>
      )}
      {kind === 'reader' && (
        <g {...s}>
          <rect x="70" y="20" width="70" height="120" rx="10" fill="var(--c-surface)" />
          <path d="M105 60 v28 m-12 -12 l12 12 l12 -12" stroke="var(--c-primary)" />
          <circle cx="45" cy="115" r="18" stroke="var(--c-stamp)" />
          <path d="M45 97 V80 a10 10 0 0 1 10 -10" stroke="var(--c-muted)" />
          <path d="M150 50 c8 8 8 22 0 30 M160 42 c13 13 13 33 0 46" stroke="var(--c-accent)" />
        </g>
      )}
      {kind === 'phone' && (
        <g {...s}>
          <rect x="80" y="14" width="66" height="132" rx="12" fill="var(--c-surface)" />
          <path d="M94 44 H132 M94 60 H132 M94 76 H120" stroke="var(--c-line)" />
          <rect x="94" y="92" width="38" height="30" rx="4" stroke="var(--c-accent)" />
          <circle cx="44" cy="96" r="18" stroke="var(--c-stamp)" />
          <path d="M64 86 c6 -6 6 -16 0 -22" stroke="var(--c-accent)" />
        </g>
      )}
    </svg>
  );
}
