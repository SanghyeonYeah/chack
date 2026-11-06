'use client';
// T-A-03 관광지 관리 / P-A-03 성지 관리

import { useState } from 'react';
import Link from 'next/link';
import { PageHead, Table, Td, Notice, useAdminData, adminApi, errMsg } from '@/components/admin/ui';
import { useAdminMe } from '@/components/admin/useAdminMe';
import SiteForm from '@/components/admin/SiteForm';

export default function SitesAdmin() {
  const me = useAdminMe();
  const { data, error, reload } = useAdminData('/api/admin/sites');
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const place = me?.service === 'pilgrim' ? '성지' : '관광지';

  const remove = async (s) => {
    if (!confirm(`${s.name}을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
    try {
      await adminApi(`/api/admin/sites/${s.id}`, { method: 'DELETE' });
      setMsg({ text: '삭제했어요' });
      reload();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };
  const togglePublic = async (s) => {
    await adminApi(`/api/admin/sites/${s.id}`, { method: 'PUT', body: { is_public: !s.is_public } }).catch((e) => setMsg({ err: true, text: errMsg(e) }));
    reload();
  };

  return (
    <>
      <PageHead title={`${place} 관리`} desc={`공개 지점이 0개인 ${place}는 사용자 화면에 보이지 않고 완료율 계산에서도 빠져요.`}>
        <button className="btn btn-primary" onClick={() => setEdit('new')}>+ {place} 등록</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      {error && <p className="text-error">{error}</p>}
      <Table head={['순서', '이름', '지역', me?.role === 'super' ? '기관' : null, '지점(공개/전체)', me?.service === 'tour' ? '완주 포인트' : null, '공개', ''].filter((x) => x !== null)}>
        {data?.sites.map((s) => (
          <tr key={s.id}>
            <Td className="tabular-nums">{s.sort_order}</Td>
            <Td className="font-semibold">{s.name}</Td>
            <Td>{s.region_name}</Td>
            {me?.role === 'super' && <Td>{s.org_name}</Td>}
            <Td>
              <Link href={`/admin/checkpoints?site=${s.id}`} className="underline underline-offset-4">{s.public_checkpoints} / {s.checkpoints}</Link>
              {s.public_checkpoints === 0 && <span className="ml-2 small text-error">사용자 화면 미노출</span>}
            </Td>
            {me?.service === 'tour' && <Td>{s.base_points == null ? <span className="muted">기본값</span> : `${s.base_points}P`}</Td>}
            <Td>
              <button className={`chip ${s.is_public ? 'chip-done' : ''}`} onClick={() => togglePublic(s)}>{s.is_public ? '공개' : '비공개'}</button>
            </Td>
            <Td className="whitespace-nowrap text-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setEdit(s.id)}>수정</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(s)}>삭제</button>
            </Td>
          </tr>
        ))}
      </Table>
      {edit && (
        <SiteForm
          id={edit === 'new' ? null : edit}
          service={me?.service}
          role={me?.role}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); setMsg({ text: '저장했어요. 사용자 화면에 바로 반영돼요.' }); reload(); }}
        />
      )}
    </>
  );
}
