'use client';
// S-02 지역 관리: 도 · 시군 목록, 활성 여부, 지역 뱃지 이미지

import { useState } from 'react';
import { Field, ImageInput, Modal, Notice, PageHead, Table, Td, adminApi, errMsg, useAdminData } from '@/components/admin/ui';

export default function RegionsSuper() {
  const { data, reload } = useAdminData('/api/super/regions');
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const sidos = data?.regions.filter((r) => r.level === 'sido') ?? [];
  const run = async (fn) => {
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };

  return (
    <>
      <PageHead title="지역 관리" desc="비활성 지역은 사용자 화면에서 회색 '준비 중'으로 보여요. 뱃지 이미지가 없으면 기본 뱃지 + 지역 이름을 써요.">
        <button className="btn btn-primary" onClick={() => setEdit({})}>+ 지역 추가</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <Table head={['구분', '이름', '관광지', '성지', '순서', '뱃지', '활성', '']}>
        {sidos.flatMap((s) => [s, ...data.regions.filter((r) => r.parent_id === s.id)]).map((r) => (
          <tr key={r.id}>
            <Td>{r.level === 'sido' ? '도' : '시·군'}</Td>
            <Td className={r.level === 'sido' ? 'font-bold' : 'pl-8'}>{r.name}</Td>
            <Td className="tabular-nums">{r.tour_sites}</Td>
            <Td className="tabular-nums">{r.pilgrim_sites}</Td>
            <Td>{r.sort_order}</Td>
            <Td>{r.badge_image_path ? '등록됨' : <span className="muted">기본</span>}</Td>
            <Td><button className={`chip ${r.is_active ? 'chip-done' : ''}`} onClick={() => run(() => adminApi(`/api/super/regions/${r.id}`, { method: 'PUT', body: { is_active: !r.is_active } }))}>{r.is_active ? '활성' : '비활성'}</button></Td>
            <Td className="whitespace-nowrap text-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setEdit(r)}>수정</button>
              <button className="btn btn-ghost btn-sm" onClick={() => confirm(`${r.name}을(를) 삭제할까요?`) && run(() => adminApi(`/api/super/regions/${r.id}`, { method: 'DELETE' }))}>삭제</button>
            </Td>
          </tr>
        ))}
      </Table>
      {edit && <RegionForm r={edit.id ? edit : null} sidos={sidos} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function RegionForm({ r, sidos, onClose, onSaved }) {
  const [f, setF] = useState({ name: r?.name ?? '', parent_id: r?.parent_id ?? '', sort_order: r?.sort_order ?? 0, is_active: r?.is_active ?? true, badge_image_path: r?.badge_image_path ?? '' });
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    try {
      if (r) await adminApi(`/api/super/regions/${r.id}`, { method: 'PUT', body: f });
      else await adminApi('/api/super/regions', { method: 'POST', body: f });
      onSaved();
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };
  return (
    <Modal title={r ? '지역 수정' : '지역 추가'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {!r && (
          <Field label="상위 도" hint="비우면 '도'를 만들어요">
            <select className="input" value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}>
              <option value="">(도 만들기)</option>
              {sidos.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="이름 *"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="순서"><input className="input" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></Field>
        <Field label="뱃지 이미지"><ImageInput kind="badges" value={f.badge_image_path ? [f.badge_image_path] : []} onChange={(v) => setF({ ...f, badge_image_path: v[0] ?? '' })} max={1} /></Field>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> 활성</label>
        {err && <p className="font-semibold text-error">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>취소</button><button className="btn btn-primary">저장</button></div>
      </form>
    </Modal>
  );
}
