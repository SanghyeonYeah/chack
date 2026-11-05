-- 확인용 쿼리: SQL Editor에서 하나씩 선택해 실행하세요 (결과는 마지막 쿼리만 표시됨)

-- ① 리더 등록 코드 (24시간 유효)
select s.name as 관광지, c.sort_order as 순서, c.name as 지점, r.reg_code as 등록코드, r.reg_code_expires_at as 만료
  from public.readers r
  join public.checkpoints c on c.id = r.checkpoint_id
  join public.sites s on s.id = c.site_id
 where r.reg_code is not null
 order by s.name, c.sort_order;

-- ② 시험용 키링 코드
select service, code, status from public.tokens order by service, created_at;

-- ③ 24시간이 지나 등록 코드를 다시 발급할 때
select r.name, public.issue_reader_code(r.id) as 새코드 from public.readers r where r.name like '현충사%';

-- ④ (선택) 현충사 리더 설정 PIN을 1234로 지정
update public.readers set pin_hash = public.sha256_hex(id::text || ':' || '1234') where name like '현충사%';

-- ⑤ 최근 도장 20건
select v.tagged_at, v.visit_date, t.code, s.name as 관광지, c.name as 지점
  from public.visits v
  join public.tokens t on t.id = v.token_id
  join public.checkpoints c on c.id = v.checkpoint_id
  join public.sites s on s.id = v.site_id
 order by v.received_at desc limit 20;

-- ⑥ 완주 · 포인트 · 뱃지
select t.code, p.kind, p.points, p.created_at from public.point_ledger p join public.tokens t on t.id = p.token_id order by p.created_at desc;
select t.code, r.name as 지역, b.earned_at from public.token_badges b join public.tokens t on t.id = b.token_id join public.regions r on r.id = b.region_id;
