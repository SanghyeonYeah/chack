// record_stamp 통합 테스트 (기획서 11.1 + 결정 B1~B5, C3)
import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb, one } from './pg.js';

let db;
let readers; // { '현충사:1': reader_id, ... }

async function setup() {
  db = await freshDb({ seed: true });
  const rows = (
    await db.query(`select r.id, s.name as site, c.sort_order as n
      from readers r join checkpoints c on c.id = r.checkpoint_id join sites s on s.id = c.site_id`)
  ).rows;
  readers = Object.fromEntries(rows.map((r) => [`${r.site}:${r.n}`, r.id]));
}

async function token(service = 'tour', idx = 0) {
  return (await db.query(`select * from tokens where service = $1 order by code limit 1 offset $2`, [service, idx])).rows[0];
}

async function stamp(key, code, at = '2026-10-06T03:00:00Z') {
  const r = await one(db, `select public.record_stamp_by_reader($1, $2, null, $3::timestamptz) as r`, [readers[key], code, at]);
  return r.r;
}

async function points(tokenId) {
  return Number((await one(db, `select coalesce(sum(points),0) as p from point_ledger where token_id = $1`, [tokenId])).p);
}

async function completeSite(site, n, code, at) {
  let last;
  for (let i = 1; i <= n; i++) last = await stamp(`${site}:${i}`, code, at);
  return last;
}

describe('record_stamp', () => {
  beforeEach(setup, 60_000);

  it('첫 도장: STAMPED, stock → issued, 진행 1/5', async () => {
    const t = await token();
    const r = await stamp('현충사:1', t.code);
    expect(r.result).toBe('STAMPED');
    expect(r.done).toBe(1);
    expect(r.total).toBe(5);
    const after = await one(db, 'select status, first_used_at from tokens where id = $1', [t.id]);
    expect(after.status).toBe('issued');
    expect(after.first_used_at).not.toBeNull();
  });

  it('같은 날 재태그 → ALREADY_TODAY, 기록 추가 없음', async () => {
    const t = await token();
    await stamp('현충사:1', t.code, '2026-10-06T01:00:00Z');
    const r = await stamp('현충사:1', t.code, '2026-10-06T09:00:00Z');
    expect(r.result).toBe('ALREADY_TODAY');
    expect(Number((await one(db, 'select count(*) c from visits where token_id=$1', [t.id])).c)).toBe(1);
  });

  it('한국 날짜 경계: UTC 14:59와 15:00은 다른 날', async () => {
    const t = await token();
    const a = await stamp('현충사:1', t.code, '2026-10-06T14:59:00Z');
    const b = await stamp('현충사:1', t.code, '2026-10-06T15:00:00Z');
    expect(a.visit_date).toBe('2026-10-06');
    expect(b.result).toBe('REVISIT');
    expect(b.visit_date).toBe('2026-10-07');
  });

  it('5지점 완주 → COMPLETED +100P, 다른 날 재방문은 REVISIT·포인트 재지급 없음', async () => {
    const t = await token();
    const r = await completeSite('현충사', 5, t.code);
    expect(r.result).toBe('COMPLETED');
    expect(r.points).toBe(100);
    expect(await points(t.id)).toBe(100);
    const again = await stamp('현충사:2', t.code, '2026-10-10T03:00:00Z');
    expect(again.result).toBe('REVISIT');
    expect(again.completed).toBe(true);
    expect(await points(t.id)).toBe(100);
    expect(Number((await one(db, 'select count(*) c from completions where token_id=$1', [t.id])).c)).toBe(1);
  });

  it('관광지별 base_points 사용, 비면 전체 기본값 (B1)', async () => {
    await db.query(`update sites set base_points = 300 where name = '현충사'`);
    const t = await token();
    const r = await completeSite('현충사', 5, t.code);
    expect(r.points).toBe(300);
  });

  it('아산 전부 완주 → 시·군 보너스 500P + 뱃지 1회, 보너스는 전체 기본값 기준 (B1)', async () => {
    await db.query(`update sites set base_points = 300 where name = '현충사'`);
    const t = await token();
    await completeSite('현충사', 5, t.code);
    const r = await completeSite('외암민속마을', 4, t.code);
    expect(r.result).toBe('COMPLETED');
    expect(r.bonuses).toEqual([{ kind: 'sigungu', region_name: '아산시', points: 500 }]);
    expect(await points(t.id)).toBe(300 + 100 + 500);
  });

  it('충남 전부 완주 → 도 보너스 1000P + 천안 시·군 보너스', async () => {
    const t = await token();
    await completeSite('현충사', 5, t.code);
    await completeSite('외암민속마을', 4, t.code);
    const r = await completeSite('천안 임시 관광지', 3, t.code);
    const kinds = r.bonuses.map((b) => `${b.kind}:${b.points}`).sort();
    expect(kinds).toEqual(['sido:1000', 'sigungu:500']);
    expect(await points(t.id)).toBe(300 + 1000 + 1000);
    expect(Number((await one(db, 'select count(*) c from token_badges where token_id=$1', [t.id])).c)).toBe(3);
  });

  it('새 관광지가 추가돼 100% 밑으로 떨어져도 보너스·뱃지 유지, 다시 100%여도 재지급 없음 (B2)', async () => {
    const t = await token();
    await completeSite('현충사', 5, t.code);
    await completeSite('외암민속마을', 4, t.code);
    const asan = await one(db, `select region_id, organization_id from sites where name='현충사'`);
    const s = await one(db, `insert into sites (service, organization_id, region_id, name, is_public) values ('tour',$1,$2,'새 관광지',true) returning id`, [asan.organization_id, asan.region_id]);
    const cp = await one(db, `insert into checkpoints (site_id, name, is_public) values ($1,'새 지점',true) returning id`, [s.id]);
    const rd = await one(db, `insert into readers (organization_id, checkpoint_id, name) values ($1,$2,'x') returning id`, [asan.organization_id, cp.id]);
    readers['새:1'] = rd.id;
    const r = await stamp('새:1', t.code);
    expect(r.result).toBe('COMPLETED');
    expect(r.bonuses).toEqual([]);
    expect(await points(t.id)).toBe(100 + 100 + 500 + 100);
  });

  it('공개 지점 0개인 관광지는 분모에서 제외 (B2)', async () => {
    const asan = await one(db, `select region_id, organization_id from sites where name='현충사'`);
    await db.query(`insert into sites (service, organization_id, region_id, name, is_public) values ('tour',$1,$2,'지점 없는 곳',true)`, [asan.organization_id, asan.region_id]);
    const t = await token();
    await completeSite('현충사', 5, t.code);
    const r = await completeSite('외암민속마을', 4, t.code);
    expect(r.bonuses.map((b) => b.kind)).toEqual(['sigungu']);
  });

  it('비공개 지점은 완주 판정에서 제외, 지점 추가 후 기존 완주 유지', async () => {
    await db.query(`update checkpoints set is_public=false where name='활터'`);
    const t = await token();
    const r = await completeSite('현충사', 4, t.code);
    expect(r.result).toBe('COMPLETED');
    expect(r.total).toBe(4);
    await db.query(`update checkpoints set is_public=true where name='활터'`);
    expect(Number((await one(db, 'select count(*) c from completions where token_id=$1', [t.id])).c)).toBe(1);
    const t2 = await token('tour', 1);
    const r2 = await completeSite('현충사', 4, t2.code);
    expect(r2.result).toBe('STAMPED');
    expect(r2.done).toBe(4);
    expect(r2.total).toBe(5);
  });

  it('lost 키링 거절, 다른 웹 키링 거절, 없는 키링', async () => {
    const t = await token();
    await db.query(`update tokens set status='lost' where id=$1`, [t.id]);
    expect((await stamp('현충사:1', t.code)).result).toBe('LOST_TOKEN');
    const p = await token('pilgrim');
    expect((await stamp('현충사:1', p.code)).result).toBe('WRONG_SERVICE');
    expect((await stamp('현충사:1', 'ZZZZZZZZ')).result).toBe('UNKNOWN_TOKEN');
  });

  it('다른 기관 관광지에서도 도장 가능 (B4)', async () => {
    const t = await token(); // 현충사 기관 키링일 수도, 외암 기관 키링일 수도
    const r = await stamp('천안 임시 관광지:1', t.code);
    expect(r.result).toBe('STAMPED');
  });

  it('순례: 포인트 스위치 꺼짐 → 포인트 없음, 뱃지 있음', async () => {
    const p = await token('pilgrim');
    const r = await completeSite('아산 임시 성지', 3, p.code);
    expect(r.result).toBe('COMPLETED');
    expect(r.points).toBeNull();
    expect(r.bonuses.every((b) => b.points === null)).toBe(true);
    expect(r.bonuses.length).toBe(2);
    expect(await points(p.id)).toBe(0);
    expect(Number((await one(db, 'select count(*) c from token_badges where token_id=$1', [p.id])).c)).toBe(2);
  });

  it('5분 넘게 미래인 태그 시각은 서버 시각으로 대체 (C3)', async () => {
    const t = await token();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await stamp('현충사:1', t.code, future);
    const v = await one(db, 'select tagged_at from visits where token_id=$1', [t.id]);
    expect(new Date(v.tagged_at).getTime()).toBeLessThan(Date.now() + 5 * 60 * 1000);
  });

  it('리더 토큰 래퍼: 잘못된 토큰 → READER_INVALID', async () => {
    const r = await one(db, `select public.record_stamp('nope', 'AAAAAAAA', null, now()) as r`);
    expect(r.r.result).toBe('READER_INVALID');
  });
});

describe('transfer_token (B5)', () => {
  beforeEach(setup, 60_000);

  it('기록을 새 키링으로 옮기고 token_views는 남김', async () => {
    const old = await token('tour', 0);
    await completeSite('현충사', 5, old.code);
    await db.query(`insert into token_views (token_id, via) values ($1, 'nfc')`, [old.id]);
    const fresh = (await db.query(`select * from tokens where service='tour' and status='stock' and id <> $1 order by code limit 1`, [old.id])).rows[0];
    const r = await one(db, `select public.transfer_token($1,$2,null) as r`, [old.code, fresh.code]);
    expect(r.r.ok).toBe(true);
    expect(Number((await one(db, 'select count(*) c from visits where token_id=$1', [fresh.id])).c)).toBe(5);
    expect(await points(fresh.id)).toBe(100);
    expect(Number((await one(db, 'select count(*) c from token_views where token_id=$1', [old.id])).c)).toBe(1);
    const o = await one(db, 'select status, replaced_by_token_id from tokens where id=$1', [old.id]);
    expect(o.status).toBe('lost');
    expect(o.replaced_by_token_id).toBe(fresh.id);
    expect((await one(db, 'select status from tokens where id=$1', [fresh.id])).status).toBe('issued');
    expect((await stamp('현충사:1', old.code)).result).toBe('LOST_TOKEN');
  });

  it('기록 있는 키링으로는 이전 불가', async () => {
    const a = await token('tour', 0);
    const b = await token('tour', 1);
    await stamp('현충사:1', a.code);
    await stamp('현충사:1', b.code);
    const r = await one(db, `select public.transfer_token($1,$2,null) as r`, [a.code, b.code]);
    expect(r.r.error).toBe('NEW_HAS_RECORDS');
  });
});

describe('code_lookup_failed (C2)', () => {
  beforeEach(setup, 60_000);

  it('10회 5분, 20회 10분, 50회 이상 24시간', async () => {
    const fail = async () => (await one(db, `select public.code_lookup_failed('ip1') as u`)).u;
    let u;
    for (let i = 0; i < 9; i++) u = await fail();
    expect(u).toBeNull();
    u = await fail();
    const m = (new Date(u) - Date.now()) / 60000;
    expect(m).toBeGreaterThan(4);
    expect(m).toBeLessThan(6);
    for (let i = 0; i < 40; i++) u = await fail();
    expect((new Date(u) - Date.now()) / 3600000).toBeGreaterThan(23);
  });
});

describe('admin_stats', () => {
  beforeEach(setup, 60_000);

  it('우리 기관 관광지 도장만 센다 (B4)', async () => {
    const t = await token();
    await stamp('현충사:1', t.code, '2026-10-06T03:00:00Z');
    await stamp('천안 임시 관광지:1', t.code, '2026-10-06T03:00:00Z');
    const org = await one(db, `select organization_id from sites where name='현충사'`);
    const s = (await one(db, `select public.admin_stats('tour',$1,'2026-10-01','2026-10-31') as s`, [org.organization_id])).s;
    expect(s.stamps).toBe(1);
    expect(s.funnel.first_tag).toBe(1);
    const all = (await one(db, `select public.admin_stats('tour',null,'2026-10-01','2026-10-31') as s`)).s;
    expect(all.stamps).toBe(2);
  });

  it('재태그: 마지막 도장 7일 후 nfc/manual만 인정 (B6)', async () => {
    const t = await token();
    await stamp('현충사:1', t.code, '2026-10-01T03:00:00Z');
    await stamp('현충사:2', t.code, '2026-10-05T03:00:00Z');
    await db.query(`insert into token_views (token_id, via, opened_at) values ($1,'nfc','2026-10-10T00:00:00Z'), ($1,'menu','2026-10-20T00:00:00Z')`, [t.id]);
    let s = (await one(db, `select public.admin_stats('tour',null,'2026-10-01','2026-10-31') as s`)).s;
    expect(s.funnel.retag_base).toBe(1);
    expect(s.funnel.retag).toBe(0);
    await db.query(`insert into token_views (token_id, via, opened_at) values ($1,'manual','2026-10-13T00:00:00Z')`, [t.id]);
    s = (await one(db, `select public.admin_stats('tour',null,'2026-10-01','2026-10-31') as s`)).s;
    expect(s.funnel.retag).toBe(1);
    expect(s.funnel.retag_manual).toBe(1);
    expect(s.funnel.retag_nfc).toBe(0);
  });
});
