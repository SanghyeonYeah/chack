'use client';
// 관광지 카드 (T-U-04 / T-U-11 / P-U-03 공통)

import Link from 'next/link';
import { mediaUrl } from '@/lib/media';
import { md } from '@/lib/format';
import { PhotoPlaceholder } from './Stamp';
import { useService } from './ServiceProvider';
import { prefetchApi } from '@/lib/client/api';

export default function SiteCard({ site, distance }) {
  const { t, service, primary } = useService();
  const warm = () => prefetchApi(`/api/sites/${site.id}`, { token: primary });
  const photo = mediaUrl(site.photo);
  let status;
  if (site.completed_at) status = <span className="chip chip-done">✔ {t.completed} {md(site.completed_at)}</span>;
  else if (site.done > 0) status = <span className="chip chip-progress">진행 {site.done}/{site.total}</span>;
  else status = <span className="chip">{t.unvisited}</span>;

  return (
    <Link href={`/sites/${site.id}`} onPointerDown={warm} onMouseEnter={warm} className="card flex gap-4 p-3 hover:border-primary">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-[calc(var(--r-card)-6px)] object-cover" />
      ) : (
        <PhotoPlaceholder className="h-24 w-24 shrink-0 rounded-[calc(var(--r-card)-6px)]" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="subtitle truncate text-[20px]">{site.name}</p>
        <p className="small muted">
          {service === 'pilgrim' && site.diocese ? `${site.diocese} · ` : ''}지점 {site.total}곳
          {distance != null && ` · ${distance.toFixed(1)}km`}
        </p>
        <div>{status}</div>
      </div>
    </Link>
  );
}
