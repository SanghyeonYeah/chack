'use client';
// T-U-12 내 포인트 · 뱃지 · 완료율 / P-U-09 내 기록 (지역 순례 완료율 · 뱃지, 포인트 없음)

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import CodeEntry from '@/components/user/CodeEntry';
import { useService } from '@/components/user/ServiceProvider';
import { Badge } from '@/components/user/Stamp';
import { cachedApi, errorText } from '@/lib/client/api';
import { removeKeyring, rememberKeyring } from '@/lib/client/keyrings';
import { maskCode, md, rate } from '@/lib/format';

const KIND = { site_complete: '완주', sigungu_bonus: '시·군 전체 완주 보너스', sido_bonus: '도 전체 완주 보너스', exchange: '교환', adjust: '조정' };

export default function ProfilePage() {
  const { service, t, keyrings, primary, ready } = useService();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [exchange, setExchange] = useState(false);
  const [unlink, setUnlink] = useState(null);

  useEffect(() => {
    if (!ready || !primary) return;
    setD(null);
    cachedApi(`/api/tokens/${primary}/summary`, { onCached: setD }).then(setD).catch((e) => setError(errorText(e, t)));
  }, [ready, primary, t]);

  if (!ready) return <Shell><Loading /></Shell>;
  if (!primary) {
    return (
      <Shell>
        <h1 className="title">{t.navProfile}</h1>
        <div className="mt-6"><CodeEntry next="/me/profile" /></div>
        <Link href="/?intro=1" className="btn btn-ghost btn-block mt-6">사용법 다시 보기</Link>
      </Shell>
    );
  }
  if (error) return <Shell><ErrorBox message={error} /></Shell>;
  if (!d) return <Shell><Loading /></Shell>;

  const sidos = d.regions.filter((r) => r.level === 'sido' && r.total > 0);
  const earned = new Set(d.badges.map((b) => b.region_id));
  const badgeRegions = d.regions.filter((r) => r.total > 0 && r.is_active !== false);

  return (
    <Shell>
      <h1 className="title">{t.navProfile}</h1>
      <p className="muted mt-1">키링 {maskCode(primary)}</p>

      {/* ① ② 포인트 (순례는 스위치 꺼짐이면 영역 자체 없음) */}
      {d.points && (
        <section className="card mt-6">
          <p className="section-label">포인트</p>
          <p className="mt-1 font-serif text-[36px] font-bold tabular-nums">{d.points.balance.toLocaleString()}P</p>
          <button className="btn btn-secondary btn-block mt-4" onClick={() => setExchange(true)}>포인트 사용하기</button>
          {d.points.ledger.length > 0 && (
            <ul className="mt-5 divide-y divide-line">
              {d.points.ledger.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">{l.label} {KIND[l.kind]}</span>
                    <span className="small muted">{md(l.created_at)}</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${l.points >= 0 ? 'text-primary' : 'text-error'}`}>
                    {l.points >= 0 ? '+' : ''}{l.points.toLocaleString()}P
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ③ 지역 완료율 */}
      <section className="card mt-6">
        <p className="section-label">지역 {service === 'pilgrim' ? '순례 완료율' : '완료율'}</p>
        <ul className="mt-3 space-y-4">
          {sidos.map((s) => (
            <li key={s.id} className="space-y-4">
              <RateRow name={s.name} done={s.done} total={s.total} strong />
              {d.regions
                .filter((r) => r.parent_id === s.id && r.total > 0)
                .map((r) => <RateRow key={r.id} name={r.name} done={r.done} total={r.total} />)}
            </li>
          ))}
        </ul>
      </section>

      {/* ④ 뱃지 */}
      <section className="card mt-6">
        <p className="section-label">뱃지</p>
        <ul className="mt-4 grid grid-cols-2 gap-4">
          {badgeRegions.map((r) => {
            const on = earned.has(r.id);
            return (
              <li key={r.id} className="flex flex-col items-center gap-2 text-center">
                <Badge name={r.name} image={r.badge_image_path} earned={on} />
                <span className="font-semibold">{r.name}</span>
                {!on && <span className="small muted">{t.badgeHint(r.name)}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ⑤ 기타: 사용법 · 키링 연결 해제(하나씩, B7) */}
      <section className="card mt-6">
        <p className="section-label">이 폰에 연결된 키링</p>
        <ul className="mt-3 divide-y divide-line">
          {keyrings.map((c, i) => (
            <li key={c} className="flex items-center justify-between gap-3 py-2">
              <button className="flex min-h-[44px] items-center gap-2 text-left" onClick={() => rememberKeyring(service, c)}>
                <span className="font-semibold tabular-nums">{maskCode(c)}</span>
                {i === 0 && <span className="chip chip-progress">기본</span>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setUnlink(c)}>연결 해제</button>
            </li>
          ))}
        </ul>
        {service === 'tour' && (
          <Link href="/?intro=1" className="btn btn-ghost btn-block mt-3">사용법 다시 보기</Link>
        )}
      </section>

      {exchange && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={() => setExchange(false)}>
          <div className="modal text-center" onClick={(e) => e.stopPropagation()}>
            <p className="subtitle">곧 지역 특산품과 문화상품으로 교환할 수 있어요</p>
            <button className="btn btn-primary btn-block mt-6" onClick={() => setExchange(false)}>확인</button>
          </div>
        </div>
      )}
      {unlink && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal">
            <p className="subtitle">이 폰에서 키링 {maskCode(unlink)} 연결을 해제할까요?</p>
            <p className="muted mt-2">기록은 지워지지 않아요. 키링을 다시 폰에 대면 언제든 볼 수 있어요.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn btn-secondary" onClick={() => setUnlink(null)}>취소</button>
              <button className="btn btn-primary" onClick={() => { removeKeyring(service, unlink); setUnlink(null); }}>해제</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function RateRow({ name, done, total, strong }) {
  const pct = rate(done, total);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={strong ? 'font-semibold' : ''}>{name}</span>
        <span className="small muted tabular-nums">{pct}% · {done}/{total}</span>
      </div>
      <div className={`bar ${strong ? '' : 'bar-thin'}`} aria-hidden><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
