'use client';
// T-A-05 / P-A-06 리더 관리: 6자리 등록 코드(24시간) · 연결 지점 · 상태 · 비활성 · 설정 PIN

import { useEffect, useState } from 'react';
import { Field, Modal, Notice, PageHead, Table, Td, adminApi, errMsg, fmtTime, useAdminData } from '@/components/admin/ui';

const STATE = { ok: ['정상', 'chip-done'], down: ['끊김', 'text-error'], unregistered: ['미등록', ''], inactive: ['비활성', ''] };

export default function ReadersAdmin() {
  const { data, error, reload } = useAdminData('/api/admin/readers');
  const [opts, setOpts] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    adminApi('/api/admin/org').then(setOpts).catch(() => {});
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const act = async (r, body, ok) => {
    try {
      const d = await adminApi(`/api/admin/readers/${r.id}`, { method: 'PUT', body });
      setMsg({ text: d.reg_code ? `${r.name} 등록 코드: ${d.reg_code} (24시간 유효)` : ok });
      reload();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };

  return (
    <>
      <PageHead title="리더 관리" desc="리더 1대 = 지점 1개. 기기에서 /reader를 열고 등록 코드를 입력하면 연결돼요. 1분마다 신호를 보내요.">
        <button className="btn btn-secondary btn-sm" onClick={reload}>새로고침</button>
        <button className="btn btn-primary" onClick={() => setEdit('new')}>+ 리더 추가</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      {error && <p className="text-error">{error}</p>}
      <Table head={['이름', '연결 지점', '상태', '마지막 신호', '대기 전송', '등록 코드', 'PIN', '']}>
        {data?.readers.map((r) => (
          <tr key={r.id} className={r.state === 'down' ? 'bg-[color-mix(in_srgb,var(--c-error)_6%,transparent)]' : ''}>
            <Td className="font-semibold">{r.name}</Td>
            <Td>{r.checkpoint_name ? `${r.site_name} · ${r.checkpoint_name}` : <span className="text-error">지점 없음</span>}</Td>
            <Td><span className={`chip ${STATE[r.state][1]}`}>{STATE[r.state][0]}</span></Td>
            <Td className="tabular-nums">{fmtTime(r.last_seen_at)}</Td>
            <Td className="tabular-nums">{r.pending_count}건</Td>
            <Td>
              {r.reg_code ? (
                <span className="font-mono text-[18px] font-bold tracking-widest">{r.reg_code}<span className="block small font-sans font-normal muted tracking-normal">~{fmtTime(r.reg_code_expires_at)}</span></span>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => act(r, { issue_code: true })}>코드 발급</button>
              )}
            </Td>
            <Td>{r.has_pin ? '설정됨' : <span className="muted">없음</span>}</Td>
            <Td className="whitespace-nowrap text-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setEdit(r)}>수정</button>
              <button className="btn btn-ghost btn-sm" onClick={() => act(r, { is_active: !r.is_active }, r.is_active ? '비활성으로 바꿨어요' : '다시 활성화했어요')}>
                {r.is_active ? '비활성' : '활성'}
              </button>
            </Td>
          </tr>
        ))}
      </Table>
      {edit && (
        <ReaderForm
          reader={edit === 'new' ? null : edit}
          opts={opts}
          onClose={() => setEdit(null)}
          onSaved={(text) => { setEdit(null); setMsg({ text }); reload(); }}
        />
      )}
    </>
  );
}

function ReaderForm({ reader, opts, onClose, onSaved }) {
  const [name, setName] = useState(reader?.name ?? '');
  const [cp, setCp] = useState(reader?.checkpoint_id ?? '');
  const [pin, setPin] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [err, setErr] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (reader) {
        const body = { name, checkpoint_id: cp || null };
        if (pin) body.pin = pin;
        else if (clearPin) body.pin = null;
        await adminApi(`/api/admin/readers/${reader.id}`, { method: 'PUT', body });
        onSaved('저장했어요');
      } else {
        const d = await adminApi('/api/admin/readers', { method: 'POST', body: { name, checkpoint_id: cp || null } });
        if (pin) await adminApi(`/api/admin/readers/${d.id}`, { method: 'PUT', body: { pin } });
        onSaved(`리더를 추가했어요. 등록 코드: ${d.reg_code} (24시간 유효)`);
      }
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };

  return (
    <Modal title={reader ? '리더 수정' : '리더 추가'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="이름 *"><input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 현충사 본전 리더" /></Field>
        <Field label="연결 지점">
          <select className="input" value={cp} onChange={(e) => setCp(e.target.value)} required={!reader}>
            <option value="">선택</option>
            {opts?.sites.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.checkpoints.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="설정 PIN (숫자 4자리)" hint="리더 화면 오른쪽 위 설정을 열 때 물어봐요">
          <input className="input" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder={reader?.has_pin ? '바꿀 때만 입력' : '0000'} />
        </Field>
        {reader?.has_pin && (
          <label className="flex items-center gap-2"><input type="checkbox" checked={clearPin} onChange={(e) => setClearPin(e.target.checked)} /> PIN 없애기</label>
        )}
        {err && <p className="font-semibold text-error">{err}</p>}
        <div className="flex justify-end gap-2">
          {reader && <button type="button" className="btn btn-ghost" onClick={async () => { if (confirm('이 리더를 삭제할까요?')) { await adminApi(`/api/admin/readers/${reader.id}`, { method: 'DELETE' }); onSaved('삭제했어요'); } }}>삭제</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary">저장</button>
        </div>
      </form>
    </Modal>
  );
}
