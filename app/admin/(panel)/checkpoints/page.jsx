'use client';
// T-A-04 코스 · 지점 관리 / P-A-04 지점 관리: 끌어서 순서 변경, 지도에서 좌표 찍기

import { Suspense, useEffect, useState } from 'react';
import { Field, ImageInput, Modal, Notice, PageHead, adminApi, errMsg, fmtTime } from '@/components/admin/ui';
import { useAdminMe } from '@/components/admin/useAdminMe';
import SitePicker, { useSitePick } from '@/components/admin/SitePicker';
import KakaoPicker from '@/components/admin/KakaoPicker';

export default function Page() {
  return <Suspense><CheckpointsAdmin /></Suspense>;
}

function CheckpointsAdmin() {
  const me = useAdminMe();
  const { opts, siteId, select } = useSitePick();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const [drag, setDrag] = useState(null);
  const place = me?.service === 'pilgrim' ? '성지' : '관광지';

  const load = () => {
    if (!siteId) return;
    adminApi(`/api/admin/checkpoints?site=${siteId}`).then((d) => setList(d.checkpoints)).catch((e) => setMsg({ err: true, text: errMsg(e) }));
  };
  useEffect(load, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveOrder = async (next) => {
    setList(next);
    try {
      await adminApi('/api/admin/checkpoints/reorder', { method: 'POST', body: { site_id: siteId, ids: next.map((c) => c.id) } });
      setMsg({ text: '순서를 바꿨어요' });
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
      load();
    }
  };
  const onDrop = (target) => {
    if (drag == null || drag === target) return;
    const next = [...list];
    const [m] = next.splice(drag, 1);
    next.splice(target, 0, m);
    setDrag(null);
    void saveOrder(next);
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    void saveOrder(next);
  };
  const remove = async (c) => {
    if (!confirm(`${c.name} 지점을 삭제할까요?`)) return;
    try {
      await adminApi(`/api/admin/checkpoints/${c.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };
  const togglePublic = async (c) => {
    await adminApi(`/api/admin/checkpoints/${c.id}`, { method: 'PUT', body: { is_public: !c.is_public } });
    load();
  };

  return (
    <>
      <PageHead title="지점 관리" desc="완주는 공개 지점을 모두 모으면 돼요. 지점을 나중에 추가해도 이미 완주한 기록은 그대로예요.">
        <SitePicker opts={opts} siteId={siteId} onSelect={select} label={place} />
        <button className="btn btn-primary" disabled={!siteId} onClick={() => setEdit('new')}>+ 지점 추가</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      {opts && !opts.sites.length && <p className="card muted">먼저 {place}를 등록해 주세요.</p>}
      <ol className="space-y-2">
        {list?.map((c, i) => (
          <li
            key={c.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className={`card flex items-center gap-4 p-4 ${drag === i ? 'opacity-50' : ''}`}
          >
            <span className="cursor-grab text-[22px] muted select-none" title="끌어서 순서 변경" aria-hidden>⠿</span>
            <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-primary font-bold text-primary">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.name} {!c.is_public && <span className="chip ml-1">비공개</span>}</p>
              <p className="small muted truncate">{c.summary || '요약 설명 없음'}</p>
            </div>
            <div className="small muted w-[220px]">
              {c.readers?.length ? c.readers.map((r) => <p key={r.id}>리더: {r.name} <span className="opacity-70">({fmtTime(r.last_seen_at)})</span></p>) : '연결된 리더 없음'}
            </div>
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} aria-label="위로">▲</button>
              <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} aria-label="아래로">▼</button>
              <button className={`chip ${c.is_public ? 'chip-done' : ''}`} onClick={() => togglePublic(c)}>{c.is_public ? '공개' : '비공개'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEdit(c)}>수정</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(c)}>삭제</button>
            </div>
          </li>
        ))}
      </ol>
      {edit && (
        <CheckpointForm
          cp={edit === 'new' ? null : edit}
          siteId={siteId}
          others={(list ?? []).filter((x) => x.id !== edit?.id).map((x, n) => ({ id: x.id, lat: x.lat, lng: x.lng, label: String(n + 1), title: x.name }))}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); setMsg({ text: '저장했어요. 사용자 화면에 바로 반영돼요.' }); load(); }}
        />
      )}
    </>
  );
}

function CheckpointForm({ cp, siteId, others, onClose, onSaved }) {
  const [f, setF] = useState({
    name: cp?.name ?? '', summary: cp?.summary ?? '', description: cp?.description ?? '', photo_paths: cp?.photo_paths ?? [],
    lat: cp?.lat ?? '', lng: cp?.lng ?? '', is_public: cp?.is_public ?? true,
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const save = async (e) => {
    e.preventDefault();
    try {
      if (cp) await adminApi(`/api/admin/checkpoints/${cp.id}`, { method: 'PUT', body: f });
      else await adminApi('/api/admin/checkpoints', { method: 'POST', body: { ...f, site_id: siteId } });
      onSaved();
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };
  return (
    <Modal title={cp ? '지점 수정' : '지점 추가'} onClose={onClose} width={820}>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <Field label="이름 *"><input className="input" required value={f.name} onChange={set('name')} /></Field>
        <label className="flex items-center gap-3 self-end pb-3">
          <input type="checkbox" className="h-6 w-6" checked={f.is_public} onChange={set('is_public')} />
          <span className="font-semibold">공개</span>
        </label>
        <Field label="요약 설명 (2~3줄, 추억 화면용)" wide><textarea className="input textarea" style={{ minHeight: 90 }} maxLength={500} value={f.summary} onChange={set('summary')} /></Field>
        <Field label="상세 설명 (유물 · 역사 해설)" wide><textarea className="input textarea" value={f.description} onChange={set('description')} /></Field>
        <Field label="사진 (최대 5장)" wide><ImageInput kind="checkpoints" value={f.photo_paths} onChange={set('photo_paths')} /></Field>
        <Field label="좌표 (지도에서 찍기)" wide>
          <KakaoPicker lat={f.lat} lng={f.lng} others={others} onChange={(la, ln) => setF({ ...f, lat: la, lng: ln })} height={260} />
        </Field>
        {err && <p className="col-span-2 font-semibold text-error">{err}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary">저장</button>
        </div>
      </form>
    </Modal>
  );
}
