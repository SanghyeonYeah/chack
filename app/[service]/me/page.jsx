'use client';
// T-U-07 내 여행 기록 / P-U-06 순례 수첩
// - 기본 키링(목록 맨 앞) 기록, 위에 키링 바꾸기(····2PQA / ····8KMD) (B7)
// - 관광지별(최근 방문순) → 날짜별 묶음(B3①) → 지점 도장(시간순)
// - via=nfc로 들어오면 오늘 받은 도장이 0.25초 간격으로 위에서부터 나타남 ("따라락")
// - 아직 보지 않은 완주가 있으면 완주 화면(T-U-10)을 먼저 띄움 (완주한 순서대로, C4)

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import CodeEntry from '@/components/user/CodeEntry';
import { useService } from '@/components/user/ServiceProvider';
import { useUploads } from '@/components/user/UploadProvider';
import { api, errorText } from '@/lib/client/api';
import { rememberKeyring, removeKeyring } from '@/lib/client/keyrings';
import { hm, maskCode, md } from '@/lib/format';

export default function MePage() {
  return (
    <Suspense>
      <Me />
    </Suspense>
  );
}

function Me() {
  const { service, t, keyrings, primary, ready, showToast } = useService();
  const uploads = useUploads();
  const router = useRouter();
  const sp = useSearchParams();
  const via = sp.get('via');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [animate] = useState(via === 'nfc');
  const [notices] = useState(() => ({
    first: sp.get('first') === '1',
    multi: Number(sp.get('multi')) || 0,
    stopped: sp.get('stopped') === '1',
  }));
  const logged = useRef(null);

  const load = useCallback(
    async (code) => {
      setError(null);
      try {
        const r = await api(`/api/tokens/${code}/records`);
        if (r.unseen?.length) {
          router.replace(`/me/complete/${r.unseen[0]}`);
          return;
        }
        setD(r);
      } catch (e) {
        if (e.code === 'OTHER_SERVICE' && e.data?.redirect) {
          window.location.replace(e.data.redirect);
          return;
        }
        setError(e);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!ready || !primary) return;
    setD(null);
    // 하단 메뉴로 들어온 열람도 기록 (via=menu, 재태그 지표에서는 제외)
    if (via !== 'nfc' && via !== 'manual' && logged.current !== primary) {
      logged.current = primary;
      api(`/api/tokens/${primary}?via=menu`).catch(() => {});
    }
    void load(primary);
  }, [ready, primary, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // 주소창의 via 등은 한 번만 쓰고 지움 (새로고침 시 애니메이션·안내 반복 방지)
  useEffect(() => {
    if (sp.toString()) window.history.replaceState(null, '', '/me');
    if (notices.stopped) showToast('키링을 다시 대서 사진 올리기를 멈췄어요');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!uploads || !primary) return undefined;
    return uploads.onUploaded(() => api(`/api/tokens/${primary}/records`).then(setD).catch(() => {}));
  }, [uploads, primary]);

  // 오늘 받은 도장 순서 (따라락)
  const order = useMemo(() => {
    const m = new Map();
    if (!d || !animate) return m;
    let n = 0;
    for (const s of d.sites) for (const g of s.dates) if (g.date === d.today) for (const v of g.visits) m.set(v.id, n++);
    return m;
  }, [d, animate]);

  if (!ready) return <Shell><Loading /></Shell>;

  if (!primary) {
    return (
      <Shell>
        <h1 className="title">{t.recordTitle}</h1>
        <div className="mt-6">
          <CodeEntry />
        </div>
      </Shell>
    );
  }

  const switcher = keyrings.length > 1 && (
    <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="키링 바꾸기">
      <span className="small muted">키링 바꾸기</span>
      {keyrings.map((c) => (
        <button
          key={c}
          className={`btn btn-sm min-h-[44px] tabular-nums ${c === primary ? 'btn-primary' : 'btn-secondary'}`}
          aria-pressed={c === primary}
          onClick={() => c !== primary && rememberKeyring(service, c)}
        >
          {maskCode(c)}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <Shell>
        {switcher}
        <ErrorBox message={errorText(error, t)} onRetry={error.code === 'NETWORK' || error.code === 'SERVER_ERROR' ? () => load(primary) : undefined} />
        {(error.code === 'LOST_TOKEN' || error.code === 'UNKNOWN_TOKEN') && (
          <button className="btn btn-secondary btn-block mt-4" onClick={() => removeKeyring(service, primary)}>
            이 폰에서 이 키링 연결 해제
          </button>
        )}
      </Shell>
    );
  }
  if (!d) return <Shell>{switcher}<Loading /></Shell>;

  const empty = d.sites.length === 0;

  return (
    <Shell>
      {switcher}
      {notices.multi > 1 && <p className="mb-3 rounded-[var(--r-btn)] bg-sunk px-4 py-2 small">이 폰에 키링이 {notices.multi}개 연결되어 있어요</p>}
      {notices.first && <p className="fade-up mb-4 rounded-[var(--r-card)] border border-accent/40 bg-surface p-4 font-semibold">{t.firstKeyring}</p>}

      {/* ① 상단 요약 */}
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="section-label">키링 <span className="tabular-nums">{maskCode(d.code)}</span></p>
          <h1 className="title mt-1">{t.recordTitle}</h1>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="small muted">{service === 'pilgrim' ? '순례한 성지' : '완주한 관광지'}</p>
          <p className="font-serif text-[28px] font-bold tabular-nums">{d.completed_count}<span className="text-[18px]">곳</span></p>
        </div>
        {d.points != null ? (
          <div className="card p-4">
            <p className="small muted">총 포인트</p>
            <p className="font-serif text-[28px] font-bold tabular-nums">{d.points.toLocaleString()}<span className="text-[18px]">P</span></p>
          </div>
        ) : (
          <div className="card p-4">
            <p className="small muted">방문한 {t.place}</p>
            <p className="font-serif text-[28px] font-bold tabular-nums">{d.sites.length}<span className="text-[18px]">곳</span></p>
          </div>
        )}
      </div>

      {empty && (
        <div className="card mt-8 text-center">
          <p>{t.noStamps}</p>
          <Link href="/regions" className="btn btn-primary btn-block mt-5">{t.browse}</Link>
        </div>
      )}

      {d.last_visit_id && <QuickUpload d={d} code={primary} />}

      {/* ② 관광지별 묶음 */}
      <div className="mt-6 space-y-4">
        {d.sites.map((s) => (
          <section key={s.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/sites/${s.id}`} className="subtitle hover:underline">{s.name}</Link>
              {s.completed_at ? (
                <span className="chip chip-done shrink-0">✔ {t.completed} {md(s.completed_at)}</span>
              ) : (
                <span className="chip chip-progress shrink-0 tabular-nums">{s.done}/{s.total}</span>
              )}
            </div>
            {!s.completed_at && (
              <div className="bar bar-thin mt-3" aria-hidden><i style={{ width: `${(s.done / Math.max(1, s.total)) * 100}%` }} /></div>
            )}
            {/* ③ 날짜별 → 지점 도장 */}
            {s.dates.map((g) => (
              <div key={g.date} className="mt-4">
                <p className="small font-semibold muted">{md(g.date)}{g.date === d.today && ' · 오늘'}</p>
                <ul className="mt-1 divide-y divide-line">
                  {g.visits.map((v) => {
                    const n = order.get(v.id);
                    return (
                      <li
                        key={v.id}
                        className={n != null ? 'drop-in' : ''}
                        style={n != null ? { animationDelay: `${0.3 + n * 0.25}s` } : undefined}
                      >
                        <VisitRow v={v} limit={d.photo_limit} code={primary} siteName={s.name} date={g.date} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Shell>
  );
}

function VisitRow({ v, limit, code, siteName, date }) {
  const { service } = useService();
  const uploads = useUploads();
  const { showToast } = useService();
  const input = useRef(null);
  const full = v.photo_count >= limit;

  const pick = (files) => {
    if (!files?.length) return;
    const room = limit - v.photo_count;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) showToast(`사진은 한 곳에 ${limit}장까지 올릴 수 있어요`);
    uploads.enqueue(list, { visitId: v.id, token: code, label: `${siteName} · ${v.name} · ${md(date)}` });
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link href={`/me/visits/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunk small font-bold text-primary">{v.order}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{v.name}</span>
        <span className="small muted tabular-nums">{hm(v.tagged_at)}</span>
      </Link>
      {service === 'pilgrim' && (
        <Link href={`/me/visits/${v.id}/upload#note`} className="grid h-11 w-11 place-items-center rounded-full text-muted" aria-label={v.has_note ? '메모 보기' : '메모 쓰기'}>
          <span aria-hidden className={v.has_note ? 'text-primary' : ''}>{v.has_note ? '✎' : '✎+'}</span>
        </Link>
      )}
      {v.photo_count > 0 && full ? (
        <Link href={`/me/visits/${v.id}`} className="chip">📷 {v.photo_count}</Link>
      ) : (
        <>
          <button className="chip min-h-[44px] px-3" onClick={() => input.current?.click()} aria-label="사진 등록">
            📷 {v.photo_count > 0 ? `${v.photo_count}+` : '+'}
          </button>
          <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
        </>
      )}
    </div>
  );
}

/** 키링을 대서 열린 화면에서 바로 여러 장 올리기 (D1). 붙일 지점 기본값 = 가장 최근 도장 지점 */
function QuickUpload({ d, code }) {
  const { t, showToast } = useService();
  const uploads = useUploads();
  const input = useRef(null);
  const all = useMemo(
    () => d.sites.flatMap((s) => s.dates.flatMap((g) => g.visits.map((v) => ({ ...v, site: s.name, date: g.date })))).sort((a, b) => (a.tagged_at < b.tagged_at ? 1 : -1)),
    [d],
  );
  const [target, setTarget] = useState(d.last_visit_id);
  const v = all.find((x) => x.id === target) ?? all[0];
  if (!v) return null;
  const room = d.photo_limit - v.photo_count;

  return (
    <div className="card mt-6">
      <label className="section-label block" htmlFor="qu-target">{t.attachTo}</label>
      <select id="qu-target" className="input mt-2" value={v.id} onChange={(e) => setTarget(e.target.value)}>
        {all.map((x) => (
          <option key={x.id} value={x.id}>
            {x.site} · {x.name} · {md(x.date)} ({x.photo_count}/{d.photo_limit})
          </option>
        ))}
      </select>
      <button className="btn btn-primary btn-block mt-3" disabled={room <= 0 || uploads.active} onClick={() => input.current?.click()}>
        {room <= 0 ? `이 지점은 사진 ${d.photo_limit}장이 다 찼어요` : `📷 사진 올리기 (최대 ${room}장)`}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          if (files.length > room) showToast(`사진은 한 곳에 ${d.photo_limit}장까지 올릴 수 있어요`);
          uploads.enqueue(files.slice(0, room), { visitId: v.id, token: code, label: `${v.site} · ${v.name} · ${md(v.date)}` });
        }}
      />
    </div>
  );
}
