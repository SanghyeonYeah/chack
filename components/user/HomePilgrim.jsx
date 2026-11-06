'use client';
// P-U-01 첫 화면: 성경 구절(30초마다 0.8초 페이드, 왼쪽으로 밀면 다음) + 첫 방문 안내 3줄

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell from './Shell';
import { useService } from './ServiceProvider';
import { getFlag, setFlag } from '@/lib/client/keyrings';
import { cachedApi } from '@/lib/client/api';

const INTERVAL = 30_000;
const FADE = 800;

export default function HomePilgrim() {
  const { service, t, primary, ready } = useService();
  const [verses, setVerses] = useState([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [intro, setIntro] = useState(false);
  const [count, setCount] = useState(null);
  const timer = useRef(null);
  const touch = useRef(null);

  useEffect(() => {
    cachedApi('/api/verses', { onCached: (d) => setVerses(d.verses) }).then((d) => setVerses(d.verses)).catch(() => setVerses([]));
  }, []);

  useEffect(() => {
    if (ready) setIntro(!getFlag(service, 'onboardingSeen'));
  }, [ready, service]);

  useEffect(() => {
    if (!primary) return;
    cachedApi(`/api/tokens/${primary}/records`, { onCached: (d) => setCount(d.completed_count) })
      .then((d) => setCount(d.completed_count))
      .catch(() => setCount(null));
  }, [primary]);

  const next = useCallback(() => {
    if (verses.length < 2) return;
    setVisible(false);
    setTimeout(() => {
      setIdx((i) => (i + 1) % verses.length);
      setVisible(true);
    }, FADE);
  }, [verses.length]);

  useEffect(() => {
    clearInterval(timer.current);
    timer.current = setInterval(next, INTERVAL);
    return () => clearInterval(timer.current);
  }, [next, idx]);

  const v = verses[idx];

  return (
    <Shell>
      <section
        className="flex min-h-[42dvh] flex-col items-center justify-center pt-10 text-center select-none"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current != null && touch.current - e.changedTouches[0].clientX > 50) next();
          touch.current = null;
        }}
        aria-live="polite"
      >
        {v ? (
          <figure className="fade" style={{ opacity: visible ? 1 : 0 }}>
            <blockquote className="font-serif text-[26px] leading-[1.8] font-semibold whitespace-pre-line">“{v.text}”</blockquote>
            {v.source && <figcaption className="muted mt-5">{v.source}</figcaption>}
          </figure>
        ) : (
          <div className="h-32" />
        )}
        {verses.length > 1 && (
          <div className="dots mt-8" aria-hidden>
            {verses.map((_, n) => (
              <i key={n} data-on={n === idx} />
            ))}
          </div>
        )}
      </section>

      {intro && (
        <div className="card mt-6">
          <ul className="space-y-2">
            <li>· 키링을 성지의 착 리더에 대면 순례 인장이 찍혀요</li>
            <li>· 키링을 폰에 대면 순례 수첩이 열려요</li>
            <li>· 사진과 메모로 순례를 간직하세요</li>
          </ul>
          <button
            className="btn btn-secondary btn-block mt-4"
            onClick={() => {
              setFlag(service, 'onboardingSeen', true);
              setIntro(false);
            }}
          >
            알겠어요
          </button>
        </div>
      )}

      <section className="mt-12 text-center">
        <p className="font-serif text-[22px] leading-relaxed">
          하느님과 함께
          <br />
          거룩한 성지 순례를 떠나봅시다
        </p>
        {count != null && <p className="muted mt-3">지금까지 성지 {count}곳 순례</p>}
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
