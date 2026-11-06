'use client';
// T-A-08 / P-A-10 데이터 내보내기 (CSV, 키링 코드 앞 4자리 가림, 사진·메모 제외)

import { useState } from 'react';
import { PageHead, PeriodPicker, periodQuery } from '@/components/admin/ui';
import { useAdminMe } from '@/components/admin/useAdminMe';

export default function ExportAdmin() {
  const me = useAdminMe();
  const [period, setPeriod] = useState({ period: '30d' });
  const ok = period.period !== 'custom' || (period.from && period.to);
  const p = me?.service === 'pilgrim';
  const items = [
    ['visits', '방문 기록', `방문일 · 태그 시각 · 키링(****2PQA) · ${p ? '성지' : '관광지'} · 지점`],
    ['daily', '날짜별 통계', `날짜 · 참여 키링 · ${p ? '인장' : '도장'} 수`],
    ['checkpoints', '지점별 방문 수', `${p ? '성지' : '관광지'} · 지점 · 방문 수`],
    ['funnel', '단계별 이탈', '첫 태그 → … → 7일 후 재태그'],
  ];
  return (
    <>
      <PageHead title="데이터 내보내기" desc="엑셀에서 바로 열 수 있는 CSV예요. 키링 코드는 앞 4자리를 가리고, 사진·메모는 포함하지 않아요.">
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHead>
      <div className="grid grid-cols-2 gap-4">
        {items.map(([type, title, desc]) => (
          <div key={type} className="card flex flex-col gap-3">
            <p className="subtitle">{title}</p>
            <p className="muted flex-1">{desc}</p>
            <a className={`btn btn-primary ${ok ? '' : 'pointer-events-none opacity-50'}`} href={`/api/admin/export?type=${type}&${periodQuery(period)}`}>CSV 내려받기</a>
          </div>
        ))}
      </div>
    </>
  );
}
