'use client';
// T-A-06 / P-A-07 키링 관리: 목록(코드, 상태, 첫 사용일, 도장 수) · 상태 변경 · 분실 처리 + 기록 이전(B5)

import { useState } from 'react';
import { Modal, Notice, PageHead, Table, Td, adminApi, errMsg, fmtDate, useAdminData } from '@/components/admin/ui';
import { useAdminMe } from '@/components/admin/useAdminMe';

const ST = { stock: '재고', issued: '지급됨', lost: '분실' };

export default function TokensAdmin() {
  const me = useAdminMe();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const query = new URLSearchParams({ q, page: String(page), ...(status ? { status } : {}) });
  const { data, error, reload } = useAdminData(`/api/admin/tokens?${query}`);
  const [transfer, setTransfer] = useState(null);
  const [msg, setMsg] = useState(null);
  const stamp = me?.service === 'pilgrim' ? '인장' : '도장';

  const change = async (t, s) => {
    try {
      await adminApi('/api/admin/tokens', { method: 'PUT', body: { id: t.id, status: s } });
      reload();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };

  return (
    <>
      <PageHead title="키링 관리" desc={`우리 기관에 배정된 키링이에요. ${stamp} 수는 우리 기관 ${me?.service === 'pilgrim' ? '성지' : '관광지'}에서 받은 것만 보여요.`} />
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input w-[220px] uppercase" placeholder="코드 검색" value={q} onChange={(e) => { setQ(e.target.value.toUpperCase()); setPage(0); }} />
        {['', 'stock', 'issued', 'lost'].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setStatus(s); setPage(0); }}>{s ? ST[s] : '전체'}</button>
        ))}
        <span className="ml-auto small muted">{data ? `${data.total}개` : ''}</span>
      </div>
      {error && <p className="text-error">{error}</p>}
      <Table head={['코드', '상태', '첫 사용일', `${stamp} 수`, me?.role === 'super' ? '기관' : null, '묶음', ''].filter((x) => x !== null)}>
        {data?.tokens.map((t) => (
          <tr key={t.id}>
            <Td className="font-mono text-[17px] font-semibold tracking-wider">{t.code}</Td>
            <Td>
              <span className={`chip ${t.status === 'issued' ? 'chip-done' : t.status === 'lost' ? 'text-error' : ''}`}>{ST[t.status]}</span>
              {t.replaced_by_code && <span className="ml-2 small muted">→ {t.replaced_by_code}</span>}
            </Td>
            <Td>{fmtDate(t.first_used_at)}</Td>
            <Td className="tabular-nums">{t.stamp_count}</Td>
            {me?.role === 'super' && <Td>{t.org_name ?? <span className="muted">미배정</span>}</Td>}
            <Td className="small muted">{t.batch_label}</Td>
            <Td className="whitespace-nowrap text-right">
              {t.status !== 'lost' && (
                <>
                  <select className="input inline-block w-auto min-h-[44px] py-0" value={t.status} onChange={(e) => change(t, e.target.value)} aria-label="상태 변경">
                    <option value="stock">재고</option>
                    <option value="issued">지급됨</option>
                  </select>
                  <button className="btn btn-secondary btn-sm ml-2" onClick={() => setTransfer(t)}>분실 처리</button>
                </>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      {data && data.total > data.page_size && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
          <span className="tabular-nums">{page + 1} / {Math.ceil(data.total / data.page_size)}</span>
          <button className="btn btn-secondary btn-sm" disabled={(page + 1) * data.page_size >= data.total} onClick={() => setPage(page + 1)}>다음</button>
        </div>
      )}
      {transfer && (
        <TransferModal
          token={transfer}
          onClose={() => setTransfer(null)}
          onDone={(r) => { setTransfer(null); setMsg({ text: `${r.old_code} 분실 처리 완료. 기록을 ${r.new_code}(으)로 옮겼어요.` }); reload(); }}
        />
      )}
    </>
  );
}

function TransferModal({ token, onClose, onDone }) {
  const [code, setCode] = useState('');
  const [check, setCheck] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setErr(null);
    setCheck(null);
    try {
      const d = await adminApi(`/api/admin/tokens/transfer?code=${code}`);
      if (!d.eligible) setErr('기록이 없는 새 키링만 선택할 수 있어요');
      else if (d.code === token.code) setErr('같은 키링이에요');
      else setCheck(d);
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      onDone(await adminApi('/api/admin/tokens/transfer', { method: 'POST', body: { old_code: token.code, new_code: check.code } }));
    } catch (e) {
      setErr(errMsg(e));
      setConfirmStep(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="분실 처리 + 기록 이전" onClose={onClose}>
      {!confirmStep ? (
        <div className="space-y-4">
          <p>분실 키링 <b className="font-mono">{token.code}</b>의 모든 기록(도장 · 완주 · 사진 · 메모 · 포인트 · 뱃지)을 새 키링으로 옮겨요.</p>
          <div className="flex gap-2">
            <input className="input font-mono uppercase tracking-widest" maxLength={8} placeholder="새 키링 코드" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCheck(null); setErr(null); }} />
            <button className="btn btn-secondary" disabled={code.length !== 8} onClick={verify}>확인</button>
          </div>
          <p className="small muted">재고 상태이면서 기록이 하나도 없는 키링만 고를 수 있어요.</p>
          {check && <p className="font-semibold text-success">✔ {check.code} — 사용할 수 있는 새 키링이에요</p>}
          {err && <p className="font-semibold text-error">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={onClose}>취소</button>
            <button className="btn btn-primary" disabled={!check} onClick={() => setConfirmStep(true)}>다음</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="subtitle">정말 진행할까요?</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b className="font-mono">{token.code}</b> → 분실 (리더에서 도장을 받을 수 없어요)</li>
            <li><b className="font-mono">{check.code}</b> → 지급됨, 기존 기록이 모두 옮겨져요</li>
            <li>되돌릴 수 없어요</li>
          </ul>
          {err && <p className="font-semibold text-error">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setConfirmStep(false)}>뒤로</button>
            <button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? '처리 중…' : '분실 처리하고 기록 옮기기'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
