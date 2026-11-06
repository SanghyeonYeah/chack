'use client';
// 관리자 화면 공통 부품 (PC 기준, 표·폼 위주)

import { useCallback, useEffect, useState } from 'react';

export async function adminApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401) {
    location.href = '/admin/login';
    throw new Error('UNAUTHORIZED');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    const e = new Error(data?.error ?? `HTTP ${res.status}`);
    e.code = data?.error;
    e.data = data;
    throw e;
  }
  return data;
}

const MSG = {
  HAS_RECORDS: '방문 기록이 있어 삭제할 수 없어요. 비공개로 바꿔 주세요.',
  NEW_HAS_RECORDS: '기록이 없는 새 키링만 선택할 수 있어요',
  NEW_NOT_FOUND: '새 키링 코드를 찾을 수 없어요',
  OLD_NOT_FOUND: '분실 키링 코드를 찾을 수 없어요',
  OLD_ALREADY_LOST: '이미 분실 처리된 키링이에요',
  SAME_TOKEN: '같은 키링이에요',
  NOT_YOUR_TOKEN: '우리 기관에 배정된 키링만 처리할 수 있어요',
  SERVICE_MISMATCH: '다른 웹의 키링이에요',
  CONSENT_REQUIRED: '공개 동의를 받아야 표시할 수 있어요',
  NAME_REQUIRED: '이름을 입력해 주세요',
  REGION_REQUIRED: '지역을 골라 주세요',
  ORG_REQUIRED: '기관을 골라 주세요',
  EMAIL_EXISTS: '이미 있는 이메일이에요',
  PIN_FORMAT: 'PIN은 숫자 4자리예요',
  IN_USE: '사용 중인 지역이라 삭제할 수 없어요',
  DUPLICATE: '이미 있는 지역이에요',
  FORBIDDEN: '권한이 없어요',
  GREETING_TOO_LONG: '인사말은 200자까지예요',
  SITE_REGION_MUST_BE_SIGUNGU: '시·군을 골라 주세요',
  SITE_SERVICE_MISMATCH: '다른 웹의 기관이에요',
  OTHER_ORG_CHECKPOINT: '같은 기관의 지점만 연결할 수 있어요',
  PASSWORD_SHORT: '비밀번호는 8자 이상이에요',
  CANNOT_DISABLE_SELF: '내 계정은 비활성할 수 없어요',
  ORG_SERVICE_MISMATCH: '선택한 웹과 기관의 웹이 달라요',
};
export const errMsg = (e) => MSG[e?.code] ?? '잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요';

export function useAdminData(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    if (!path) return;
    setError(null);
    adminApi(path).then(setData).catch((e) => setError(errMsg(e)));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

export function PageHead({ title, desc, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[28px] font-bold">{title}</h1>
        {desc && <p className="muted mt-1">{desc}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  );
}

export function Stat({ label, value, sub, warn }) {
  return (
    <div className={`card ${warn ? 'border-error' : ''}`}>
      <p className="small muted">{label}</p>
      <p className={`mt-1 font-serif text-[30px] font-bold tabular-nums ${warn ? 'text-error' : ''}`}>{value}</p>
      {sub && <p className="small muted">{sub}</p>}
    </div>
  );
}

export function Table({ head, children, empty = '항목이 없어요' }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-[16px]">
        <thead className="bg-sunk">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length ? rows : (
            <tr><td colSpan={head.length} className="px-4 py-8 text-center muted">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = '' }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`block ${wide ? 'col-span-2' : ''}`}>
      <span className="small font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

export function Notice({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-[var(--r-btn)] border px-4 py-3 ${msg.err ? 'border-error text-error' : 'border-success text-success'}`} role="status">
      <p className="font-semibold whitespace-pre-line">{msg.text}</p>
      {onClose && <button className="small underline" onClick={onClose}>닫기</button>}
    </div>
  );
}

export function Modal({ title, children, onClose, width = 560 }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal max-h-[90dvh] overflow-y-auto" style={{ width: `min(100%, ${width}px)` }}>
        <div className="mb-4 flex items-center justify-between">
          <p className="subtitle">{title}</p>
          {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="닫기">✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PeriodPicker({ value, onChange }) {
  const opts = [['today', '오늘'], ['7d', '7일'], ['30d', '30일'], ['custom', '직접']];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {opts.map(([k, l]) => (
        <button key={k} className={`btn btn-sm ${value.period === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onChange({ ...value, period: k })}>{l}</button>
      ))}
      {value.period === 'custom' && (
        <>
          <input type="date" className="input w-auto" value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="시작일" />
          <span>~</span>
          <input type="date" className="input w-auto" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="종료일" />
        </>
      )}
    </div>
  );
}
export function periodQuery(p) {
  const q = new URLSearchParams({ period: p.period });
  if (p.period === 'custom' && p.from && p.to) {
    q.set('from', p.from);
    q.set('to', p.to);
  }
  return q.toString();
}

/** 이미지 업로드 (공개 media 버킷) → 저장 경로 목록 */
export function ImageInput({ kind, value = [], onChange, max = 5 }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const url = (p) => (/^https?:/.test(p) ? p : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${p}`);
  const add = async (files) => {
    setBusy(true);
    setErr(null);
    const next = [...value];
    try {
      for (const f of Array.from(files).slice(0, max - value.length)) {
        const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
        if (f.size > 10 * 1024 * 1024) throw new Error('10MB 이하 이미지만 올릴 수 있어요');
        const { path, upload_url } = await adminApi('/api/admin/upload', { method: 'POST', body: { kind, ext } });
        const r = await fetch(upload_url, { method: 'PUT', headers: { 'content-type': f.type || 'image/jpeg' }, body: f });
        if (!r.ok) throw new Error('업로드에 실패했어요');
        next.push(path);
        onChange([...next]);
      }
    } catch (e) {
      setErr(e.message?.length > 3 && !/^[A-Z_]+$/.test(e.message) ? e.message : errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <div key={p} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url(p)} alt="" className="h-20 w-20 rounded-lg border border-line bg-sunk object-cover" />
            <button type="button" className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-bg" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label="이미지 빼기">×</button>
          </div>
        ))}
        {value.length < max && (
          <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line small muted">
            {busy ? '…' : '+ 추가'}
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple={max > 1} hidden onChange={(e) => { add(e.target.files ?? []); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {err && <p className="mt-1 small text-error">{err}</p>}
    </div>
  );
}

export function fmtTime(t) {
  return t ? new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
export function fmtDate(t) {
  return t ? new Date(t).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—';
}
