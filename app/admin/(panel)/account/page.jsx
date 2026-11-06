'use client';
// T-A-09 기관 정보 · 계정 (기관 이름, 담당자 연락처, 비밀번호 변경)

import { useEffect, useState } from 'react';
import { Field, Notice, PageHead, adminApi, errMsg } from '@/components/admin/ui';

export default function AccountAdmin() {
  const [me, setMe] = useState(null);
  const [org, setOrg] = useState(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    adminApi('/api/admin/me').then((d) => {
      setMe(d);
      setOrg(d.org);
    });
  }, []);

  const saveOrg = async (e) => {
    e.preventDefault();
    try {
      await adminApi('/api/admin/me', { method: 'PUT', body: org });
      setMsg({ text: '기관 정보를 저장했어요' });
    } catch (e2) {
      setMsg({ err: true, text: errMsg(e2) });
    }
  };
  const savePw = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setMsg({ err: true, text: '두 비밀번호가 달라요' });
    try {
      await adminApi('/api/admin/me', { method: 'POST', body: { password: pw } });
      setPw('');
      setPw2('');
      setMsg({ text: '비밀번호를 바꿨어요' });
    } catch (e2) {
      setMsg({ err: true, text: errMsg(e2) });
    }
  };

  return (
    <>
      <PageHead title={org ? '기관 정보 · 계정' : '내 계정'} desc={me?.email} />
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <div className="grid grid-cols-2 gap-6">
        {org && (
          <form onSubmit={saveOrg} className="card space-y-4">
            <p className="subtitle">기관 정보</p>
            <Field label="기관 이름"><input className="input" required value={org.name ?? ''} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></Field>
            <Field label="담당자"><input className="input" value={org.contact_name ?? ''} onChange={(e) => setOrg({ ...org, contact_name: e.target.value })} /></Field>
            <Field label="연락처"><input className="input" value={org.contact_phone ?? ''} onChange={(e) => setOrg({ ...org, contact_phone: e.target.value })} /></Field>
            <Field label="이메일"><input className="input" value={org.contact_email ?? ''} onChange={(e) => setOrg({ ...org, contact_email: e.target.value })} /></Field>
            <button className="btn btn-primary">저장</button>
          </form>
        )}
        <form onSubmit={savePw} className="card space-y-4">
          <p className="subtitle">비밀번호 변경</p>
          <Field label="새 비밀번호 (8자 이상)"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="새 비밀번호 확인"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          <button className="btn btn-primary" disabled={pw.length < 8}>변경</button>
        </form>
      </div>
    </>
  );
}
