// 사용자 조회 함수 테스트 (0006)
import { beforeAll, describe, expect, it } from 'vitest';
import { freshDb, one } from './pg.js';

let db, t, readers;
const stamp = (k, at) => db.query(`select public.record_stamp_by_reader($1,$2,null,$3::timestamptz)`, [readers[k], t.code, at]);

beforeAll(async () => {
  db = await freshDb({ seed: true });
  readers = Object.fromEntries((await db.query(`select r.id, s.name||':'||c.sort_order k from readers r join checkpoints c on c.id=r.checkpoint_id join sites s on s.id=c.site_id`)).rows.map((r) => [r.k, r.id]));
  t = (await db.query(`select * from tokens where service='tour' order by code limit 1`)).rows[0];
  for (let i = 1; i <= 5; i++) await stamp(`현충사:${i}`, '2026-10-31T05:00:00Z');
  for (let i = 1; i <= 4; i++) await stamp(`외암민속마을:${i}`, '2026-11-01T05:00:00Z');
  await stamp('현충사:2', '2026-11-02T05:00:00Z');
}, 120_000);

describe('사용자 조회', () => {
  it('token_records: 관광지별 → 날짜별 묶음, 미확인 완주 순서', async () => {
    const r = (await one(db, 'select public.token_records($1) r', [t.id])).r;
    expect(r.sites[0].name).toBe('현충사'); // 최근 방문순
    expect(r.sites[0].dates.map((d) => d.date)).toEqual(['2026-10-31', '2026-11-02']);
    expect(r.sites[0].dates[0].visits.length).toBe(5);
    expect(r.unseen.length).toBe(2);
    expect(r.points).toBe(700);
  });

  it('completion_detail: 그 완주로 생긴 보너스만', async () => {
    const r = (await one(db, 'select public.token_records($1) r', [t.id])).r;
    const first = (await one(db, 'select public.completion_detail($1,$2) d', [t.id, r.unseen[0]])).d;
    const second = (await one(db, 'select public.completion_detail($1,$2) d', [t.id, r.unseen[1]])).d;
    expect(first.site_name).toBe('현충사');
    expect(first.bonuses).toEqual([]);
    expect(second.site_name).toBe('외암민속마을');
    expect(second.bonuses.map((b) => `${b.level}:${b.points}`)).toEqual(['sigungu:500']);
  });

  it('user_regions: 아산 100%, 충남 2/3', async () => {
    const r = (await one(db, `select public.user_regions('tour',$1) r`, [t.id])).r;
    const asan = r.find((x) => x.name === '아산시');
    const sido = r.find((x) => x.name === '충청남도');
    expect([asan.done, asan.total]).toEqual([2, 2]);
    expect([sido.done, sido.total]).toEqual([2, 3]);
  });

  it('nearby_sites: 완주한 곳 제외, 거리 포함', async () => {
    const hc = await one(db, `select id from sites where name='현충사'`);
    const r = (await one(db, 'select public.nearby_sites($1,$2) r', [hc.id, t.id])).r;
    expect(r.map((x) => x.name)).toEqual(['천안 임시 관광지']);
    expect(Number(r[0].km)).toBeGreaterThan(0);
  });

  it('user_site: 신부님 표시 꺼짐이면 빈 목록, 지점 0개 관광지는 null', async () => {
    const pg = await one(db, `select id from sites where service='pilgrim'`);
    const d = (await one(db, 'select public.user_site($1,null) d', [pg.id])).d;
    expect(d.priests).toEqual([]);
    expect(d.checkpoints.length).toBe(3);
    await db.query(`update checkpoints set is_public=false where site_id=$1`, [pg.id]);
    expect((await one(db, 'select public.user_site($1,null) d', [pg.id])).d).toBeNull();
  });

  it('신부님: 동의 없이 표시 불가 (DB CHECK)', async () => {
    await expect(db.query(`update priests set is_visible=true`)).rejects.toThrow();
  });
});
