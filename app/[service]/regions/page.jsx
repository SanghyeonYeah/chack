'use client';
// T-U-03 지역 선택 / P-U-02 지역 선택: 도 → 시·군, 관광지 수 · 내 완료율

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import { useService } from '@/components/user/ServiceProvider';
import { api, errorText } from '@/lib/client/api';
import { getFlag, setFlag } from '@/lib/client/keyrings';
import { rate } from '@/lib/format';

export default function RegionsPage() {
  const { service, t, primary, ready, showToast } = useService();
  const router = useRouter();
  const [regions, setRegions] = useState(null);
  const [error, setError] = useState(null);
  const [sido, setSido] = useState(null);

  const load = () => {
    setError(null);
    api('/api/regions', { token: primary })
      .then((d) => {
        setRegions(d.regions);
        const sidos = d.regions.filter((r) => r.level === 'sido');
        const last = getFlag(service, 'region');
        const lastParent = d.regions.find((r) => r.id === last)?.parent_id;
        setSido(lastParent ?? sidos.find((s) => s.total > 0)?.id ?? sidos[0]?.id ?? null);
      })
      .catch((e) => setError(errorText(e, t)));
  };
  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, primary]);

  const pick = (r) => {
    if (!r.is_active || r.total === 0) {
      showToast('곧 열려요');
      return;
    }
    setFlag(service, 'region', r.id);
    router.push(`/sites?region=${r.id}`);
  };

  const sidos = regions?.filter((r) => r.level === 'sido') ?? [];
  const sigungus = regions?.filter((r) => r.level === 'sigungu' && r.parent_id === sido) ?? [];

  return (
    <Shell>
      <h1 className="title">어디로 떠나볼까요?</h1>
      <p className="muted mt-2">{t.place}가 있는 지역을 골라 주세요</p>
      {error && <div className="mt-8"><ErrorBox message={error} onRetry={load} /></div>}
      {!regions && !error && <Loading />}
      {regions && (
        <>
          <div className="mt-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="도">
            {sidos.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={s.id === sido}
                onClick={() => (s.total > 0 ? setSido(s.id) : showToast('곧 열려요'))}
                className={`btn btn-sm shrink-0 ${s.id === sido ? 'btn-primary' : 'btn-secondary'} ${s.total > 0 ? '' : 'opacity-50'}`}
              >
                {s.name}
                {s.total === 0 && ' · 준비 중'}
              </button>
            ))}
          </div>
          <ul className="mt-6 space-y-3">
            {sigungus.map((r) => {
              const off = !r.is_active || r.total === 0;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => pick(r)}
                    className={`card flex w-full items-center justify-between text-left ${off ? 'opacity-55' : 'hover:border-primary'}`}
                    aria-disabled={off}
                  >
                    <span>
                      <span className="subtitle block">{r.name}</span>
                      <span className="small muted">
                        {off ? '준비 중' : `${t.place} ${r.total}곳${primary ? ` · ${rate(r.done, r.total)}%` : ''}`}
                      </span>
                    </span>
                    {!off && (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden>
                        <path d="m9 5 7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Shell>
  );
}
