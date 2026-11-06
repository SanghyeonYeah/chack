'use client';
// T-A-07 / P-A-09 통계: 기간 · 날짜별 참여 키링·도장 · 지점별 방문 · 시간대별 태그 · 단계별 이탈

import { useState } from 'react';
import { PageHead, PeriodPicker, Stat, Table, Td, periodQuery, useAdminData } from '@/components/admin/ui';
import { BarChart, Funnel } from '@/components/admin/Charts';

export default function StatsAdmin() {
  const [period, setPeriod] = useState({ period: '7d' });
  const ready = period.period !== 'custom' || (period.from && period.to);
  const { data: d, error } = useAdminData(ready ? `/api/admin/stats?${periodQuery(period)}` : null);
  const p = d?.service === 'pilgrim';
  const stamp = p ? '인장' : '도장';

  return (
    <>
      <PageHead title="통계" desc={`우리 기관 ${p ? '성지' : '관광지'}에서 찍힌 ${stamp} 기준 (한국 시간)`}>
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHead>
      {error && <p className="text-error">{error}</p>}
      {d && (
        <div className="space-y-6">
          <p className="muted">{d.period.from} ~ {d.period.to}</p>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="참여 키링" value={d.keyrings} />
            <Stat label={`${stamp} 수`} value={d.stamps} />
            <Stat label={p ? '순례 완료' : '완주'} value={d.completions} />
          </div>
          <section className="card pl-14">
            <p className="subtitle mb-4">날짜별 참여 키링 · {stamp} 수</p>
            <BarChart
              data={d.daily.map((x) => ({ ...x, label: x.date.slice(5).replace('-', '/') }))}
              x="label"
              bars={[{ key: 'keyrings', label: '참여 키링', color: 'var(--c-accent)' }, { key: 'stamps', label: `${stamp} 수`, color: 'var(--c-primary)' }]}
              labelEvery={Math.ceil(d.daily.length / 15)}
            />
          </section>
          <section className="card pl-14">
            <p className="subtitle mb-4">시간대별 태그 수</p>
            <BarChart data={d.hourly.map((h) => ({ ...h, label: `${h.hour}시` }))} x="label" bars={[{ key: 'count', label: '태그', color: 'var(--c-primary)' }]} labelEvery={3} height={160} />
          </section>
          <section>
            <p className="subtitle mb-3">지점별 방문 수</p>
            <Table head={[p ? '성지' : '관광지', '지점', '방문 수']}>
              {d.by_checkpoint.map((c) => (
                <tr key={c.id}><Td>{c.site_name}</Td><Td className="font-semibold">{c.name}</Td><Td className="tabular-nums">{c.count}</Td></tr>
              ))}
            </Table>
          </section>
          <section className="card">
            <p className="subtitle">단계별 이탈</p>
            <p className="mb-5 small muted">대상: 기간 안에 우리 기관 {p ? '성지' : '관광지'}에서 첫 {stamp}을 받은 키링</p>
            <Funnel
              steps={[
                { label: '첫 태그', value: d.funnel.first_tag },
                { label: '2개 지점 이상', value: d.funnel.two_points },
                { label: p ? '순례 완료' : '완주', value: d.funnel.completed },
                { label: p ? '사진 또는 메모 1개 이상' : '사진 1장 이상', value: d.funnel.photo },
                {
                  label: '방문 7일 후 폰 재태그',
                  value: d.funnel.retag,
                  base: d.funnel.retag_base,
                  note: `분모: 마지막 ${stamp} 후 7일이 지난 키링 ${d.funnel.retag_base}개 · 인정: 키링을 폰에 댐(nfc) ${d.funnel.retag_nfc} / 코드 직접 입력 ${d.funnel.retag_manual} (메뉴로 연 것은 제외)`,
                },
              ]}
            />
          </section>
        </div>
      )}
    </>
  );
}
