'use client';
// S-03 키링 발급: 웹 선택 + 수량 → 일괄 생성 → 기관 배정 → CSV(코드, 키링에 기록할 전체 주소) · 칩 UID 일괄 등록

import { useEffect, useState } from 'react';
import { Field, Notice, PageHead, Table, Td, adminApi, errMsg, fmtDate } from '@/components/admin/ui';

export default function TokensSuper() {
  const [service, setService] = useState('tour');
  const [orgs, setOrgs] = useState([]);
  const [batches, setBatches] = useState(null);
  const [f, setF] = useState({ count: 10, organization_id: '', batch_label: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assign, setAssign] = useState({ codes: '', organization_id: '' });
  const [uid, setUid] = useState('');

  const loadBatches = () => adminApi(`/api/super/tokens?batches=1&service=${service}`).then(setBatches).catch(() => {});
  useEffect(() => {
    adminApi('/api/super/orgs').then((d) => setOrgs(d.orgs)).catch(() => {});
  }, []);
  useEffect(() => { loadBatches(); }, [service]); // eslint-disable-line react-hooks/exhaustive-deps

  const issue = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/super/tokens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, service }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw Object.assign(new Error(d.error), { code: d.error });
      }
      const blob = await res.blob();
      const name = decodeURIComponent((res.headers.get('content-disposition') ?? '').split("''")[1] ?? 'tokens.csv');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg({ text: `키링 ${f.count}개를 만들고 CSV를 내려받았어요` });
      loadBatches();
    } catch (e2) {
      setMsg({ err: true, text: errMsg(e2) });
    } finally {
      setBusy(false);
    }
  };

  const svcOrgs = orgs.filter((o) => o.service === service);
  const origin = batches?.origin;

  return (
    <>
      <PageHead title="키링 발급" desc="코드는 31자(0·O·1·I·L 제외) 중 8자리 무작위예요.">
        {['tour', 'pilgrim'].map((s) => (
          <button key={s} className={`btn btn-sm ${service === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setService(s)}>{s === 'tour' ? '관광지 웹' : '순례 웹'}</button>
        ))}
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <div className={`mb-6 rounded-[var(--r-card)] border px-5 py-4 ${origin && !/vercel\.app|localhost/.test(origin) ? 'border-line' : 'border-error'}`}>
        <p className="font-semibold">키링에 기록될 주소: <span className="font-mono">{origin ? `${origin}/k/코드` : '(주소 미설정)'}</span></p>
        {(!origin || /vercel\.app|localhost/.test(origin)) && (
          <p className="mt-1 text-error">⚠ 아직 임시 주소예요. 실제 키링에 기록하는 작업은 도메인을 확정하고 TOUR_HOSTS / PILGRIM_HOSTS 첫 번째 값을 바꾼 뒤에 해 주세요. 임시 주소로 기록하면 키링을 전부 다시 기록해야 해요.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <form onSubmit={issue} className="card space-y-4">
          <p className="subtitle">새로 발급</p>
          <Field label="수량 (1~5000)"><input className="input" type="number" min={1} max={5000} required value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></Field>
          <Field label="기관 배정 (선택)">
            <select className="input" value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value })}>
              <option value="">배정 안 함</option>
              {svcOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="묶음 이름 (선택)"><input className="input" value={f.batch_label} onChange={(e) => setF({ ...f, batch_label: e.target.value })} placeholder="예: 2026-11 현충사 1차" /></Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '만드는 중…' : '발급하고 CSV 받기'}</button>
        </form>

        <div className="card space-y-4">
          <p className="subtitle">기관 배정 바꾸기</p>
          <Field label="키링 코드 (줄바꿈·쉼표로 여러 개)"><textarea className="input textarea font-mono uppercase" value={assign.codes} onChange={(e) => setAssign({ ...assign, codes: e.target.value })} /></Field>
          <select className="input" value={assign.organization_id} onChange={(e) => setAssign({ ...assign, organization_id: e.target.value })}>
            <option value="">배정 해제</option>
            {svcOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn btn-secondary btn-block" onClick={async () => {
            try {
              const r = await adminApi('/api/super/tokens', { method: 'PUT', body: assign });
              setMsg({ text: `${r.updated}개 배정을 바꿨어요` });
            } catch (e) { setMsg({ err: true, text: errMsg(e) }); }
          }}>배정 저장</button>
        </div>
      </div>

      <div className="card mt-6 space-y-3">
        <p className="subtitle">칩 UID 일괄 등록 (선택)</p>
        <p className="small muted">한 줄에 "코드,UID" — 예: K7MX2PQA,04A1B2C3D4E5F6. NFC Tools로 기록하면서 읽은 시리얼 번호를 넣어 주세요.</p>
        <textarea className="input textarea font-mono" value={uid} onChange={(e) => setUid(e.target.value)} />
        <div className="flex gap-2">
          <label className="btn btn-secondary btn-sm cursor-pointer">CSV 파일 열기<input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => { const t = await e.target.files?.[0]?.text(); if (t) setUid(t); e.target.value = ''; }} /></label>
          <button className="btn btn-primary btn-sm" disabled={!uid.trim()} onClick={async () => {
            try {
              const r = await adminApi('/api/super/tokens/uid', { method: 'POST', body: { csv: uid } });
              setMsg({ text: `UID ${r.updated}개 등록${r.skipped.length ? `\n건너뜀 ${r.skipped.length}줄: ${r.skipped.slice(0, 5).map((s) => `${s.line}줄 ${s.reason}`).join(', ')}` : ''}` });
            } catch (e) { setMsg({ err: true, text: errMsg(e) }); }
          }}>등록</button>
        </div>
      </div>

      <h2 className="subtitle mt-10 mb-3">발급 묶음</h2>
      <Table head={['묶음', '개수', '만든 날', '']}>
        {batches?.batches.map((b) => (
          <tr key={b.batch}>
            <Td className="font-semibold">{b.batch}</Td>
            <Td className="tabular-nums">{b.count}</Td>
            <Td>{fmtDate(b.created_at)}</Td>
            <Td className="text-right"><a className="btn btn-secondary btn-sm" href={`/api/super/tokens?service=${service}&batch=${encodeURIComponent(b.batch)}`}>CSV</a></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
