'use client';
// P-A-08 성경 구절 관리 (모든 성지 공용, 최고 관리자만 수정 — B8)

import { useState } from 'react';
import { Field, Modal, Notice, PageHead, Table, Td, adminApi, errMsg, useAdminData } from '@/components/admin/ui';

export default function VersesAdmin() {
  const { data, error, reload } = useAdminData('/api/admin/verses');
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const can = data?.can_edit;

  const toggle = async (v) => {
    try {
      await adminApi(`/api/admin/verses/${v.id}`, { method: 'PUT', body: { is_visible: !v.is_visible } });
      reload();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };

  return (
    <>
      <PageHead title="성경 구절" desc="첫 화면에 순서대로 30초마다 바뀌고, 순례 완료 화면에는 노출 구절 중 하나가 무작위로 나와요. 정식 운영 전 사용 허락을 받아 주세요.">
        {can && <button className="btn btn-primary" onClick={() => setEdit('new')}>+ 구절 추가</button>}
      </PageHead>
      {!can && data && <p className="mb-4 card muted">구절은 모든 성지가 함께 쓰므로 최고 관리자만 수정할 수 있어요.</p>}
      <Notice msg={msg} onClose={() => setMsg(null)} />
      {error && <p className="text-error">{error}</p>}
      <Table head={['순서', '본문', '출처', '노출', can ? '' : null].filter((x) => x !== null)}>
        {data?.verses.map((v) => (
          <tr key={v.id}>
            <Td>{v.sort_order}</Td>
            <Td className="max-w-[560px] font-serif">{v.text}</Td>
            <Td className="whitespace-nowrap">{v.source}</Td>
            <Td>
              {can ? (
                <button className={`chip ${v.is_visible ? 'chip-done' : ''}`} onClick={() => toggle(v)}>{v.is_visible ? '노출' : '숨김'}</button>
              ) : <span className={`chip ${v.is_visible ? 'chip-done' : ''}`}>{v.is_visible ? '노출' : '숨김'}</span>}
            </Td>
            {can && <Td className="text-right"><button className="btn btn-secondary btn-sm" onClick={() => setEdit(v)}>수정</button></Td>}
          </tr>
        ))}
      </Table>
      {edit && <VerseForm v={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function VerseForm({ v, onClose, onSaved }) {
  const [f, setF] = useState({ text: v?.text ?? '', source: v?.source ?? '', is_visible: v?.is_visible ?? true, sort_order: v?.sort_order ?? 0 });
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    try {
      if (v) await adminApi(`/api/admin/verses/${v.id}`, { method: 'PUT', body: f });
      else await adminApi('/api/admin/verses', { method: 'POST', body: f });
      onSaved();
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };
  return (
    <Modal title={v ? '구절 수정' : '구절 추가'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="본문 *"><textarea className="input textarea font-serif" required value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        <Field label="출처 (책 장,절)"><input className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="예: 시편 23,1" /></Field>
        <Field label="순서"><input className="input" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></Field>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={f.is_visible} onChange={(e) => setF({ ...f, is_visible: e.target.checked })} /> 노출</label>
        {err && <p className="font-semibold text-error">{err}</p>}
        <div className="flex justify-end gap-2">
          {v && <button type="button" className="btn btn-ghost" onClick={async () => { if (confirm('삭제할까요?')) { await adminApi(`/api/admin/verses/${v.id}`, { method: 'DELETE' }); onSaved(); } }}>삭제</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary">저장</button>
        </div>
      </form>
    </Modal>
  );
}
