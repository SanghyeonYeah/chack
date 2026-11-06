'use client';
// T-U-10 완주 축하 / P-U-09 순례 완료 (더 느리고 차분하게, 포인트 없음)
// ① 빈 도장 자리 → 0.6초 뒤 쾅 + 진동 ② 완주 문구·날짜 ③ 포인트 카운트업 ④ 이 완주로 생긴 보너스·뱃지 ⑤ 다음 행동
// 화면을 보면 seen_by_user = true. 미확인 완주가 더 있으면 [다음]으로 차례로 (C4)

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import { useService } from '@/components/user/ServiceProvider';
import { Badge, Stamp } from '@/components/user/Stamp';
import { api, errorText } from '@/lib/client/api';
import { ymd } from '@/lib/format';

export default function CompletePage({ params }) {
  const { completionId } = use(params);
  const { service, t, primary, ready } = useService();
  const router = useRouter();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState(0);
  const [count, setCount] = useState(0);
  const [nextId, setNextId] = useState(null);
  const calm = service === 'pilgrim';

  useEffect(() => {
    if (!ready || !primary) return;
    api(`/api/tokens/${primary}/completions/${completionId}`)
      .then(async (r) => {
        setD(r);
        await api(`/api/tokens/${primary}/completions/${completionId}`, { method: 'POST' }).catch(() => {});
        const rec = await api(`/api/tokens/${primary}/records`).catch(() => null);
        setNextId(rec?.unseen?.find((x) => x !== completionId) ?? null);
      })
      .catch((e) => setError(errorText(e, t)));
  }, [ready, primary, completionId, t]);

  // 연출 순서
  useEffect(() => {
    if (!d) return undefined;
    const step = calm ? 1400 : 600;
    const timers = [
      setTimeout(() => {
        setStage(1);
        if (!calm) navigator.vibrate?.(120);
      }, calm ? 900 : 600),
      setTimeout(() => setStage(2), (calm ? 900 : 600) + step),
      setTimeout(() => setStage(3), (calm ? 900 : 600) + step * 2),
      setTimeout(() => setStage(4), (calm ? 900 : 600) + step * 3),
    ];
    return () => timers.forEach(clearTimeout);
  }, [d, calm]);

  // 포인트 카운트업
  const raf = useRef(0);
  useEffect(() => {
    if (stage < 3 || !d?.points) return undefined;
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      setCount(Math.round(d.points * (1 - (1 - p) ** 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [stage, d]);

  if (ready && !primary) return <Shell><ErrorBox message="키링을 폰 뒷면에 대 주세요" /></Shell>;
  if (error) return <Shell back={{ href: '/me' }}><ErrorBox message={error} /></Shell>;
  if (!d) return <Shell tabbar={false}><Loading /></Shell>;

  const later = () => router.replace(nextId ? `/me/complete/${nextId}` : '/me');

  return (
    <Shell tabbar={false}>
      <section className="flex min-h-[86dvh] flex-col items-center justify-center text-center">
        <div className="stamp-slot" aria-hidden={stage < 1}>
          {stage >= 1 && (
            <div className={calm ? 'stamp-calm' : 'stamp-hit'}>
              <Stamp name={d.site_name} image={d.stamp_image_path} size={184} />
            </div>
          )}
        </div>
        {!calm && stage >= 1 && <p className="fade-up mt-4 font-serif text-[22px] font-bold text-stamp">쾅!</p>}

        {stage >= 2 && (
          <div className="fade-up mt-6">
            <h1 className="title">{t.completeTitle(d.site_name)}</h1>
            <p className="muted mt-2 tabular-nums">{ymd(d.completed_at)}</p>
          </div>
        )}

        {stage >= 3 && d.points != null && (
          <p className="fade-up mt-5 font-serif text-[34px] font-bold text-primary tabular-nums">+{count.toLocaleString()}P 적립</p>
        )}
        {stage >= 3 && calm && d.verse && (
          <figure className="fade-up mt-6 max-w-[320px]">
            <blockquote className="font-serif text-[19px] leading-relaxed">“{d.verse.text}”</blockquote>
            {d.verse.source && <figcaption className="small muted mt-2">{d.verse.source}</figcaption>}
          </figure>
        )}

        {stage >= 3 && d.bonuses.length > 0 && (
          <div className="mt-6 w-full space-y-3">
            {d.bonuses.map((b, i) => (
              <div key={i} className="card fade-up flex items-center gap-4 text-left" style={{ animationDelay: `${0.3 + i * 0.3}s` }}>
                <Badge name={b.region_name} image={b.badge_image_path} earned size={64} />
                <div>
                  <p className="font-semibold">{t.regionBonus(b.region_name)}</p>
                  <p className="small muted">
                    {b.points != null && `보너스 +${b.points.toLocaleString()}P · `}
                    {b.region_name.replace(/(시|군|도)$/, '')} 뱃지 획득
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {stage >= 4 && (
          <div className="fade-up mt-10 w-full">
            <p className="subtitle">{t.nextAsk}</p>
            <div className="mt-5 space-y-3">
              <button className="btn btn-primary btn-block" onClick={() => router.push(`/me/nearby?site=${d.site_id}${nextId ? `&next=${nextId}` : ''}`)}>
                가볼게요
              </button>
              <button className="btn btn-ghost btn-block" onClick={later}>
                {nextId ? '다음 완주 보기' : '괜찮아요, 나중에 갈게요'}
              </button>
            </div>
          </div>
        )}
      </section>
    </Shell>
  );
}
