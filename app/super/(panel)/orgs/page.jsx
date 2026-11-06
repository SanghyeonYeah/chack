'use client';
// S-01 기관 · 계정 관리: 기관 만들기(소속 웹), 관리자 계정 발급·비활성, 관광지·성지를 기관에 배정

import { useState } from 'react';
import { Field, Modal, Notice, PageHead, Table, Td, adminApi, errMsg, fmtDate, useAdminData } from '@/components/admin/ui';

const SVC = { tour: '관광지', pilgrim: '순례' };

export default function OrgsSuper() {
  const { data, reload } = useAdminData('/api/super/orgs');
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);

  const run = async (fn, ok) => {
    try {
      const r = await fn();
      setMsg({ text: typeof ok === 'function' ? ok(r) : ok });
      reload();
    } catch (e) {
      setMsg({ err: true, text: errMsg(e) });
    }
  };

  const orgName = (id) => data?.orgs.find((o) => o.id === id)?.name;

  return (
    <>
      <PageHead title="기관 · 계정 관리" desc="기관 관리자는 자기 기관의 관광지(성지)만 보고 고칠 수 있어요.">
        <button className="btn btn-secondary" onClick={() => setModal({ type: 'admin' })}>+ 관리자 계정 발급</button>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'org' })}>+ 기관 만들기</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />

      <h2 className="subtitle mb-3">기관</h2>
      <Table head={['웹', '기관', '담당자', '연락처', '관광지·성지', '상태', '']}>
        {data?.orgs.map((o) => (
          <tr key={o.id}>
            <Td><span className="chip">{SVC[o.service]}</span></Td>
            <Td className="font-semibold">{o.name}</Td>
            <Td>{o.contact_name}</Td>
            <Td>{o.contact_phone}</Td>
            <Td className="small">{o.sites.map((s) => s.name).join(', ') || <span className="muted">없음</span>}</Td>
            <Td>{o.is_active ? <span className="chip chip-done">활성</span> : <span className="chip">비활성</span>}</Td>
            <Td className="whitespace-nowrap text-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'org', org: o })}>수정</button>
              <button className="btn btn-secondary btn-sm ml-1" onClick={() => setModal({ type: 'assign', org: o })}>관광지 배정</button>
              <button className="btn btn-ghost btn-sm" onClick={() => run(() => adminApi(`/api/super/orgs/${o.id}`, { method: 'PUT', body: { is_active: !o.is_active } }), '바꿨어요')}>
                {o.is_active ? '비활성' : '활성'}
              </button>
            </Td>
          </tr>
        ))}
      </Table>

      <h2 className="subtitle mt-10 mb-3">관리자 계정</h2>
      <Table head={['이메일', '권한', '기관', '만든 날', '상태', '']}>
        {data?.admins.map((a) => (
          <tr key={a.id}>
            <Td className="font-semibold">{a.email}</Td>
            <Td>{a.role === 'super' ? '최고 관리자' : '기관 관리자'}</Td>
            <Td>{a.organization_id ? orgName(a.organization_id) : '—'}</Td>
            <Td>{fmtDate(a.created_at)}</Td>
            <Td>{a.is_active ? <span className="chip chip-done">활성</span> : <span className="chip">비활성</span>}</Td>
            <Td className="whitespace-nowrap text-right">
              <button className="btn btn-ghost btn-sm" onClick={() => confirm(`${a.email} 비밀번호를 초기화할까요?`) && run(() => adminApi(`/api/super/admins/${a.id}`, { method: 'PUT', body: { reset_password: true } }), (r) => `임시 비밀번호: ${r.temp_password}\n(이 화면을 닫으면 다시 볼 수 없어요. 본인에게 전달하고 로그인 후 바꾸게 해 주세요)`)}>비밀번호 초기화</button>
              <button className="btn btn-ghost btn-sm" onClick={() => run(() => adminApi(`/api/super/admins/${a.id}`, { method: 'PUT', body: { is_active: !a.is_active } }), '바꿨어요')}>
                {a.is_active ? '비활성' : '활성'}
              </button>
            </Td>
          </tr>
        ))}
      </Table>

      {modal?.type === 'org' && <OrgForm org={modal.org} onClose={() => setModal(null)} onDone={(t) => { setModal(null); setMsg({ text: t }); reload(); }} />}
      {modal?.type === 'admin' && <AdminForm orgs={data?.orgs ?? []} onClose={() => setModal(null)} onDone={(t) => { setModal(null); setMsg({ text: t }); reload(); }} />}
      {modal?.type === 'assign' && <AssignForm org={modal.org} onClose={() => setModal(null)} onDone={(t) => { setModal(null); setMsg({ text: t }); reload(); }} />}
    </>
  );
}

function OrgForm({ org, onClose, onDone }) {
  const [f, setF] = useState({ service: org?.service ?? 'tour', name: org?.name ?? '', contact_name: org?.contact_name ?? '', contact_phone: org?.contact_phone ?? '', contact_email: org?.contact_email ?? '' });
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    try {
      if (org) await adminApi(`/api/super/orgs/${org.id}`, { method: 'PUT', body: f });
      else await adminApi('/api/super/orgs', { method: 'POST', body: f });
      onDone('저장했어요');
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };
  return (
    <Modal title={org ? '기관 수정' : '기관 만들기'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {!org && (
          <Field label="소속 웹 *">
            <select className="input" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
              <option value="tour">관광지 웹</option>
              <option value="pilgrim">순례 웹</option>
            </select>
          </Field>
        )}
        <Field label="기관 이름 *"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="담당자"><input className="input" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
        <Field label="연락처"><input className="input" value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></Field>
        <Field label="이메일"><input className="input" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></Field>
        {err && <p className="font-semibold text-error">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>취소</button><button className="btn btn-primary">저장</button></div>
      </form>
    </Modal>
  );
}

function AdminForm({ orgs, onClose, onDone }) {
  const [f, setF] = useState({ email: '', role: 'org', organization_id: '', display_name: '' });
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    try {
      setResult(await adminApi('/api/super/admins', { method: 'POST', body: f }));
    } catch (e2) {
      setErr(errMsg(e2));
    }
  };
  if (result) {
    return (
      <Modal title="계정을 만들었어요" onClose={() => onDone('계정을 만들었어요')}>
        <p>이메일: <b>{result.email}</b></p>
        <p className="mt-2">임시 비밀번호: <b className="font-mono text-[20px]">{result.temp_password}</b></p>
        <p className="mt-3 small muted">이 창을 닫으면 다시 볼 수 없어요. 담당자에게 전달하고, 첫 로그인 뒤 비밀번호를 바꾸게 해 주세요.</p>
        <button className="btn btn-primary btn-block mt-5" onClick={() => onDone('계정을 만들었어요')}>확인</button>
      </Modal>
    );
  }
  return (
    <Modal title="관리자 계정 발급" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="이메일 *"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="권한">
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="org">기관 관리자</option>
            <option value="super">최고 관리자</option>
          </select>
        </Field>
        {f.role === 'org' && (
          <Field label="기관 *">
            <select className="input" required value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value })}>
              <option value="">선택</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>[{SVC[o.service]}] {o.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="표시 이름"><input className="input" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
        {err && <p className="font-semibold text-error">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>취소</button><button className="btn btn-primary">발급</button></div>
      </form>
    </Modal>
  );
}

function AssignForm({ org, onClose, onDone }) {
  const { data } = useAdminData('/api/super/regions');
  const [sites, setSites] = useState(null);
  const [pick, setPick] = useState('');
  const [err, setErr] = useState(null);
  if (!sites && data) {
    adminApi('/api/admin/sites').then((d) => setSites(d.sites)).catch(() => setSites([]));
  }
  const save = async () => {
    try {
      await adminApi(`/api/super/orgs/${org.id}`, { method: 'PUT', body: { assign_site: pick } });
      onDone('배정했어요');
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <Modal title={`${org.name}에 배정`} onClose={onClose}>
      <p className="mb-3 small muted">지금 접속한 웹의 관광지(성지)만 보여요. 다른 웹은 그 웹 주소의 /super에서 배정해 주세요.</p>
      <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">선택</option>
        {sites?.map((s) => <option key={s.id} value={s.id}>{s.name} (현재: {s.org_name})</option>)}
      </select>
      {err && <p className="mt-2 font-semibold text-error">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><button className="btn btn-secondary" onClick={onClose}>취소</button><button className="btn btn-primary" disabled={!pick} onClick={save}>배정</button></div>
    </Modal>
  );
}
