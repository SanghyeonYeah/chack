'use client';
// T-U-09 방문 추억 상세 (기억 소환) / P-U-08 순례 추억 (+ 메모)

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import { useService } from '@/components/user/ServiceProvider';
import { useUploads } from '@/components/user/UploadProvider';
import { PhotoPlaceholder } from '@/components/user/Stamp';
import { cachedApi, api, errorText } from '@/lib/client/api';
import { mediaUrl } from '@/lib/media';
import { daysAgo, full, md } from '@/lib/format';

export default function VisitPage({ params }) {
  const { visitId } = use(params);
  const { service, t, primary, ready, showToast } = useService();
  const uploads = useUploads();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [slide, setSlide] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const input = useRef(null);

  const load = () => {
    setError(null);
    cachedApi(`/api/visits/${visitId}`, { token: primary, onCached: setD }).then(setD).catch((e) => setError(errorText(e, t)));
  };
  useEffect(() => {
    if (ready && primary) load();
  }, [ready, primary, visitId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => uploads?.onUploaded((vid) => vid === visitId && load()), [uploads, visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ready && !primary) return <Shell><ErrorBox message="키링을 폰 뒷면에 대 주세요" /></Shell>;
  if (error) return <Shell back={{ href: '/me' }}><ErrorBox message={error} onRetry={load} /></Shell>;
  if (!d) return <Shell><Loading /></Shell>;

  const ago = daysAgo(d.visit.tagged_at);
  const room = d.photo_limit - d.photos.length;
  const fallback = (d.checkpoint.photo_paths ?? [])[0];

  const del = async (photo) => {
    setConfirm(null);
    try {
      await api(`/api/visits/${visitId}/photos?photo=${photo.id}`, { method: 'DELETE', token: primary });
      showToast('사진을 삭제했어요');
      setSlide(0);
      load();
    } catch (e) {
      showToast(errorText(e, t));
    }
  };

  return (
    <Shell back={{ href: '/me', label: t.recordTitle }}>
      {ago >= 30 && <p className="fade-up mb-4 font-serif text-[20px] font-semibold text-primary">{t.ago(ago)}</p>}

      {d.photos.length > 0 ? (
        <>
          <div className="swipe rounded-[var(--r-card)]" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {d.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt={`내 사진 ${i + 1}`} className="aspect-[4/3] w-full rounded-[var(--r-card)] bg-sunk object-cover" />
            ))}
          </div>
          {d.photos.length > 1 && (
            <div className="dots mt-3" aria-hidden>{d.photos.map((p, i) => <i key={p.id} data-on={i === slide} />)}</div>
          )}
        </>
      ) : (
        <div className="relative">
          {fallback ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(fallback)} alt="" className="aspect-[4/3] w-full rounded-[var(--r-card)] object-cover opacity-80" />
          ) : (
            <PhotoPlaceholder className="aspect-[4/3] w-full rounded-[var(--r-card)]" />
          )}
          <p className="absolute inset-x-0 bottom-0 rounded-b-[var(--r-card)] bg-black/45 p-3 text-center font-semibold text-white">사진을 남겨 보세요</p>
        </div>
      )}

      <p className="section-label mt-6">{d.site.name}</p>
      <h1 className="title mt-1">{d.checkpoint.name}</h1>
      <p className="muted mt-1 tabular-nums">{full(d.visit.tagged_at)}</p>
      {d.checkpoint.summary && <p className="mt-5 whitespace-pre-line">{d.checkpoint.summary}</p>}

      {service === 'pilgrim' && (
        <section className="card mt-6">
          <div className="flex items-center justify-between">
            <p className="font-semibold">순례 메모 <span className="small muted">· 나만 보기</span></p>
            <Link href={`/me/visits/${visitId}/upload#note`} className="small font-semibold text-primary underline underline-offset-4">
              {d.note ? '수정' : '쓰기'}
            </Link>
          </div>
          <p className={`mt-3 whitespace-pre-line ${d.note ? '' : 'muted'}`}>{d.note?.body ?? '기도와 느낌을 남겨 보세요'}</p>
        </section>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="btn btn-primary" disabled={room <= 0 || uploads.active} onClick={() => input.current?.click()}>
          사진 추가
        </button>
        <button className="btn btn-secondary" disabled={!d.photos.length} onClick={() => setConfirm(d.photos[slide] ?? d.photos[0])}>
          사진 삭제
        </button>
      </div>
      <p className="mt-2 text-center small muted">사진 {d.photos.length} / {d.photo_limit}장</p>
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
          uploads.enqueue(files.slice(0, room), { visitId, token: primary, label: `${d.site.name} · ${d.checkpoint.name} · ${md(d.visit.visit_date)}` });
        }}
      />

      {confirm && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="modal">
            <p id="del-title" className="subtitle">사진을 삭제할까요?</p>
            <p className="muted mt-2">삭제한 사진은 되돌릴 수 없어요</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>취소</button>
              <button className="btn btn-primary" onClick={() => del(confirm)}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
