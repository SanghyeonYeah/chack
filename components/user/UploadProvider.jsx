'use client';
/**
 * 사진 업로드 대기열 + 하단 진행 오버레이 (D1)
 * - 여러 장을 한 번에 골라 차례로 올림. 화면을 옮겨 다녀도 계속 올라감(레이아웃에 상주)
 * - 키링을 다시 폰에 대면(/k/코드가 다시 열리면) 진행 중인 업로드를 멈춤 (BroadcastChannel로 다른 탭에도 전달)
 * - 업로드 중에는 화면 꺼짐 방지(가능한 기기만). 웹은 백그라운드 업로드가 안 되므로 화면을 켠 채로 둠
 * - 실패한 사진은 [다시 시도]
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { prepareImage, uploadBlob } from '@/lib/client/image';
import { api, ApiError } from '@/lib/client/api';
import { useService } from './ServiceProvider';

const Ctx = createContext(null);
const CHANNEL = 'chak-upload';
let seq = 0;

export default function UploadProvider({ children }) {
  const { showToast } = useService();
  const [items, setItems] = useState([]); // {id, file, visitId, token, label, status, progress, error}
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const runningRef = useRef(false);
  const abortRef = useRef(null);
  const stoppedRef = useRef(false);
  const listeners = useRef(new Set());
  const wakeRef = useRef(null);

  const patch = (id, p) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const stopAll = useCallback(
    (reason) => {
      const active = itemsRef.current.some((it) => it.status === 'waiting' || it.status === 'uploading');
      if (!active) return false;
      stoppedRef.current = true;
      abortRef.current?.abort();
      setItems((list) =>
        list.map((it) => (it.status === 'waiting' || it.status === 'uploading' ? { ...it, status: 'stopped', progress: 0 } : it)),
      );
      if (reason) showToast(reason);
      return true;
    },
    [showToast],
  );

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    stoppedRef.current = false;
    try {
      wakeRef.current = await navigator.wakeLock?.request('screen');
    } catch {
      /* 지원 안 함 */
    }
    try {
      for (;;) {
        if (stoppedRef.current) break;
        const it = itemsRef.current.find((x) => x.status === 'waiting');
        if (!it) break;
        const ac = new AbortController();
        abortRef.current = ac;
        patch(it.id, { status: 'uploading', progress: 0.02, error: null });
        try {
          const { blob, width, height } = await prepareImage(it.file);
          if (ac.signal.aborted) throw Object.assign(new Error('ABORTED'), { name: 'AbortError' });
          const prep = await api(`/api/visits/${it.visitId}/photos`, { method: 'POST', token: it.token, body: { step: 'prepare' }, signal: ac.signal });
          await uploadBlob(prep.upload_url, blob, { signal: ac.signal, onProgress: (p) => patch(it.id, { progress: 0.05 + p * 0.9 }) });
          await api(`/api/visits/${it.visitId}/photos`, { method: 'POST', token: it.token, body: { step: 'commit', path: prep.path, width, height } });
          patch(it.id, { status: 'done', progress: 1 });
          listeners.current.forEach((fn) => fn(it.visitId));
        } catch (e) {
          if (e?.name === 'AbortError') {
            patch(it.id, { status: 'stopped', progress: 0 });
            break;
          }
          const msg =
            e instanceof ApiError && e.code === 'PHOTO_LIMIT'
              ? `사진은 한 곳에 ${e.data?.limit ?? 3}장까지 올릴 수 있어요`
              : e?.message === 'TOO_LARGE' || e?.code === 'TOO_LARGE'
                ? '사진 용량이 너무 커요 (5MB까지)'
                : e?.message === 'NOT_IMAGE'
                  ? '사진 파일만 올릴 수 있어요'
                  : '사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요';
          patch(it.id, { status: e?.code === 'PHOTO_LIMIT' ? 'rejected' : 'failed', error: msg, progress: 0 });
        }
      }
    } finally {
      abortRef.current = null;
      runningRef.current = false;
      try {
        await wakeRef.current?.release();
      } catch {
        /* noop */
      }
      wakeRef.current = null;
    }
  }, []);

  const enqueue = useCallback(
    (files, { visitId, token, label }) => {
      const add = Array.from(files).map((file) => ({
        id: ++seq, file, visitId, token, label, status: 'waiting', progress: 0, error: null,
      }));
      setItems((list) => [...list.filter((x) => x.status !== 'done'), ...add]);
      itemsRef.current = [...itemsRef.current.filter((x) => x.status !== 'done'), ...add];
      void run();
    },
    [run],
  );

  const retry = useCallback(() => {
    setItems((list) => list.map((it) => (it.status === 'failed' || it.status === 'stopped' ? { ...it, status: 'waiting', error: null } : it)));
    itemsRef.current = itemsRef.current.map((it) => (it.status === 'failed' || it.status === 'stopped' ? { ...it, status: 'waiting', error: null } : it));
    void run();
  }, [run]);

  const clear = useCallback(() => setItems([]), []);

  // 다른 탭에서 키링을 다시 대면 멈춤
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => {
      if (e.data === 'stop') stopAll('키링을 다시 대서 사진 올리기를 멈췄어요');
    };
    return () => ch.close();
  }, [stopAll]);

  // 업로드 중 페이지를 닫으려 하면 경고
  const active = items.some((it) => it.status === 'waiting' || it.status === 'uploading');
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [active]);

  const onUploaded = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return (
    <Ctx.Provider value={{ items, active, enqueue, stopAll, retry, clear, onUploaded }}>
      {children}
      <UploadOverlay items={items} onStop={() => stopAll()} onRetry={retry} onClose={clear} />
    </Ctx.Provider>
  );
}

export function useUploads() {
  return useContext(Ctx);
}

/** /k/코드 진입 시 호출: 이 탭과 다른 탭의 업로드를 멈춤. 멈춘 게 있으면 true */
export function broadcastStop() {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage('stop');
    ch.close();
  } catch {
    /* 미지원 */
  }
}

function UploadOverlay({ items, onStop, onRetry, onClose }) {
  if (items.length === 0) return null;
  const total = items.filter((i) => i.status !== 'rejected').length;
  const done = items.filter((i) => i.status === 'done').length;
  const current = items.find((i) => i.status === 'uploading');
  const waiting = items.filter((i) => i.status === 'waiting').length;
  const failed = items.filter((i) => i.status === 'failed' || i.status === 'stopped');
  const rejected = items.filter((i) => i.status === 'rejected');
  const running = Boolean(current) || waiting > 0;
  const pct = total ? ((done + (current?.progress ?? 0)) / total) * 100 : 100;

  return (
    <div className="sheet" role="status" aria-live="polite">
      <div className="sheet-inner">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">
              {running
                ? `사진 올리는 중 · ${Math.min(done + 1, total)} / ${total}`
                : failed.length
                  ? `사진 ${failed.length}장을 올리지 못했어요`
                  : `사진 ${done}장을 올렸어요`}
            </p>
            <p className="small muted truncate">
              {running
                ? `${current?.label ?? ''} · 화면을 켠 채로 기다려 주세요. 키링을 다시 대면 멈춰요`
                : failed[0]?.error ?? rejected[0]?.error ?? items[0]?.label}
            </p>
          </div>
          {running ? (
            <button className="btn btn-secondary btn-sm shrink-0" onClick={onStop}>
              멈추기
            </button>
          ) : failed.length ? (
            <button className="btn btn-primary btn-sm shrink-0" onClick={onRetry}>
              다시 시도
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm shrink-0" onClick={onClose} aria-label="닫기">
              닫기
            </button>
          )}
        </div>
        <div className="bar bar-thin mt-3" aria-hidden>
          <i style={{ width: `${pct}%`, background: 'var(--c-accent)' }} />
        </div>
      </div>
    </div>
  );
}
