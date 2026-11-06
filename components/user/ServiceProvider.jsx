'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { terms } from '@/lib/terms';
import { getKeyrings, onKeyringsChange } from '@/lib/client/keyrings';

const Ctx = createContext(null);

/** 사용자 화면 공통: 웹 종류, 용어, 이 폰의 키링 목록, 토스트 */
export function ServiceProvider({ service, children }) {
  const [keyrings, setKeyrings] = useState([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const sync = () => setKeyrings(getKeyrings(service));
    sync();
    setReady(true);
    return onKeyringsChange(sync);
  }, [service]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((msg) => setToast({ msg, at: Date.now() }), []);

  const value = useMemo(
    () => ({ service, t: terms(service), keyrings, primary: keyrings[0] ?? null, ready, showToast }),
    [service, keyrings, ready, showToast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div key={toast.at} className="toast" role="status">
          {toast.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useService() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ServiceProvider missing');
  return v;
}
