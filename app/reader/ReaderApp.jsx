'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearQueue, enqueue, peekQueue, queueCount, removeFromQueue, QUEUE_MAX } from '@/lib/reader/queue';
import { normalizeUid, readCodeFromMessage } from '@/lib/reader/nfc';
import { messageFor } from '@/lib/reader/messages';

// 기기 저장 설정: { readerId, readerToken, readerName, checkpointName, siteName, service, pinHash }
const CONFIG_KEY = 'chak.reader.config.v1';
const SEND_TIMEOUT_MS = 3000; // 3초 안에 응답 없으면 기기에 저장 (C3)
const DUP_WINDOW_MS = 10_000; // 같은 키링 10초 내 재감지 무시 (R-01 ②)
const FLUSH_INTERVAL_MS = 20_000;
const HEARTBEAT_INTERVAL_MS = 60_000;

const REGISTER_ERRORS = {
  CODE_INVALID: '등록 코드가 맞지 않거나 24시간이 지났어요. 관리자에게 새 코드를 받아 주세요.',
  READER_INACTIVE: '비활성화된 리더예요. 관리자에게 문의해 주세요.',
  NO_CHECKPOINT: '이 리더에 연결된 지점이 없어요. 관리자 화면에서 지점을 지정해 주세요.',
  WRONG_HOST: '이 리더는 다른 웹 주소에서 열어야 해요.',
  BLOCKED: '여러 번 틀려서 잠시 막혔어요. 잠시 후 다시 시도해 주세요.',
};

async function postJson(url, body, token, timeoutMs = SEND_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: ac.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(config) {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(CONFIG_KEY);
}

export default function ReaderApp() {
  const [config, setConfig] = useState(null);
  // loading | unsupported | register | start | scanning | pin | settings | setup-needed
  const [screen, setScreen] = useState('loading');
  const [display, setDisplay] = useState(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState(null);
  const [regCode, setRegCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const configRef = useRef(null);
  const screenRef = useRef('loading');
  configRef.current = config;
  screenRef.current = screen;

  const recentRef = useRef(new Map());
  const displayTimer = useRef(null);
  const flushingRef = useRef(false);
  const scanAbortRef = useRef(null);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await queueCount());
    } catch {
      /* IndexedDB 사용 불가 */
    }
  }, []);

  const show = useCallback((d) => {
    if (displayTimer.current) clearTimeout(displayTimer.current);
    setDisplay(d);
    displayTimer.current = setTimeout(() => setDisplay(null), d.ms);
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      await navigator.wakeLock?.request('screen'); // 화면 꺼짐 방지
    } catch {
      /* 지원 안 하면 무시 */
    }
  }, []);

  // R-01 → R-02: 태그 처리
  const handleTag = useCallback(
    async (code, chipUid) => {
      const cfg = configRef.current;
      if (!cfg || screenRef.current !== 'scanning') return;
      if (!code && !chipUid) {
        show(messageFor({ result: 'UNREADABLE' }, cfg.service));
        return;
      }
      const key = code ?? `uid:${chipUid}`;
      const now = Date.now();
      const last = recentRef.current.get(key);
      if (last && now - last < DUP_WINDOW_MS) return;
      recentRef.current.set(key, now);

      const item = { code, chip_uid: chipUid, tagged_at: new Date(now).toISOString() };
      try {
        const res = await postJson('/api/reader/stamp', { items: [item] }, cfg.readerToken);
        if (res.status === 401) {
          setScreen('setup-needed');
          return;
        }
        if (res.status >= 400 && res.status < 500) {
          show(messageFor({ result: 'ERROR' }, cfg.service));
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`); // 5xx → 기기에 저장
        const data = await res.json();
        const result = data?.results?.[0];
        if (!result) throw new Error('empty');
        navigator.vibrate?.(150);
        show(messageFor(result, cfg.service));
      } catch {
        const saved = await enqueue(item).catch(() => false);
        await refreshPending();
        show(
          saved
            ? { tone: 'info', title: '저장했어요!', lines: ['연결되면 자동으로 보낼게요'], ms: 2500 }
            : { tone: 'error', title: '저장 공간이 가득 찼어요', lines: ['인터넷 연결을 확인해 주세요'], ms: 3000 },
        );
      }
    },
    [refreshPending, show],
  );
  const handleTagRef = useRef(handleTag);
  handleTagRef.current = handleTag;

  const startScan = useCallback(async () => {
    if (!('NDEFReader' in window)) {
      setScreen('unsupported');
      return;
    }
    try {
      scanAbortRef.current?.abort();
      const ac = new AbortController();
      scanAbortRef.current = ac;
      const reader = new window.NDEFReader();
      reader.onreading = (ev) => {
        void handleTagRef.current(readCodeFromMessage(ev.message), normalizeUid(ev.serialNumber));
      };
      reader.onreadingerror = () => {
        if (screenRef.current === 'scanning') show(messageFor({ result: 'UNREADABLE' }, configRef.current?.service));
      };
      await reader.scan({ signal: ac.signal });
      setNotice(null);
      setScreen('scanning');
      void requestWakeLock();
    } catch {
      setScreen('start');
      setNotice('NFC를 켤 수 없어요. 기기 설정에서 NFC를 켜고, NFC 권한을 허용해 주세요.');
    }
  }, [requestWakeLock, show]);

  // 오프라인 대기열 전송
  const flush = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg || flushingRef.current || !navigator.onLine) return;
    flushingRef.current = true;
    try {
      for (;;) {
        const batch = await peekQueue(50);
        if (batch.length === 0) break;
        const res = await postJson(
          '/api/reader/stamp',
          { items: batch.map((b) => ({ code: b.code, chip_uid: b.chip_uid, tagged_at: b.tagged_at })) },
          cfg.readerToken,
          15_000,
        );
        if (res.status === 400) {
          await removeFromQueue(batch.map((b) => b.id)); // 형식 오류 묶음은 버림
          continue;
        }
        const data = await res.json().catch(() => null);
        const handled = Array.isArray(data?.results) ? data.results.length : 0;
        if (handled > 0) await removeFromQueue(batch.slice(0, handled).map((b) => b.id));
        if (res.status === 401) {
          setScreen('setup-needed');
          break;
        }
        if (!res.ok || handled < batch.length) break;
      }
    } catch {
      /* 연결 실패: 다음 주기에 다시 시도 */
    } finally {
      flushingRef.current = false;
      void refreshPending();
    }
  }, [refreshPending]);

  // 처음 열 때
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/reader-sw.js', { scope: '/reader' }).catch(() => {});
    }
    setOnline(navigator.onLine);
    void refreshPending();
    const cfg = loadConfig();
    configRef.current = cfg;
    setConfig(cfg);
    if (!('NDEFReader' in window)) {
      setScreen('unsupported');
      return;
    }
    if (!cfg) {
      setScreen('register');
      return;
    }
    (async () => {
      try {
        const status = await navigator.permissions.query({ name: 'nfc' });
        if (status.state === 'granted') {
          await startScan(); // 이미 허용된 기기는 자동 시작
          return;
        }
      } catch {
        /* 권한 조회 미지원 */
      }
      setScreen('start');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 연결 상태 · 주기적 재전송
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void flush();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    void flush();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
    };
  }, [flush]);

  // 리더 신호 (T-A-05 상태 표시용) + 이름·PIN 변경 반영
  const token = config?.readerToken;
  useEffect(() => {
    if (!token) return undefined;
    const beat = async () => {
      try {
        const res = await postJson('/api/reader/heartbeat', { pending: await queueCount() }, token, 5000);
        if (res.status === 401) {
          setScreen('setup-needed');
          return;
        }
        if (!res.ok) return;
        const d = await res.json();
        setConfig((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            readerName: d.reader_name ?? prev.readerName,
            checkpointName: d.checkpoint_name ?? prev.checkpointName,
            siteName: d.site_name ?? prev.siteName,
            pinHash: d.pin_hash ?? null,
          };
          saveConfig(next);
          return next;
        });
      } catch {
        /* 오프라인 */
      }
    };
    void beat();
    const t = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [token]);

  // 화면이 다시 보이면 꺼짐 방지 재요청
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && screenRef.current === 'scanning') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [requestWakeLock]);

  // R-03: 등록 · 설정
  const register = async () => {
    if (pending > 0) {
      setNotice(`보내지 못한 기록 ${pending}건이 있어요. 먼저 인터넷에 연결해 보내 주세요.`);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await postJson('/api/reader/register', { code: regCode.trim() }, undefined, 10_000);
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setNotice(REGISTER_ERRORS[d?.error] ?? '잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.');
        return;
      }
      const cfg = {
        readerId: d.reader_id,
        readerToken: d.reader_token,
        readerName: d.reader_name,
        checkpointName: d.checkpoint_name,
        siteName: d.site_name,
        service: d.service,
        pinHash: d.pin_hash ?? null,
      };
      saveConfig(cfg);
      configRef.current = cfg;
      setConfig(cfg);
      setRegCode('');
      setScreen('start');
    } catch {
      setNotice('인터넷 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const openSettings = () => {
    setNotice(null);
    if (config?.pinHash) {
      setPin('');
      setScreen('pin');
    } else {
      setScreen('settings');
    }
  };

  const closeSettings = () => {
    setNotice(null);
    if (!configRef.current) {
      setScreen('register');
      return;
    }
    const scanning = Boolean(scanAbortRef.current) && !scanAbortRef.current.signal.aborted;
    setScreen(scanning ? 'scanning' : 'start');
  };

  const checkPin = async () => {
    if (!config) return;
    const h = await sha256Hex(`${config.readerId}:${pin}`);
    setPin('');
    if (h === config.pinHash) {
      setNotice(null);
      setScreen('settings');
    } else {
      setNotice('PIN이 맞지 않아요.');
    }
  };

  const discardQueue = async () => {
    if (!window.confirm(`보내지 못한 기록 ${pending}건을 버릴까요? 되돌릴 수 없어요.`)) return;
    await clearQueue();
    await refreshPending();
  };

  const unregister = () => {
    if (pending > 0) {
      setNotice('보내지 못한 기록이 있어요. 먼저 보내거나 버려 주세요.');
      return;
    }
    if (!window.confirm('이 기기의 리더 등록을 해제할까요?')) return;
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    saveConfig(null);
    configRef.current = null;
    setConfig(null);
    setScreen('register');
  };

  const placeLabel = config?.service === 'pilgrim' ? '성지' : '관광지';

  const registerForm = (
    <form className="reader-form" onSubmit={(e) => { e.preventDefault(); void register(); }}>
      <input
        className="reader-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={regCode}
        onChange={(e) => setRegCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-label="6자리 등록 코드"
        placeholder="000000"
      />
      <button className="reader-btn" type="submit" disabled={busy || regCode.length !== 6}>
        {busy ? '등록 중…' : '등록하기'}
      </button>
    </form>
  );

  return (
    <main className="reader" data-service={config?.service ?? 'tour'}>
      <header className="reader-bar">
        <span className={`reader-dot ${online ? 'is-on' : 'is-off'}`} aria-hidden />
        <span>{online ? '온라인' : '오프라인'}</span>
        {pending > 0 && <span className="reader-pending">대기 중인 전송 {pending}건</span>}
        {config && screen !== 'settings' && screen !== 'pin' && (
          <button className="reader-gear" onClick={openSettings}>설정</button>
        )}
      </header>

      {screen === 'loading' && (
        <section className="reader-center"><p className="reader-sub">불러오는 중…</p></section>
      )}

      {screen === 'unsupported' && (
        <section className="reader-center">
          <h1 className="reader-title">이 기기에서는 NFC를 쓸 수 없어요</h1>
          <p className="reader-sub">안드로이드 기기의 크롬 브라우저에서 https 주소로 열어 주세요.</p>
        </section>
      )}

      {screen === 'register' && (
        <section className="reader-center">
          <h1 className="reader-title">리더 등록</h1>
          <p className="reader-sub">관리자 화면에서 받은 6자리 등록 코드를 입력해 주세요.</p>
          {registerForm}
          {notice && <p className="reader-notice" role="alert">{notice}</p>}
        </section>
      )}

      {screen === 'start' && config && (
        <section className="reader-center">
          <h1 className="reader-checkpoint">{config.checkpointName}</h1>
          <p className="reader-site">{config.siteName}</p>
          <button className="reader-btn is-big" onClick={() => void startScan()}>리더 시작</button>
          <p className="reader-sub">처음 한 번은 NFC 사용 권한을 허용해 주세요.</p>
          {notice && <p className="reader-notice" role="alert">{notice}</p>}
        </section>
      )}

      {screen === 'scanning' && config && (
        <section className="reader-center">
          <h1 className="reader-checkpoint">{config.checkpointName}</h1>
          <p className="reader-site">{config.siteName}</p>
          <p className="reader-guide">키링을 여기에 대 주세요</p>
          <div className="reader-target" aria-hidden>
            <span className="reader-arrow">↓</span>
          </div>
          <p className="reader-sub">화살표 쪽(기기의 NFC 위치)에 키링을 대 주세요</p>
        </section>
      )}

      {screen === 'setup-needed' && (
        <section className="reader-center">
          <h1 className="reader-title">리더 설정이 필요해요</h1>
          <p className="reader-sub">관리자에게 리더 상태를 확인한 뒤, 설정에서 새 등록 코드로 다시 등록해 주세요.</p>
          <div className="reader-actions">
            <button className="reader-btn" onClick={openSettings}>설정 열기</button>
            <button className="reader-btn is-ghost" onClick={() => void startScan()}>다시 시작</button>
          </div>
        </section>
      )}

      {screen === 'pin' && (
        <section className="reader-center">
          <h1 className="reader-title">설정 PIN</h1>
          <form className="reader-form" onSubmit={(e) => { e.preventDefault(); void checkPin(); }}>
            <input
              className="reader-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              aria-label="설정 PIN"
            />
            <button className="reader-btn" type="submit" disabled={pin.length < 4}>확인</button>
            <button className="reader-btn is-ghost" type="button" onClick={closeSettings}>취소</button>
          </form>
          {notice && <p className="reader-notice" role="alert">{notice}</p>}
        </section>
      )}

      {screen === 'settings' && config && (
        <section className="reader-center">
          <h1 className="reader-title">리더 설정</h1>
          <dl className="reader-info">
            <dt>{placeLabel}</dt><dd>{config.siteName}</dd>
            <dt>지점</dt><dd>{config.checkpointName}</dd>
            <dt>리더 이름</dt><dd>{config.readerName}</dd>
            <dt>연결</dt><dd>{online ? '온라인' : '오프라인'}</dd>
            <dt>대기 중인 전송</dt><dd>{pending}건 (최대 {QUEUE_MAX}건 저장)</dd>
          </dl>
          <div className="reader-actions">
            <button className="reader-btn" onClick={() => void flush()} disabled={pending === 0 || !online}>지금 보내기</button>
            <p className="reader-sub">다른 지점으로 옮기려면 새 등록 코드를 입력하세요.</p>
            {registerForm}
            {pending > 0 && (
              <button className="reader-btn is-danger" onClick={() => void discardQueue()}>보내지 못한 기록 버리기</button>
            )}
            <button className="reader-btn is-danger" onClick={unregister}>이 기기 등록 해제</button>
            <button className="reader-btn is-ghost" onClick={closeSettings}>닫기</button>
            {notice && <p className="reader-notice" role="alert">{notice}</p>}
          </div>
        </section>
      )}

      {display && (
        <div className={`reader-result tone-${display.tone}`} role="status" aria-live="assertive">
          <p className="reader-result-title">{display.title}</p>
          {display.lines.filter(Boolean).map((line, i) => (
            <p key={i} className="reader-result-line">{line}</p>
          ))}
        </div>
      )}
    </main>
  );
}
