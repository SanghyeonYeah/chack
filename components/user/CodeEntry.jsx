'use client';
// 키링 미연결 안내 + 코드 직접 입력 (T-U-07 ③, 13장)

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/client/api';
import { normalizeKeyringCode, isKeyringCodeFormat } from '@/lib/keyring-code';
import { rememberKeyring } from '@/lib/client/keyrings';
import { useService } from './ServiceProvider';

export default function CodeEntry({ intro = true, next = '/me' }) {
  const { service, t } = useService();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const c = normalizeKeyringCode(code);
    if (!isKeyringCodeFormat(c)) {
      setError('키링 뒷면의 8자리 코드를 입력해 주세요');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tokens/${c}?via=manual`);
      const { isNew, others } = rememberKeyring(service, c);
      const q = new URLSearchParams({ via: 'manual' });
      if (isNew) q.set('first', '1');
      if (others > 0) q.set('multi', String(others + 1));
      router.push(`${next}?${q}`);
    } catch (err) {
      if (err.code === 'OTHER_SERVICE' && err.data?.redirect) {
        window.location.href = err.data.redirect;
        return;
      }
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      {intro && (
        <div className="mb-5 text-center">
          <KeyringIllustration />
          <p className="subtitle mt-3">키링을 폰 뒷면에 대 주세요</p>
          <p className="muted mt-1">폰에 키링을 대면 {t.record}이 바로 열려요</p>
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="code" className="section-label block">
          NFC가 안 되나요? 키링 뒷면의 8자리 코드를 입력해 주세요
        </label>
        <input
          id="code"
          className="input text-center font-semibold uppercase tracking-[.3em]"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          placeholder="K7MX2PQA"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
        />
        {error && (
          <p className="small font-semibold text-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy || code.length !== 8}>
          {busy ? '확인 중…' : '기록 열기'}
        </button>
      </form>
    </div>
  );
}

function KeyringIllustration() {
  return (
    <svg viewBox="0 0 160 110" width="160" height="110" className="mx-auto" aria-hidden>
      <rect x="70" y="8" width="62" height="96" rx="10" fill="var(--c-surface)" stroke="var(--c-ink)" strokeWidth="3" />
      <rect x="90" y="16" width="22" height="4" rx="2" fill="var(--c-line)" />
      <path d="M48 50c6-6 6-16 0-22M58 58c10-10 10-28 0-38" fill="none" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <circle cx="30" cy="64" r="20" fill="none" stroke="var(--c-stamp)" strokeWidth="4" />
      <text x="30" y="71" textAnchor="middle" fontFamily="var(--font-serif)" fontWeight="700" fontSize="18" fill="var(--c-stamp)">착</text>
      <path d="M30 44V30a8 8 0 0 1 8-8" fill="none" stroke="var(--c-muted)" strokeWidth="3" />
    </svg>
  );
}
