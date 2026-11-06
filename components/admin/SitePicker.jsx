'use client';
// 관광지 선택 (주소 ?site= 와 동기화)
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi } from './ui';

export function useSitePick() {
  const sp = useSearchParams();
  const router = useRouter();
  const [opts, setOpts] = useState(null);
  useEffect(() => {
    adminApi('/api/admin/org').then(setOpts).catch(() => setOpts({ sites: [], regions: [], orgs: [] }));
  }, []);
  const siteId = sp.get('site') || opts?.sites[0]?.id || null;
  const select = (id) => {
    const q = new URLSearchParams(sp);
    q.set('site', id);
    router.replace(`?${q}`);
  };
  return { opts, siteId, site: opts?.sites.find((s) => s.id === siteId) ?? null, select };
}

export default function SitePicker({ opts, siteId, onSelect, label = '관광지' }) {
  return (
    <label className="flex items-center gap-2">
      <span className="small font-semibold whitespace-nowrap">{label}</span>
      <select className="input w-auto min-w-[240px]" value={siteId ?? ''} onChange={(e) => onSelect(e.target.value)}>
        {opts?.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}
