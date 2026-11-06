'use client';
// T-U-08 사진 등록 / P-U-07 사진 · 메모 등록

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import { useService } from '@/components/user/ServiceProvider';
import { useUploads } from '@/components/user/UploadProvider';
import { api, errorText } from '@/lib/client/api';
import { md } from '@/lib/format';

export default function UploadPage({ params }) {
  const { visitId } = use(params);
  const { service, t, primary, ready, showToast } = useService();
  const uploads = useUploads();
  const router = useRouter();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    if (!ready || !primary) return;
    api(`/api/visits/${visitId}`, { token: primary })
      .then((r) => {
        setD(r);
        setNote(r.note?.body ?? '');
      })
      .catch((e) => setError(errorText(e, t)));
  }, [ready, primary, visitId, t]);

  const previews = files.map((f) => ({ f, url: URL.createObjectURL(f) }));
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)));

  if (ready && !primary) return <Shell><ErrorBox message="키링을 폰 뒷면에 대 주세요" /></Shell>;
  if (error) return <Shell back={{ href: '/me' }}><ErrorBox message={error} /></Shell>;
  if (!d) return <Shell><Loading /></Shell>;

  const room = d.photo_limit - d.photos.length;
  const label = `${d.site.name} · ${d.checkpoint.name} · ${md(d.visit.visit_date)}`;

  const add = (list) => {
    const all = [...files, ...Array.from(list)];
    if (all.length > room) showToast(`사진은 한 곳에 ${d.photo_limit}장까지 올릴 수 있어요`);
    setFiles(all.slice(0, Math.max(0, room)));
  };

  const submit = () => {
    if (!files.length) return;
    uploads.enqueue(files, { visitId, token: primary, label });
    router.push(`/me/visits/${visitId}`);
  };

  const saveNote = async () => {
    setSaving(true);
    try {
      if (note.trim()) await api(`/api/visits/${visitId}/note`, { method: 'PUT', token: primary, body: { body: note } });
      else await api(`/api/visits/${visitId}/note`, { method: 'DELETE', token: primary });
      showToast(note.trim() ? '메모를 저장했어요' : '메모를 지웠어요');
      router.push(`/me/visits/${visitId}`);
    } catch (e) {
      showToast(errorText(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell back={{ href: `/me/visits/${visitId}` }}>
      <p className="section-label">{service === 'pilgrim' ? '사진 · 메모 등록' : '사진 등록'}</p>
      <h1 className="title mt-1 text-[24px]">{label}</h1>

      <section className="card mt-6">
        <p className="font-semibold">사진 <span className="small muted">({d.photos.length + files.length} / {d.photo_limit}장)</span></p>
        {room <= 0 ? (
          <p className="mt-3 muted">사진은 한 곳에 {d.photo_limit}장까지 올릴 수 있어요</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {previews.map((p, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="aspect-square w-full rounded-lg bg-sunk object-cover" />
                  <button
                    className="absolute top-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
                    onClick={() => setFiles(files.filter((_, n) => n !== i))}
                    aria-label="선택 취소"
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.length < room && (
                <button className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-line text-muted" onClick={() => input.current?.click()}>
                  <span className="text-center small">＋<br />사진 선택</span>
                </button>
              )}
            </div>
            <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { add(e.target.files ?? []); e.target.value = ''; }} />
            <p className="mt-3 small muted">JPG · PNG · HEIC. 올리기 전에 긴 변 1600px로 줄여요.</p>
            <button className="btn btn-primary btn-block mt-4" disabled={!files.length || uploads.active} onClick={submit}>
              등록
            </button>
          </>
        )}
      </section>

      {service === 'pilgrim' && (
        <section id="note" className="card mt-6 scroll-mt-6">
          <label htmlFor="note-body" className="font-semibold">순례 메모 <span className="small muted">· 나만 볼 수 있어요</span></label>
          <textarea
            id="note-body"
            className="input textarea mt-3"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="기도와 느낌을 남겨 보세요"
          />
          <p className="mt-1 text-right small muted tabular-nums">{[...note].length} / 500</p>
          <button className="btn btn-secondary btn-block mt-2" disabled={saving} onClick={saveNote}>
            {saving ? '저장 중…' : '메모 저장'}
          </button>
        </section>
      )}
    </Shell>
  );
}
