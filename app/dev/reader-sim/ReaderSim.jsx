'use client';
// 가상 리더: 지점을 고르고 키링 코드를 넣으면 실제와 같은 도장 함수로 태그. 태그 시각 직접 지정 가능

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, errMsg } from '@/components/admin/ui';
import { messageFor } from '@/lib/reader/messages';

export default function ReaderSim() {
  const [opts, setOpts] = useState(null);
  const [reader, setReader] = useState('');
  const [code, setCode] = useState('');
  const [at, setAt] = useState('');
  const [log, setLog] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    adminApi('/api/super/sim').then((d) => {
      setOpts(d);
      setReader(d.readers[0]?.id ?? '');
      setCode(d.tokens[0]?.code ?? '');
    }).catch((e) => setErr(errMsg(e)));
  }, []);

  const tag = async (rid = reader) => {
    setErr(null);
    try {
      const body = { reader_id: rid, code };
      if (at) body.tagged_at = new Date(at).toISOString();
      const { result } = await adminApi('/api/super/sim', { method: 'POST', body });
      const r = opts.readers.find((x) => x.id === rid);
      const m = messageFor(result, r?.checkpoints?.sites?.service);
      setLog((l) => [{ t: new Date().toLocaleTimeString('ko-KR'), reader: r?.name, code, m, raw: result }, ...l].slice(0, 50));
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const sameSite = opts?.readers.filter((r) => r.checkpoints?.sites?.name === opts.readers.find((x) => x.id === reader)?.checkpoints?.sites?.name) ?? [];

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <Link href="/admin" className="back">← 관리자</Link>
      <h1 className="title">가상 리더 (개발용)</h1>
      <p className="muted mt-1">NFC 기기 없이 실제 리더와 같은 도장 함수(record_stamp)로 태그해요. 운영에서는 ENABLE_DEV_TOOLS를 끄세요.</p>
      {err && <p className="mt-4 font-semibold text-error">{err}</p>}
      {opts && (
        <div className="card mt-6 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="small font-semibold">리더(지점)</span>
            <select className="input mt-1" value={reader} onChange={(e) => setReader(e.target.value)}>
              {opts.readers.map((r) => <option key={r.id} value={r.id}>[{r.checkpoints?.sites?.service === 'pilgrim' ? '순례' : '관광'}] {r.name}{r.is_active ? '' : ' (비활성)'}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="small font-semibold">키링 코드</span>
            <input className="input mt-1 font-mono uppercase" list="codes" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <datalist id="codes">{opts.tokens.map((t) => <option key={t.code} value={t.code}>{t.service} · {t.status}</option>)}</datalist>
          </label>
          <label className="block">
            <span className="small font-semibold">태그 시각 (비우면 지금)</span>
            <input className="input mt-1" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <div className="flex items-end gap-2">
            <button className="btn btn-primary flex-1" onClick={() => tag()}>태그</button>
            <button className="btn btn-secondary" title="같은 관광지의 모든 지점을 차례로 태그" onClick={async () => { for (const r of sameSite) await tag(r.id); }}>
              관광지 전체 ({sameSite.length})
            </button>
          </div>
          <p className="col-span-2 small muted">키링 기록 보기: <a className="underline" href={`/k/${code}`} target="_blank" rel="noreferrer">/k/{code}</a></p>
        </div>
      )}
      <ul className="mt-6 space-y-2">
        {log.map((l, i) => (
          <li key={i} className={`card flex items-start gap-4 ${l.m.tone === 'error' ? 'border-error' : ''}`}>
            <span className="small muted tabular-nums">{l.t}</span>
            <div className="flex-1">
              <p className="font-semibold">{l.m.title} <span className="small muted">({l.raw.result})</span></p>
              <p className="small">{l.m.lines.filter(Boolean).join(' · ')}</p>
              <p className="small muted">{l.reader} · {l.code}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
