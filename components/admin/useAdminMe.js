'use client';
import { useEffect, useState } from 'react';
import { adminApi } from './ui';

let cache = null;
export function useAdminMe() {
  const [me, setMe] = useState(cache);
  useEffect(() => {
    if (cache) return;
    adminApi('/api/admin/me').then((d) => {
      cache = d;
      setMe(d);
    }).catch(() => {});
  }, []);
  return me;
}
