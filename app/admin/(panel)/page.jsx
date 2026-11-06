'use client';
// T-A-02 / P-A-02 대시보드

import Link from 'next/link';
import { PageHead, Stat, useAdminData, fmtTime } from '@/components/admin/ui';
import { useAdminMe } from '@/components/admin/useAdminMe';

export default function Dashboard() {
  const me = useAdminMe();
  const { data: d, error, reload } = useAdminData('/api/admin/dashboard');
  const p = me?.service === 'pilgrim';
  const stamp = p ? '인장' : '도장';

  return (
    <>
      <PageHead title="대시보드" desc={`${me?.org?.name ?? '전체 기관'} · 오늘 ${d?.today ?? ''} 기준`}>
        <button className="btn btn-secondary btn-sm" onClick={reload}>새로고침</button>
      </PageHead>
      {error && <p className="text-error">{error}</p>}
      {d && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label={`오늘 ${p ? '순례' : '참여'} 키링`} value={d.today_keyrings} />
            <Stat label={`오늘 ${stamp} 수`} value={d.today_stamps} />
            <Stat label={`누적 ${p ? '순례' : '참여'} 키링`} value={d.total_keyrings} />
            <Stat label={`누적 ${p ? '순례 완료' : '완주'} 수`} value={d.total_completions} />
            <Stat label={p ? '순례 완료율' : '완주율'} value={`${d.completion_rate}%`} sub="참여 키링 중 1곳 이상 완주" />
            <Stat
              label="리더 상태"
              value={`${d.readers.ok} / ${d.readers.total}`}
              sub={d.readers.down.length ? `끊김 ${d.readers.down.length}대` : d.readers.unregistered ? `미등록 ${d.readers.unregistered}대` : '모두 정상'}
              warn={d.readers.down.length > 0}
            />
          </div>
          {d.readers.down.length > 0 && (
            <section className="card mt-6 border-error">
              <p className="font-semibold text-error">끊긴 리더 {d.readers.down.length}대</p>
              <ul className="mt-2 space-y-1">
                {d.readers.down.map((r) => (
                  <li key={r.id}>
                    {r.site_name} · {r.checkpoint_name ?? '지점 없음'} — {r.name} <span className="muted">(마지막 신호 {fmtTime(r.last_seen_at)}, 대기 {r.pending_count}건)</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/readers" className="btn btn-secondary btn-sm mt-3">리더 관리로</Link>
            </section>
          )}
          <p className="mt-6 small muted">통계는 우리 기관 {p ? '성지' : '관광지'}에서 찍힌 {stamp} 기준이에요. 다른 기관이 배포한 키링도 포함돼요.</p>
        </>
      )}
    </>
  );
}
