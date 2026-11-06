'use client';
// T-A-01 / P-A-01 로그인: 이메일 + 비밀번호, 비밀번호 재설정 메일

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('login');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    if (mode === 'reset') {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/admin/reset` });
      setMsg(error ? { err: true, text: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.' } : { text: '비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.' });
      setBusy(false);
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMsg({ err: true, text: '이메일 또는 비밀번호가 맞지 않아요.' });
      setBusy(false);
      return;
    }
    const r = await fetch('/api/admin/me', { cache: 'no-store' });
    if (!r.ok) {
      await sb.auth.signOut();
      setMsg({ err: true, text: '관리자 권한이 없는 계정이에요. 최고 관리자에게 문의해 주세요.' });
      setBusy(false);
      return;
    }
    location.href = '/admin';
  };

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={submit} className="card w-full max-w-[400px] space-y-4 p-8">
        <div>
          <p className="font-serif text-[18px] font-bold tracking-[.3em] text-primary">CHAK · 착</p>
          <h1 className="title mt-2 text-[26px]">{mode === 'reset' ? '비밀번호 재설정' : '관리자 로그인'}</h1>
        </div>
        <label className="block">
          <span className="small muted">이메일</span>
          <input className="input mt-1" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === 'login' && (
          <label className="block">
            <span className="small muted">비밀번호</span>
            <input className="input mt-1" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {msg && <p className={`small font-semibold ${msg.err ? 'text-error' : 'text-success'}`} role="alert">{msg.text}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '확인 중…' : mode === 'reset' ? '재설정 메일 보내기' : '로그인'}</button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setMsg(null); }}>
          {mode === 'login' ? '비밀번호를 잊으셨나요?' : '로그인으로 돌아가기'}
        </button>
      </form>
    </main>
  );
}
