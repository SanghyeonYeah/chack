'use client';
// T-A-03 / P-A-03 관광지·성지 등록·수정 폼

import { useEffect, useState } from 'react';
import { Field, ImageInput, Modal, adminApi, errMsg } from './ui';
import KakaoPicker from './KakaoPicker';

const EMPTY = {
  name: '', aliases: '', region_id: '', organization_id: '', address: '', lat: '', lng: '', intro: '', photo_paths: [],
  opening_hours: '', closed_days: '', admission_fee: '', parking: '', phone: '', stamp_image_path: '', base_points: '',
  sort_order: 0, is_public: false, diocese: '', history_text: '', mass_times: '', group_contact: '',
};

export default function SiteForm({ id, service, role, onClose, onSaved }) {
  const [f, setF] = useState(id ? null : EMPTY);
  const [opts, setOpts] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const p = service === 'pilgrim';

  useEffect(() => {
    adminApi('/api/admin/org').then(setOpts).catch(() => {});
    if (id) {
      adminApi(`/api/admin/sites/${id}`).then(({ site }) => {
        const v = { ...EMPTY };
        for (const k of Object.keys(EMPTY)) if (site[k] != null) v[k] = site[k];
        v.aliases = (site.aliases ?? []).join(', ');
        v.base_points = site.base_points ?? '';
        setF(v);
      }).catch((e) => setErr(errMsg(e)));
    }
  }, [id]);

  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { ...f, aliases: f.aliases };
      if (id) await adminApi(`/api/admin/sites/${id}`, { method: 'PUT', body });
      else await adminApi('/api/admin/sites', { method: 'POST', body });
      onSaved();
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  const sigungus = opts?.regions.filter((r) => r.level === 'sigungu') ?? [];
  const sidoName = (pid) => opts?.regions.find((r) => r.id === pid)?.name;

  return (
    <Modal title={id ? `${p ? '성지' : '관광지'} 수정` : `${p ? '성지' : '관광지'} 등록`} onClose={onClose} width={860}>
      {!f ? <p className="muted">불러오는 중…</p> : (
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <Field label="이름 *"><input className="input" required value={f.name} onChange={set('name')} /></Field>
          <Field label="별칭 (검색용, 쉼표로 구분)"><input className="input" value={f.aliases} onChange={set('aliases')} placeholder="예: 이순신, 충무공" /></Field>
          <Field label="지역 (시·군) *">
            <select className="input" required value={f.region_id} onChange={set('region_id')}>
              <option value="">선택</option>
              {sigungus.map((r) => <option key={r.id} value={r.id}>{sidoName(r.parent_id)} {r.name}{r.is_active ? '' : ' (비활성)'}</option>)}
            </select>
          </Field>
          {role === 'super' ? (
            <Field label="기관 *">
              <select className="input" required value={f.organization_id} onChange={set('organization_id')}>
                <option value="">선택</option>
                {opts?.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          ) : <div />}
          {p && <Field label="소속 교구"><input className="input" value={f.diocese} onChange={set('diocese')} /></Field>}
          <Field label="주소" wide={!p}><input className="input" value={f.address} onChange={set('address')} /></Field>
          <Field label="대표 좌표 (지도에서 찍기)" wide>
            <KakaoPicker lat={f.lat} lng={f.lng} onChange={(la, ln) => setF({ ...f, lat: la, lng: ln })} height={260} />
          </Field>
          <Field label="소개글" wide><textarea className="input textarea" value={f.intro} onChange={set('intro')} /></Field>
          {p && <Field label="성지 역사 · 순교자 이야기" wide><textarea className="input textarea" value={f.history_text} onChange={set('history_text')} /></Field>}
          <Field label="대표 사진 (최대 5장)" wide><ImageInput kind="sites" value={f.photo_paths} onChange={set('photo_paths')} max={5} /></Field>
          <Field label={p ? '개방 시간' : '운영시간'}><input className="input" value={f.opening_hours} onChange={set('opening_hours')} /></Field>
          <Field label="휴무일"><input className="input" value={f.closed_days} onChange={set('closed_days')} /></Field>
          {p ? (
            <>
              <Field label="미사 시간"><input className="input" value={f.mass_times} onChange={set('mass_times')} /></Field>
              <Field label="단체 순례 문의"><input className="input" value={f.group_contact} onChange={set('group_contact')} /></Field>
            </>
          ) : (
            <Field label="입장료"><input className="input" value={f.admission_fee} onChange={set('admission_fee')} /></Field>
          )}
          <Field label="주차"><input className="input" value={f.parking} onChange={set('parking')} /></Field>
          <Field label="문의 전화"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
          <Field label={p ? '순례 인장 이미지 (PNG 투명 배경 권장)' : '대표 도장 이미지 (PNG 투명 배경 권장)'}>
            <ImageInput kind="stamps" value={f.stamp_image_path ? [f.stamp_image_path] : []} onChange={(v) => setF({ ...f, stamp_image_path: v[0] ?? '' })} max={1} />
          </Field>
          {!p && (
            <Field label="완주 기본 포인트" hint="비워 두면 서비스 설정의 기본값(기본 100P)을 써요">
              <input className="input" type="number" min={0} value={f.base_points} onChange={set('base_points')} placeholder="기본값" />
            </Field>
          )}
          <Field label="노출 순서"><input className="input" type="number" value={f.sort_order} onChange={set('sort_order')} /></Field>
          <label className="flex items-center gap-3 self-end pb-3">
            <input type="checkbox" className="h-6 w-6" checked={f.is_public} onChange={set('is_public')} />
            <span className="font-semibold">공개</span>
          </label>
          {err && <p className="col-span-2 font-semibold text-error">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
