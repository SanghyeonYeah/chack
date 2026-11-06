'use client';
// 틀린 키링 코드 차단 목록 · 해제 (10회 5분 / 20회 10분 / 30회 30분 / 50회 이상 24시간)

import { Notice, PageHead, Table, Td, adminApi, fmtTime, useAdminData } from '@/components/admin/ui';
import { useState } from 'react';

export default function GuardSuper() {
  const { data, reload } = useAdminData('/api/super/guard');
  const [msg, setMsg] = useState(null);
  return (
    <>
      <PageHead title="코드 차단 해제" desc="틀린 코드 조회가 많은 접속(IP는 해시로만 저장)이에요. 50회 이상은 24시간 차단되며 여기서 풀 수 있어요.">
        <button className="btn btn-secondary btn-sm" onClick={reload}>새로고침</button>
      </PageHead>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <Table head={['접속(해시)', '틀린 횟수', '마지막 실패', '차단 해제 시각', '']} empty="차단된 접속이 없어요">
        {data?.rows.map((r) => (
          <tr key={r.ip_hash}>
            <Td className="font-mono small">{r.label}</Td>
            <Td className="tabular-nums">{r.fail_count}</Td>
            <Td>{fmtTime(r.last_fail_at)}</Td>
            <Td>{r.blocked_until && new Date(r.blocked_until) > new Date() ? fmtTime(r.blocked_until) : <span className="muted">차단 안 됨</span>}</Td>
            <Td className="text-right">
              <button className="btn btn-secondary btn-sm" onClick={async () => { await adminApi('/api/super/guard', { method: 'DELETE', body: { ip_hash: r.ip_hash } }); setMsg({ text: '해제했어요' }); reload(); }}>해제</button>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
