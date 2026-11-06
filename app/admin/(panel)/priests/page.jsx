'use client';
// P-A-05 신부님 관리: 동의 체크 없이는 표시를 켤 수 없음 (화면 비활성 + DB CHECK)

import { Suspense, useEffect, useState } from 'react';
import { Field, ImageInput, Modal, Notice, PageHead, Table, Td, adminApi, errMsg } from '@/components/admin/ui';
import SitePicker, { useSitePick } from '@/components/admin/SitePicker';

export default function Page() {
  return <Suspense><PriestsAdmin /></Suspense>;
}

function PriestsAdmin() {
  const { opts, siteId, select } = useSitePick();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => siteId && adminApi(`/api/admin/priests?site=${siteId}`).then((d) => setList(d.priests)).catch((e) => setMsg({ err: true, text: errMsg(e) }));
  useEffect(() => { load(); }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (p) => {
    try {
      await adminApi(`/api/admin/priests/${p.id}`, { method: 'PUT', body: { is_visible: !p.is_visible } });
      load();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };

  return (
    <>
      <PageHead title="신부님 관리" desc="공개 동의를 받은 분만 표시할 수 있어요. 인사이동 시 표시를 끄거나 삭제해 주세요.">
        <SitePicker opts={opts} siteId={siteId} onSelect={select} label="성지" />
        <button className="btn btn-primary" disabled={!siteId} onClick={() => setEdit('new')}>+ 신부님 등록</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <Table head={['순서', '성함', '세례명', '직분', '공개 동의', '표시', '메모', '']}>
        {list?.map((p) => (
          <tr key={p.id}>
            <Td>{p.sort_order}</Td>
            <Td className="font-semibold">{p.name}</Td>
            <Td>{p.baptismal_name}</Td>
            <Td>{p.role_title}</Td>
            <Td>{p.consent_checked ? <span className="chip chip-done">받음</span> : <span className="chip">없음</span>}</Td>
            <Td>
              <button className={`chip ${p.is_visible ? 'chip-done' : ''}`} disabled={!p.consent_checked} title={p.consent_checked ? '' : '공개 동의를 먼저 받아 주세요'} onClick={() => toggle(p)}>
                {p.is_visible ? '표시 중' : '숨김'}
              </button>
            </Td>
            <Td className="small muted">{p.consent_note}</Td>
            <Td className="text-right"><button className="btn btn-secondary btn-sm" onClick={() => setEdit(p)}>수정</button></Td>
          </tr>
        ))}
      </Table>
      {edit && <PriestForm p={edit === 'new' ? null : edit} siteId={siteId} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function PriestForm({ p, siteId, onClose, onSaved }) {
  const [f, setF] = useState({
    name: p?.name ?? '', baptismal_name: p?.baptismal_name ?? '', role_title: p?.role_title ?? '', photo_url: p?.photo_url ?? '',
    greeting: p?.greeting ?? '', consent_checked: p?.consent_checked ?? false, consent_note: p?.consent_note ?? '',
    is_visible: p?.is_visible ?? false, sort_order: p?.sort_order ?? 0,
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((x) => ({ ...x, [k]: v, ...(k === 'consent_checked' && !v ? { is_visible: false } : {}) }));
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      if (p) await adminApi(`/api/admin/priests/${p.id}`, { method: 'PUT', body: f });
      else await adminApi('/api/admin/priests', { method: 'POST', body: { ...f, site_id: siteId } });
      onSaved();
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };
  return (
    <Modal title={p ? '신부님 수정' : '신부님 등록'} onClose={onClose} width={640}>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <Field label="성함 *"><input className="input" required value={f.name} onChange={set('name')} /></Field>
        <Field label="세례명"><input className="input" value={f.baptismal_name} onChange={set('baptismal_name')} /></Field>
        <Field label="직분"><input className="input" value={f.role_title} onChange={set('role_title')} placeholder="예: 주임 신부" /></Field>
        <Field label="표시 순서"><input className="input" type="number" value={f.sort_order} onChange={set('sort_order')} /></Field>
        <Field label="사진 (선택)" wide>
          <ImageInput kind="priests" value={f.photo_url ? [f.photo_url] : []} onChange={(v) => setF({ ...f, photo_url: v[0] ?? '' })} max={1} />
        </Field>
        <Field label={`인사말 (${[...f.greeting].length}/200자)`} wide>
          <textarea className="input textarea" style={{ minHeight: 90 }} maxLength={200} value={f.greeting} onChange={set('greeting')} />
        </Field>
        <label className="col-span-2 flex items-center gap-3">
          <input type="checkbox" className="h-6 w-6" checked={f.consent_checked} onChange={set('consent_checked')} />
          <span className="font-semibold">공개 동의 받음 (필수)</span>
        </label>
        <Field label="관리자 메모 (예: 동의 받은 날짜)" wide><input className="input" value={f.consent_note} onChange={set('consent_note')} /></Field>
        <label className={`col-span-2 flex items-center gap-3 ${f.consent_checked ? '' : 'opacity-50'}`}>
          <input type="checkbox" className="h-6 w-6" disabled={!f.consent_checked} checked={f.is_visible} onChange={set('is_visible')} />
          <span className="font-semibold">사용자 화면에 표시</span>
          {!f.consent_checked && <span className="small muted">동의를 받아야 켤 수 있어요</span>}
        </label>
        {err && <p className="col-span-2 font-semibold text-error">{err}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          {p && <button type="button" className="btn btn-ghost" onClick={async () => { if (confirm('삭제할까요?')) { await adminApi(`/api/admin/priests/${p.id}`, { method: 'DELETE' }); onSaved(); } }}>삭제</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary">저장</button>
        </div>
      </form>
    </Modal>
  );
}
