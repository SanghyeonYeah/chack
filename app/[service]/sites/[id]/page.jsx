'use client';
// T-U-05 관광지 상세 (코스 · 지도 · 안내) / P-U-04 성지 상세 (+ 신부님)

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Shell, { ErrorBox, Loading, Progress } from '@/components/user/Shell';
import KakaoMap, { directionsUrl } from '@/components/KakaoMap';
import { useService } from '@/components/user/ServiceProvider';
import { PhotoPlaceholder } from '@/components/user/Stamp';
import { api, errorText } from '@/lib/client/api';
import { mediaUrl } from '@/lib/media';
import { md } from '@/lib/format';

export default function SitePage({ params }) {
  const { id } = use(params);
  const { service, t, primary, ready } = useService();
  const router = useRouter();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);

  const load = () => {
    setError(null);
    api(`/api/sites/${id}`, { token: primary })
      .then(setD)
      .catch((e) => setError(errorText(e, t)));
  };
  useEffect(() => {
    if (ready) load();
  }, [ready, primary, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const points = useMemo(
    () =>
      (d?.checkpoints ?? []).map((c, i) => ({
        id: c.id, lat: c.lat, lng: c.lng, label: String(i + 1), title: c.name, done: Boolean(c.stamped_at),
      })),
    [d],
  );

  if (error) return <Shell back={{ href: '/sites' }}><ErrorBox message={error} onRetry={load} /></Shell>;
  if (!d) return <Shell><Loading /></Shell>;

  const s = d.site;
  const done = d.checkpoints.filter((c) => c.stamped_at).length;
  const total = d.checkpoints.length;
  const photos = (s.photo_paths ?? []).map(mediaUrl);
  const info = [
    ['주소', s.address],
    [service === 'pilgrim' ? '개방 시간' : '운영시간', s.opening_hours],
    ['휴무일', s.closed_days],
    service === 'tour' && ['입장료', s.admission_fee],
    ['주차', s.parking],
    ['문의', s.phone],
  ].filter((x) => x && x[1]);

  return (
    <Shell back={{ href: `/sites?region=${s.region_id}`, label: d.region?.name ?? '목록' }}>
      <h1 className="title">{s.name}</h1>
      {service === 'pilgrim' && s.diocese && <p className="muted mt-1">{s.diocese}</p>}

      {/* ① 지도 */}
      <div className="mt-5">
        <KakaoMap
          points={points}
          center={s.lat != null ? { lat: s.lat, lng: s.lng } : undefined}
          showMe
          fallback={s.address}
          onMarkerClick={(p) => router.push(`/sites/${id}/cp/${p.id}`)}
        />
      </div>
      {/* ② 길찾기 */}
      {s.lat != null && (
        <a href={directionsUrl(s.name, s.lat, s.lng)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block mt-3">
          길찾기 (카카오맵 열기)
        </a>
      )}

      {/* ③ 소개 */}
      <section className="mt-8">
        {photos.length > 0 ? (
          <div className="swipe rounded-[var(--r-card)]">
            {photos.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`${s.name} 사진 ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-[var(--r-card)] object-cover" />
            ))}
          </div>
        ) : (
          <PhotoPlaceholder className="aspect-[4/3] w-full rounded-[var(--r-card)]" label="대표 사진" />
        )}
        {s.intro && (
          <div className="mt-4">
            <p className={`whitespace-pre-line ${more ? '' : 'line-clamp-3'}`}>{s.intro}</p>
            {!more && s.intro.length > 80 && (
              <button className="mt-1 small font-semibold text-primary underline underline-offset-4" onClick={() => setMore(true)}>
                더보기
              </button>
            )}
          </div>
        )}
        {service === 'pilgrim' && s.history_text && (
          <details className="card mt-4">
            <summary className="cursor-pointer font-semibold">성지 역사 · 순교자 이야기</summary>
            <p className="mt-3 whitespace-pre-line">{s.history_text}</p>
          </details>
        )}
        {info.length > 0 && (
          <dl className="card mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="muted">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {service === 'pilgrim' && (s.mass_times || s.group_contact) && (
          <div className="card mt-4 space-y-3">
            <p className="font-semibold">미사 · 방문 안내</p>
            {s.mass_times && <p className="whitespace-pre-line"><span className="muted">미사 시간 · </span>{s.mass_times}</p>}
            {s.group_contact && <p className="whitespace-pre-line"><span className="muted">단체 순례 문의 · </span>{s.group_contact}</p>}
          </div>
        )}
      </section>

      {/* 신부님 소개: 표시 켜진 분만, 0명이면 영역 숨김 */}
      {service === 'pilgrim' && d.priests?.length > 0 && (
        <section className="mt-8 space-y-3">
          <p className="section-label">신부님</p>
          {d.priests.map((p) => (
            <div key={p.id} className="card flex gap-4">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(p.photo_url)} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
              ) : (
                <PhotoPlaceholder className="h-20 w-20 shrink-0 rounded-full" />
              )}
              <div>
                <p className="subtitle text-[19px]">
                  {p.name}
                  {p.baptismal_name && <span className="font-sans text-[16px] muted"> ({p.baptismal_name})</span>}
                </p>
                {p.role_title && <p className="small muted">{p.role_title}</p>}
                {p.greeting && <p className="mt-2">{p.greeting}</p>}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ④ 내 코스 진행 */}
      <section className="card mt-8">
        <Progress done={done} total={total} label={d.completed_at ? `✔ ${t.completed} ${md(d.completed_at)}` : t.progressLabel(done, total)} />
      </section>

      {/* ⑤ 코스 목록 */}
      <ol className="mt-4 space-y-2">
        {d.checkpoints.map((c, i) => (
          <li key={c.id}>
            <Link href={`/sites/${id}/cp/${c.id}`} className="card flex items-center gap-4 p-4 hover:border-primary">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-primary font-bold ${c.stamped_at ? 'bg-primary text-on-primary' : 'text-primary'}`}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.name}</span>
                {c.summary && <span className="block truncate small muted">{c.summary}</span>}
              </span>
              {c.stamped_at && <span className="chip chip-done shrink-0">✔ {md(c.stamped_at)}</span>}
            </Link>
          </li>
        ))}
      </ol>

      {/* ⑥ 안내 */}
      <p className="mt-6 rounded-[var(--r-card)] bg-sunk p-4 small">{t.guide}</p>
    </Shell>
  );
}
