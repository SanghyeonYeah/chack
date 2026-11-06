'use client';
// T-U-11 주변 관광지 추천 / P-U-09 다음 성지

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Shell, { ErrorBox, Loading } from '@/components/user/Shell';
import SiteCard from '@/components/user/SiteCard';
import { useService } from '@/components/user/ServiceProvider';
import { cachedApi, errorText } from '@/lib/client/api';

export default function NearbyPage() {
  return (
    <Suspense>
      <Nearby />
    </Suspense>
  );
}

function Nearby() {
  const { t, primary, ready } = useService();
  const sp = useSearchParams();
  const site = sp.get('site');
  const next = sp.get('next');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ready || !site) return;
    cachedApi(`/api/sites/${site}/nearby`, { token: primary, onCached: setD }).then(setD).catch((e) => setError(errorText(e, t)));
  }, [ready, primary, site, t]);

  if (error) return <Shell><ErrorBox message={error} /></Shell>;
  if (!d) return <Shell><Loading /></Shell>;

  return (
    <Shell>
      <h1 className="title">{t.nearbyTitle(d.site_name)}</h1>
      {d.sites.length === 0 ? (
        <div className="card mt-8 text-center">
          <p className="subtitle">{t.allDone}</p>
          <Link href="/regions" className="btn btn-primary btn-block mt-5">다른 지역 보기</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {d.sites.map((s) => (
            <li key={s.id}>
              <SiteCard site={s} distance={s.km != null ? Number(s.km) : null} />
            </li>
          ))}
        </ul>
      )}
      {next && (
        <Link href={`/me/complete/${next}`} className="btn btn-secondary btn-block mt-6">다음 완주 보기</Link>
      )}
    </Shell>
  );
}
