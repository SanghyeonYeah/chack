'use client';
// T-U-04 관광지 검색 · 목록 / P-U-03 성지 목록 (검색 없음)

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import SiteCard from '@/components/user/SiteCard';
import { useService } from '@/components/user/ServiceProvider';
import { cachedApi, errorText } from '@/lib/client/api';
import { getFlag, setFlag } from '@/lib/client/keyrings';
import { km, rate } from '@/lib/format';

export default function SitesPage() {
  return (
    <Suspense>
      <Sites />
    </Suspense>
  );
}

function Sites() {
  const { service, t, primary, ready } = useService();
  const router = useRouter();
  const sp = useSearchParams();
  const [regions, setRegions] = useState(null);
  const [sites, setSites] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(null);
  const [nearSort, setNearSort] = useState(false);

  const regionId = sp.get('region') || (ready ? getFlag(service, 'region') : null);

  useEffect(() => {
    if (!ready) return;
    cachedApi('/api/regions', { token: primary, onCached: (d) => setRegions(d.regions) })
      .then((d) => setRegions(d.regions))
      .catch(() => setRegions([]));
  }, [ready, primary]);

  const region = regions?.find((r) => r.id === regionId);
  const siblings = regions?.filter((r) => r.level === 'sigungu' && region && r.parent_id === region.parent_id && r.is_active && r.total > 0) ?? [];

  const load = () => {
    if (!ready) return;
    setError(null);
    setSites(null);
    cachedApi(`/api/sites${regionId ? `?region=${regionId}` : ''}`, { token: primary, onCached: (d) => setSites(d.sites) })
      .then((d) => setSites(d.sites))
      .catch((e) => setError(errorText(e, t)));
  };
  useEffect(load, [ready, primary, regionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!regions || regionId) return;
    const first = regions.find((r) => r.level === 'sigungu' && r.is_active && r.total > 0);
    if (first) router.replace(`/sites?region=${first.id}`);
  }, [regions, regionId, router]);

  // 위치: 허용 시에만 거리 표시 (서버로 보내지 않음)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos(null),
      { maximumAge: 300000, timeout: 10000 },
    );
  }, []);

  const shown = useMemo(() => {
    if (!sites) return [];
    let list = sites;
    const query = q.trim().toLowerCase();
    if (service === 'tour' && query.length >= 2) {
      list = list.filter((s) => [s.name, ...(s.aliases ?? [])].some((n) => n.toLowerCase().includes(query)));
    }
    list = list.map((s) => ({ ...s, _km: pos ? km(pos, s) : null }));
    if (nearSort && pos) list = [...list].sort((a, b) => (a._km ?? 1e9) - (b._km ?? 1e9));
    return list;
  }, [sites, q, pos, nearSort, service]);

  const done = sites?.filter((s) => s.completed_at).length ?? 0;
  const total = sites?.length ?? 0;
  const pct = rate(done, total);

  return (
    <Shell>
      {siblings.length > 1 && (
        <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="지역">
          {siblings.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={r.id === regionId}
              className={`btn btn-sm shrink-0 ${r.id === regionId ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setFlag(service, 'region', r.id);
                router.replace(`/sites?region=${r.id}`);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      <h1 className="title">{region?.name ?? t.place}</h1>

      {service === 'tour' && (
        <div className="relative mt-5">
          <input
            className="input pl-12"
            type="search"
            placeholder={t.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t.searchPlaceholder}
          />
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
      )}

      {sites && primary && total > 0 && (
        <div className="card mt-5">
          <p className="font-semibold">{t.regionRate(region?.name ?? '', pct, done, total)}</p>
          <div className="bar mt-3" aria-hidden>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {pos && sites?.length > 1 && (
        <div className="mt-4 flex justify-end">
          <button className={`btn btn-sm ${nearSort ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setNearSort((v) => !v)}>
            가까운 순
          </button>
        </div>
      )}

      {error && <div className="mt-6"><ErrorBox message={error} onRetry={load} /></div>}
      {!sites && !error && <Loading />}
      {sites && (
        <ul className="mt-5 space-y-3">
          {shown.map((s) => (
            <li key={s.id}>
              <SiteCard site={s} distance={s._km} />
            </li>
          ))}
          {shown.length === 0 && <li className="card text-center muted">{t.noResult}</li>}
        </ul>
      )}
    </Shell>
  );
}
