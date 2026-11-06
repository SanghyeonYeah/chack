'use client';
// T-U-06 지점 상세 / P-U-05 지점 상세

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import KakaoMap from '@/components/KakaoMap';
import { useService } from '@/components/user/ServiceProvider';
import { PhotoPlaceholder } from '@/components/user/Stamp';
import { api, errorText } from '@/lib/client/api';
import { mediaUrl } from '@/lib/media';
import { md, hm } from '@/lib/format';

export default function CheckpointPage({ params }) {
  const { id, cpId } = use(params);
  const { t, primary, ready } = useService();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [slide, setSlide] = useState(0);

  const load = () => {
    setError(null);
    api(`/api/sites/${id}`, { token: primary }).then(setD).catch((e) => setError(errorText(e, t)));
  };
  useEffect(() => {
    if (ready) load();
  }, [ready, primary, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Shell back={{ href: `/sites/${id}` }}><ErrorBox message={error} onRetry={load} /></Shell>;
  if (!d) return <Shell><Loading /></Shell>;

  const list = d.checkpoints;
  const idx = list.findIndex((c) => c.id === cpId);
  const c = list[idx];
  if (!c) return <Shell back={{ href: `/sites/${id}` }}><ErrorBox message="지점을 찾을 수 없어요" /></Shell>;
  const prev = list[idx - 1];
  const next = list[idx + 1];
  const photos = (c.photo_paths ?? []).map(mediaUrl);

  return (
    <Shell back={{ href: `/sites/${id}`, label: d.site.name }}>
      {photos.length > 0 ? (
        <>
          <div className="swipe rounded-[var(--r-card)]" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {photos.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`${c.name} 사진 ${i + 1}`} className="aspect-[4/3] w-full rounded-[var(--r-card)] object-cover" />
            ))}
          </div>
          {photos.length > 1 && (
            <div className="dots mt-3" aria-hidden>
              {photos.map((_, i) => <i key={i} data-on={i === slide} />)}
            </div>
          )}
        </>
      ) : (
        <PhotoPlaceholder className="aspect-[4/3] w-full rounded-[var(--r-card)]" label="지점 사진" />
      )}

      <p className="section-label mt-6">{idx + 1}번 지점</p>
      <h1 className="title mt-1">{c.name}</h1>
      <p className={`mt-3 font-semibold ${c.stamped_at ? 'text-success' : 'muted'}`}>
        {c.stamped_at ? `✔ ${t.stampedAt(`${md(c.stamped_at)} ${hm(c.stamped_at)}`)}` : t.notStamped}
      </p>
      {(c.description || c.summary) && <p className="mt-5 whitespace-pre-line">{c.description || c.summary}</p>}

      {c.lat != null && (
        <div className="mt-6">
          <KakaoMap points={[{ id: c.id, lat: c.lat, lng: c.lng, label: String(idx + 1), title: c.name, done: Boolean(c.stamped_at) }]} height={200} level={3} showMe />
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3">
        {prev ? (
          <Link href={`/sites/${id}/cp/${prev.id}`} className="btn btn-secondary">← {prev.name}</Link>
        ) : <span />}
        {next ? (
          <Link href={`/sites/${id}/cp/${next.id}`} className="btn btn-secondary">{next.name} →</Link>
        ) : <span />}
      </div>
    </Shell>
  );
}
