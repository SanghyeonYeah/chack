'use client';
// 키링을 폰에 댔을 때 열리는 주소 /k/{코드}
// 확인(token_views via=nfc) → 키링 목록 맨 앞으로(B7) → 진행 중 사진 업로드 멈춤(D1) → /me?via=nfc
// 다른 웹 키링이면 그 웹으로 자동 이동, 미등록·분실은 13장 문구

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Shell from '@/components/user/Shell';
import CodeEntry from '@/components/user/CodeEntry';
import { useService } from '@/components/user/ServiceProvider';
import { useUploads, broadcastStop } from '@/components/user/UploadProvider';
import { api, errorText } from '@/lib/client/api';
import { rememberKeyring } from '@/lib/client/keyrings';

export default function KeyringEntry({ params }) {
  const { code } = use(params);
  const { service, t } = useService();
  const uploads = useUploads();
  const router = useRouter();
  const [error, setError] = useState(null);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    // 키링을 다시 대면 진행 중인 업로드를 끊음
    const stopped = uploads?.stopAll('키링을 다시 대서 사진 올리기를 멈췄어요');
    broadcastStop();
    api(`/api/tokens/${encodeURIComponent(code)}?via=nfc`)
      .then((d) => {
        const { isNew, others } = rememberKeyring(service, d.code);
        const q = new URLSearchParams({ via: 'nfc' });
        if (isNew) q.set('first', '1');
        if (others > 0) q.set('multi', String(others + 1));
        if (stopped) q.set('stopped', '1');
        router.replace(`/me?${q}`);
      })
      .catch((e) => {
        if (e.code === 'OTHER_SERVICE' && e.data?.redirect) {
          window.location.replace(e.data.redirect);
          return;
        }
        setError(e);
      });
  }, [code, service, router, uploads]);

  if (!error) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="muted" role="status">키링을 확인하고 있어요…</p>
      </main>
    );
  }

  return (
    <Shell>
      <div className="card mt-6 text-center" role="alert">
        <p className="subtitle">{errorText(error, t)}</p>
        {error.code === 'UNKNOWN_TOKEN' && <p className="muted mt-2">키링 뒷면의 코드를 다시 입력해 주세요</p>}
      </div>
      {error.code !== 'LOST_TOKEN' && error.code !== 'BLOCKED' && (
        <div className="mt-6">
          <CodeEntry intro={false} />
        </div>
      )}
      <Link href="/" className="btn btn-ghost btn-block mt-4">
        처음으로
      </Link>
    </Shell>
  );
}
