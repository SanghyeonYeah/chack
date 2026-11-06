'use client';
// 비밀번호 재설정 메일 링크로 들어오는 화면

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    const code = new URLSearchParams(location.search).get('code');
    (code ? sb.auth.exchangeCodeForSession(code) : sb.auth.getSession()).finally(() => setReady(true));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ err: true, text: '비밀번호는 8자 이상으로 정해 주세요.' });
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) return setMsg({ err: true, text: '링크가 만료되었어요. 재설정 메일을 다시 받아 주세요.' });
    location.href = '/admin';
  };

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={submit} className="card w-full max-w-[400px] space-y-4 p-8">
        <h1 className="title text-[26px]">새 비밀번호</h1>
        <input className="input" type="password" autoComplete="new-password" placeholder="8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!ready} />
        {msg && <p className={`small font-semibold ${msg.err ? 'text-error' : 'text-success'}`}>{msg.text}</p>}
        <button className="btn btn-primary btn-block" disabled={!ready}>저장</button>
      </form>
    </main>
  );
}
