'use client';
// S-04 전체 통계: 두 웹 전체 · 기관별 참여 키링, 도장, 완주, 재태그

import { useState } from 'react';
import { PageHead, PeriodPicker, Stat, Table, Td, periodQuery, useAdminData } from '@/components/admin/ui';

export default function StatsSuper() {
  const [period, setPeriod] = useState({ period: '30d' });
  const ready = period.period !== 'custom' || (period.from && period.to);
  const { data } = useAdminData(ready ? `/api/super/stats?${periodQuery(period)}` : null);

  return (
    <>
      <PageHead title="전체 통계" desc={data ? `${data.from} ~ ${data.to} (한국 시간)` : ''}>
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHead>
      {data && ['tour', 'pilgrim'].map((s) => {
        const d = data[s];
        const f = d.period.funnel;
        const stamp = s === 'pilgrim' ? '인장' : '도장';
        return (
          <section key={s} className="mb-10">
            <h2 className="subtitle mb-3">{s === 'tour' ? '관광지 웹' : '순례 웹'}</h2>
            <div className="grid grid-cols-5 gap-3">
              <Stat label="기간 참여 키링" value={d.period.keyrings} />
              <Stat label={`기간 ${stamp}`} value={d.period.stamps} />
              <Stat label={`기간 ${s === 'pilgrim' ? '순례 완료' : '완주'}`} value={d.period.completions} />
              <Stat label="누적 참여 키링" value={d.total.total_keyrings} />
              <Stat label="7일 후 재태그" value={`${f.retag}/${f.retag_base}`} sub={`nfc ${f.retag_nfc} · 코드 ${f.retag_manual}`} />
            </div>
            <div className="mt-4">
              <Table head={['기관', '관광지·성지', '배정 키링', '누적 참여 키링', `누적 ${stamp}`, '누적 완주']}>
                {d.orgs.map((o) => (
                  <tr key={o.id}>
                    <Td className="font-semibold">{o.name}{!o.is_active && <span className="chip ml-2">비활성</span>}</Td>
                    <Td className="tabular-nums">{o.sites}</Td>
                    <Td className="tabular-nums">{o.tokens}</Td>
                    <Td className="tabular-nums">{o.keyrings}</Td>
                    <Td className="tabular-nums">{o.stamps}</Td>
                    <Td className="tabular-nums">{o.completions}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          </section>
        );
      })}
    </>
  );
}
