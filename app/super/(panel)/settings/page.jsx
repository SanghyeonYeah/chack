'use client';
// S-05 서비스 설정: 완주 기본 포인트, 시·군 배수, 도 배수, 기능 스위치

import { useEffect, useState } from 'react';
import { Field, Notice, PageHead, adminApi, errMsg } from '@/components/admin/ui';

export default function SettingsSuper() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    adminApi('/api/super/settings').then((d) => setS(d.settings));
  }, []);
  if (!s) return <p className="muted">불러오는 중…</p>;

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminApi('/api/super/settings', {
        method: 'PUT',
        body: {
          ...s,
          base_points: Number(s.base_points),
          sigungu_multiplier: Number(s.sigungu_multiplier),
          sido_multiplier: Number(s.sido_multiplier),
          photo_limit_per_visit: Number(s.photo_limit_per_visit),
        },
      });
      setMsg({ text: '저장했어요. 이후 완주부터 적용돼요 (이미 지급된 포인트는 바뀌지 않아요).' });
    } catch (e2) {
      setMsg({ err: true, text: errMsg(e2) });
    }
  };
  const num = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const base = Number(s.base_points) || 0;

  return (
    <>
      <PageHead title="서비스 설정" />
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <form onSubmit={save} className="grid grid-cols-2 gap-6">
        <div className="card space-y-4">
          <p className="subtitle">포인트</p>
          <Field label="완주 기본 포인트" hint="관광지별 값이 비어 있을 때 쓰고, 보너스 계산의 기준이에요"><input className="input" type="number" min={0} value={s.base_points} onChange={num('base_points')} /></Field>
          <Field label="시·군 전체 완주 배수" hint={`보너스 = ${base} × ${s.sigungu_multiplier} = ${base * (Number(s.sigungu_multiplier) || 0)}P (1회)`}><input className="input" type="number" min={0} value={s.sigungu_multiplier} onChange={num('sigungu_multiplier')} /></Field>
          <Field label="도 전체 완주 배수" hint={`보너스 = ${base} × ${s.sido_multiplier} = ${base * (Number(s.sido_multiplier) || 0)}P (1회)`}><input className="input" type="number" min={0} value={s.sido_multiplier} onChange={num('sido_multiplier')} /></Field>
        </div>
        <div className="card space-y-4">
          <p className="subtitle">기능 스위치</p>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-6 w-6" checked={s.pilgrim_points_enabled === true} onChange={(e) => setS({ ...s, pilgrim_points_enabled: e.target.checked })} />
            <span><b>순례 웹 포인트</b> (pilgrim_points_enabled)<br /><span className="small muted">꺼져 있으면 순례 웹 어디에도 포인트가 보이지 않아요</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-6 w-6" checked={s.point_exchange_enabled === true} onChange={(e) => setS({ ...s, point_exchange_enabled: e.target.checked })} />
            <span><b>포인트 교환</b> (point_exchange_enabled)<br /><span className="small muted">v1에서는 실제 교환 없이 안내 화면만 보여요</span></span>
          </label>
          <Field label="방문 1건당 사진 최대 장수"><input className="input" type="number" min={1} max={10} value={s.photo_limit_per_visit} onChange={num('photo_limit_per_visit')} /></Field>
        </div>
        <div className="col-span-2 flex justify-end"><button className="btn btn-primary">저장</button></div>
      </form>
    </>
  );
}
