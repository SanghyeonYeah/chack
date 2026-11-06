# 착(CHAK) 웹 서비스 — Claude Code 작업 지침

이 파일은 저장소 루트에 둡니다. Claude Code는 매 작업 전에 이 파일을 따릅니다.

---

## 0. 기준 문서와 우선순위

- **기준 문서:** `docs/CHAK_기획서_v1.0.pdf` (이하 "기획서"). 모든 화면·규칙은 기획서의 화면 ID(T-U-07, R-01, P-A-05 …)로 부릅니다.
- 기획서와 이 파일이 충돌하면 **기획서가 우선**입니다. 이 파일의 "기술 결정"은 기획서가 개발자 판단에 맡긴 부분을 정해 둔 것입니다.
- 기획서에 없는 동작은 **가장 단순하게** 만들고 `docs/DECISIONS.md`에 한 줄로 기록합니다.
- `[확인 필요]` 항목은 기획서에 적힌 기본값으로 진행하고, `docs/DECISIONS.md`의 "확인 필요 기본값" 섹션에 무엇으로 했는지 적습니다.
- 진짜로 막혀서 진행이 불가능할 때만 질문합니다. 그 외에는 기본값으로 진행하고 기록합니다.

---

## 1. 기술 결정 (확정)

| 항목 | 결정 |
|---|---|
| 프레임워크 | Next.js 최신 안정 버전, App Router, TypeScript strict |
| 스타일 | Tailwind CSS + 서비스별 CSS 변수 테마 |
| DB·인증·저장소 | Supabase (PostgreSQL, Auth는 **관리자 전용**, Storage) |
| 앱 구성 | **저장소 1개, Next.js 앱 1개.** 서비스는 환경변수 `NEXT_PUBLIC_SERVICE=tour\|pilgrim`으로 구분하고, Vercel에 같은 저장소를 프로젝트 2개(tour / pilgrim)로 배포 |
| DB | **하나를 같이 씀.** 서비스별 데이터는 `service` 칸(`tour` / `pilgrim`)으로 구분 (기획서 17장 #15 → DECISIONS.md에 기록) |
| 데이터 접근 | 모든 DB 접근은 서버(Route Handler / Server Component)에서 service role 키로. 클라이언트에서 Supabase 직접 조회 금지. 모든 테이블 RLS 켜고 anon 정책 없음 |
| 지도 | 카카오맵 JavaScript SDK. 길찾기는 `https://map.kakao.com/link/to/{이름},{lat},{lng}` 링크 |
| 사진 저장 | Supabase Storage 비공개 버킷 `photos`. 조회는 서버에서 서명 URL 발급 |
| 이미지 처리 | 브라우저에서 긴 변 1600px 축소(canvas 또는 `browser-image-compression`), HEIC는 `heic2any`로 JPG 변환 |
| 리더 오프라인 큐 | IndexedDB (`idb-keyval`) |
| 애니메이션 | CSS 또는 `framer-motion` |
| 테스트 | Vitest. 도장 함수는 로컬 Supabase(`supabase start`)에 대한 통합 테스트 |
| 배포 | Vercel, HTTPS 필수 |

### 환경변수 (`.env.example`에 모두 적어 둘 것)

```
NEXT_PUBLIC_SERVICE=tour                 # tour | pilgrim
NEXT_PUBLIC_SITE_URL=https://...         # 이 서비스의 주소 (키링 주소 생성에 사용)
NEXT_PUBLIC_OTHER_SERVICE_URL=https://...# 다른 서비스 주소 (다른 웹 키링 자동 이동용)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=               # 서버 전용. 절대 클라이언트 번들에 들어가면 안 됨
NEXT_PUBLIC_KAKAO_MAP_KEY=
ENABLE_DEV_TOOLS=false                   # true일 때만 /dev/* 개발 도구 노출
```

---

## 2. 폴더·경로 구조

```
app/
  page.tsx                         T-U-02 (+첫 방문 T-U-01) / P-U-01
  regions/page.tsx                 T-U-03 / P-U-02
  sites/page.tsx                   T-U-04 / P-U-03   (?region=)
  sites/[id]/page.tsx              T-U-05 / P-U-04
  sites/[id]/cp/[cpId]/page.tsx    T-U-06 / P-U-05
  k/[code]/page.tsx                키링 진입: 확인 → localStorage 저장 → /me?via=nfc
  me/page.tsx                      T-U-07 / P-U-06  (코드 직접 입력 포함)
  me/visits/[visitId]/page.tsx     T-U-09 / P-U-08
  me/visits/[visitId]/upload/page.tsx  T-U-08 / P-U-07
  me/complete/[completionId]/page.tsx  T-U-10 / P-U-09 완료 연출
  me/nearby/page.tsx               T-U-11 (?site=)
  me/profile/page.tsx              T-U-12 / P-U-09 기록
  privacy/page.tsx                 개인정보 안내
  reader/page.tsx                  R-01, R-02
  reader/setup/page.tsx            R-03
  admin/...                        T-A-01~09 / P-A-01~10 (서비스에 따라 메뉴 분기)
  super/...                        S-01~05
  dev/reader-sim/page.tsx          개발용 가상 리더 (ENABLE_DEV_TOOLS일 때만)
  api/...                          기획서 12장 API
lib/
  service.ts      현재 서비스, 테마, 기능 스위치 조회
  terms.ts        서비스별 용어 사전 (도장↔순례 인장, 완주↔순례 완료 등)
  tokenCode.ts    키링 코드 생성·정규화·검증
  db.ts           서버 전용 Supabase 클라이언트
  auth.ts         requireAdmin(), 기관 권한 확인
supabase/
  migrations/     테이블·제약·함수·RLS
  seed.sql        시연 데이터
docs/
  CHAK_기획서_v1.0.pdf
  DECISIONS.md    결정·기본값 기록
  PROGRESS.md     단계별 "된 것 / 안 된 것" + 테스트 체크리스트 상태
```

- 모든 화면 파일 맨 위에 화면 ID 주석: `// T-U-07 내 여행 기록 / P-U-06 순례 수첩`
- tour와 pilgrim 화면은 **같은 페이지 파일**에서 `lib/service.ts`로 분기합니다. 화면을 통째로 복제하지 않습니다. 차이가 큰 부분(P-U-01 성경 구절, 신부님 영역, 메모)만 별도 컴포넌트로 둡니다.

---

## 3. 절대 규칙 — 어기면 안 됨

### 도장·완주·포인트
1. **도장 기록은 Postgres 함수 `record_stamp()` 하나에서 한 트랜잭션으로** 처리합니다(기획서 11.1의 1~7단계 그대로). `/api/reader/stamp`는 입력 검증 후 이 함수만 호출합니다.
2. `visit_date = (tagged_at AT TIME ZONE 'Asia/Seoul')::date`. 기준은 **리더가 보낸 실제 태그 시각**입니다(오프라인 재전송 대비). 미래로 5분 넘게 앞선 시각은 서버 현재 시각으로 대체합니다.
3. 중복 방지는 **DB UNIQUE 제약**으로 보장합니다. 앱 코드의 사전 확인에만 의존하지 않습니다.
   - `visits (token_id, checkpoint_id, visit_date)`
   - `completions (token_id, site_id)`
   - `point_ledger (token_id, reason, ref_id)`
   - `token_badges (token_id, region_level, region_key)`
4. 완주 = 그 관광지의 **공개(is_public) 지점**을 날짜와 무관하게 모두 1회 이상 방문. 이미 생긴 완주는 지점이 추가돼도 취소하지 않습니다.
5. 지역 완주·완료율의 분모는 "공개 관광지 중 **공개 지점이 1개 이상인** 관광지"입니다(사용자 화면에 보이는 것과 일치).
6. 포인트: 관광지 완주 = 그 관광지의 `base_points`(기본 100). 시·군 보너스 = `settings.base_points × sigungu_multiplier`(기본 500), 도 보너스 = `settings.base_points × sido_multiplier`(기본 1,000). 각 1회. → DECISIONS.md에 기록.
7. 잔액은 저장하지 않고 `point_ledger` 합계로 계산합니다.
8. 순례(pilgrim): `pilgrim_points_enabled`가 꺼져 있으면 포인트 지급 없음, **화면 어디에도 포인트 문구·숫자 없음**. 뱃지는 지급합니다.

### 키링
9. 키링 코드: 8자리, 문자 집합 `23456789ABCDEFGHJKMNPQRSTUVWXYZ`(0·O·1·I·L 제외), `crypto` 난수, UNIQUE. 입력은 공백 제거·대문자 변환 후 비교.
10. 칩 UID는 대문자·콜론 제거로 정규화해 저장·비교합니다.
11. `lost` 키링은 도장 불가. `stock` 키링이 처음 태그되면 `issued` + `first_used_at`.
12. 틀린 키링 코드 조회가 같은 IP에서 1분 20회 초과 시 잠시 차단. 서버리스라 메모리 대신 DB 테이블(`rate_limit_hits`)로 셉니다.

### 개인정보·권한
13. **순례 메모(`notes`)와 순례 사진은 관리자·최고 관리자 화면과 API 어디에서도 조회할 수 없습니다.** 관리자용 쿼리에서 `notes` 본문·사진 경로를 SELECT하지 않습니다. 통계는 개수만.
14. 사진·메모 추가/수정/삭제 API는 요청의 `token_code`와 해당 visit의 키링이 일치하는지 서버에서 확인합니다.
15. 기관 관리자(`org_admin`)는 **자기 기관 + 자기 서비스** 데이터만. 모든 `/api/admin/*`는 `requireAdmin()`으로 확인합니다.
16. 사용자 개인정보(이름·전화·이메일)는 받지 않습니다. 사용자 위치는 서버로 보내지 않고 거리 계산은 브라우저에서 합니다.
17. `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드에서만 import합니다(`import 'server-only'`).

### 콘텐츠
18. **성경 구절 본문을 코드나 seed에 넣지 않습니다.** seed에는 `[예시 구절 1 — 관리자에서 입력]`, 출처 `[예시]` 같은 자리표시만 넣습니다(저작권 허락 전).
19. 순례 웹 문구는 천주교 용어: "하느님", "성지", "순례", "신부님", "순례 인장", "순례 수첩", "순례 완료". `lib/terms.ts`를 통해서만 문구를 넣어 tour 용어가 섞이지 않게 합니다.
20. 로고·도장·뱃지·일러스트 이미지는 아직 없습니다. 자리만 만들고 단순한 기본 이미지(SVG 원형 도장 + 이름 텍스트 등)를 씁니다.

### 로그
21. 도장 요청·결과·오류는 `stamp_logs` 테이블에 남깁니다(reader_id, 입력 코드/UID, 결과 코드, 오류 메시지, 시각). 사용자 화면에는 기획서 13장의 문구만 보여주고 오류 상세는 콘솔·로그에만 둡니다.

---

## 4. 데이터 구조 메모

기획서 11장의 테이블을 그대로 만들되 아래를 추가·확정합니다.

- `admins.user_id` → `auth.users.id` 참조. role: `super` / `org_admin`.
- `settings`: key-value. 초기값 `base_points=100, sigungu_multiplier=5, sido_multiplier=10, pilgrim_points_enabled=false, point_exchange_enabled=false`.
- `rate_limit_hits`: ip, window_start, count.
- `stamp_logs`: 위 21번.
- `priests`: `consent_checked=false`면 `is_visible=true` 불가 → **CHECK 제약**으로 보장.
- `photos`: visit당 최대 3장 → 업로드 API + DB 트리거 둘 다로 보장.
- `notes.body` 최대 500자 → CHECK 제약.
- `readers.reader_token`, `readers.settings_pin`은 해시 저장(SHA-256 + 서버 비밀값 또는 bcrypt). 등록 코드 6자리, 24시간 유효.
- 키링 분실·이전(T-A-06): **새 키링이 아직 기록이 없는 경우에만** 허용(충돌 처리 단순화). 한 트랜잭션으로 visits·photos·notes·completions·point_ledger·token_badges·token_views의 token_id를 새 키링으로 바꾸고, 옛 키링은 `lost` + `replaced_by_token_id`. → DECISIONS.md에 기록.

---

## 5. 현장 리더(R-01~03) 구현 요점

- `NDEFReader`가 없으면: "안드로이드 크롬에서 HTTPS 주소로 열어 주세요" 안내.
- [리더 시작] 버튼 클릭에서 `scan()` 시작(사용자 제스처 필요). Screen Wake Lock 획득, `visibilitychange` 때 재획득.
- `reading` 이벤트: 레코드 중 `recordType === "url"`(또는 absolute-url)을 `TextDecoder`로 읽어 `/\/k\/([A-Z0-9]{8})/i`로 코드 추출. 실패하면 `serialNumber`(UID) 사용.
- 같은 키 10초 내 재감지 → 서버 요청 없이 무시, 화면 변화 없음.
- 전송: `POST /api/reader/stamp` (reader_token, token_code 또는 chip_uid, tagged_at ISO, client_event_id UUID).
- 실패(네트워크) 시 IndexedDB 큐에 저장(최대 500, 넘으면 가장 오래된 것 유지·새것 거절 대신 **오래된 것부터 보존**하고 경고 표시). `online` 이벤트와 15초 간격으로 순서대로 재전송, 성공 응답을 받은 항목만 삭제.
- 결과 화면 R-02: 2초 표시 후 R-01 복귀(완주는 3초). 결과별 색·문구는 기획서 R-02 표 그대로. 소리는 Web Audio API로 짧은 비프 생성(파일 불필요), `navigator.vibrate` 지원 시 진동. 소리 켜기/끄기는 R-03 설정.
- 1분마다 `POST /api/reader/heartbeat` (pending_count 포함).
- 오른쪽 위 모서리 5회 연속 탭(3초 안) → PIN 4자리 → R-03 메뉴(소속 확인, 재등록, 대기 전송 강제 보내기, 소리 켜기/끄기).
- reader_token 원문은 기기 localStorage에만, 서버에는 해시만.
- 리더 화면은 큰 글씨, 세로·가로 모두 대응.

### 개발용 가상 리더 (`/dev/reader-sim`)
- `ENABLE_DEV_TOOLS=true`일 때만 접근 가능. 프로덕션 기본 꺼짐.
- 리더(지점)를 고르고 키링 코드를 입력하면 실제 리더와 **같은 API**로 태그를 보냅니다. 태그 시각을 직접 지정하는 옵션(오프라인·날짜 경계 테스트용) 포함.
- NFC 기기 없이 완주·보너스·중복 규칙을 시험하는 용도입니다.

---

## 6. 사용자 화면 구현 요점

- 모바일 세로 우선 360~430px. PC에서는 가운데 430px 폭. 기본 글자 16px 이상, 버튼 높이 48px 이상.
- 하단 공통 메뉴(T-U-01 제외): 홈 · 관광지 · 내 기록 · 내 정보. 키링이 연결되지 않은 폰에서 "내 기록·내 정보"를 누르면 "키링을 폰 뒷면에 대 주세요" + 코드 직접 입력 칸.
- localStorage 키: `chak.{service}.tokenCode`, `chak.{service}.onboardingSeen`, `chak.{service}.region`. 모든 접근은 try/catch.
- `/k/[code]` 흐름: 서버에서 키링 확인 + `token_views`(via=nfc) 기록 → 결과별 처리
  - 정상: localStorage 저장 → 미확인 완주가 있으면 완주 화면 먼저 → 아니면 `/me?via=nfc`
  - 다른 서비스 키링: `NEXT_PUBLIC_OTHER_SERVICE_URL/k/{code}`로 자동 이동
  - 미등록 / lost: 기획서 13장 문구
  - 코드 직접 입력은 via=manual, 하단 메뉴는 via=menu로 기록
- "따라락" 효과: **via=nfc로 들어왔을 때만**, 오늘(한국 날짜) 받은 도장 항목을 0.25초 간격으로 위에서부터 등장.
- T-U-10: 빈 도장 자리 → 0.6초 뒤 도장이 커졌다 작아지며 찍힘 + 진동 → 완주 문구·날짜 → 포인트 카운트업 → 지역 보너스·뱃지 카드(있을 때) → [가볼게요] / [괜찮아요, 나중에 갈게요]. 한 번 보면 `seen_by_user=true`. P-U-09는 더 느리고 차분하게, 포인트 없음.
- T-U-11 / 다음 성지: 방금 완주한 곳 기준 미완주 공개 관광지 최대 5곳, 같은 시·군 우선 → 같은 도. 직선거리(하버사인) km 소수점 1자리.
- 검색(T-U-04): 이름 + 별칭, 2글자부터, 입력마다 필터. 순례(P-U-03)는 검색창 없음.
- 위치 권한 거부 시 거리·내 위치·가까운 순 정렬 버튼만 숨기고 나머지는 정상.
- 지도 실패 시 "지도를 불러오지 못했어요 [다시 시도]" + 주소 텍스트.
- 30일 이상 지난 기록: tour "○○일 전, 이곳에 다녀왔어요" / pilgrim "○○일 전, 이곳을 순례했어요".
- P-U-01: 노출 구절을 순서대로 30초마다 0.8초 페이드 교체, 왼쪽으로 밀면 즉시 다음. 첫 방문은 안내 3줄 + [알겠어요].
- P-U-04 신부님 영역: `is_visible=true`인 분만, 0명이면 영역 자체 숨김.
- 순례 화면 하단: "착 순례 기록은 개인 기록용이며 교회의 공식 인증이 아닙니다" (작게).

### 디자인 톤
- tour: 한지·베이지 바탕, 따뜻한 갈색 포인트(빨간색 지양), 제목 명조(Noto Serif KR) + 본문 고딕(Pretendard 또는 Noto Sans KR).
- pilgrim: 아이보리 바탕, 차분한 남색·회색 포인트, 여백 많게. 광고·판매 요소 없음.
- 두 테마는 CSS 변수로 정의하고 `NEXT_PUBLIC_SERVICE`에 따라 적용.

---

## 7. 관리자·최고 관리자 구현 요점

- 로그인: Supabase Auth 이메일+비밀번호, 비밀번호 재설정 메일. 계정은 최고 관리자(S-01)가 생성.
- PC 기준 최소 폭 1280px. 표·폼 위주로 단순하게.
- 좌표 입력은 카카오맵에서 클릭해 찍기. 지점 순서는 끌어서 변경.
- 관광지 삭제는 기록이 없을 때만, 있으면 비공개 처리 안내.
- 통계(T-A-07 / P-A-09) 단계별 이탈 정의 — DECISIONS.md에 기록:
  - 대상: 기간 안에 **첫 도장**을 받은 키링
  - ① 첫 태그 → ② 서로 다른 지점 2곳 이상 → ③ 완주 1곳 이상 → ④ 사진 1장 이상(순례는 사진 또는 메모 1개 이상, **개수만** 셈) → ⑤ 첫 방문 7일 이후 `token_views` 1건 이상
- CSV(T-A-08): UTF-8 BOM 포함(엑셀 한글 깨짐 방지), 키링 코드는 `****2PQA`처럼 앞 4자리 가림, 사진·메모 제외.
- S-03 키링 발급: 서비스·수량·기관 선택 → 코드 일괄 생성 → CSV(코드, `{SITE_URL}/k/{코드}`). UID 일괄 등록 CSV 업로드(선택).
- S-05: settings 값·기능 스위치 수정.
- 최고 관리자도 순례 사진·메모 열람 불가(규칙 13).

---

## 8. 시연 seed 데이터 (`supabase/seed.sql`)

모든 값은 **임시**이며 이름 앞이나 설명에 `[임시]`를 붙입니다. 기획 쪽에서 실제 자료가 오면 관리자 화면에서 교체합니다.

- 지역: 충청남도 > 아산시, 천안시 (활성). 다른 몇 곳은 비활성("준비 중" 표시 확인용).
- 관광지(tour): 현충사(지점 5: 홍살문, 본전, 유물전시관, 고택, 활터), 외암민속마을(지점 4), 천안 임시 관광지 1곳(지점 3). 좌표는 대략 위치의 임시값.
- 성지(pilgrim): 임시 성지 1곳(지점 3), 임시 신부님 1명(동의 체크 없음, 표시 끔).
- 성경 구절: 자리표시 3개(규칙 18).
- 기관: tour 기관 2개(권한 분리 테스트용), pilgrim 기관 1개. 최고 관리자 계정 1개 + 기관 관리자 계정 각 1개(비밀번호는 seed 실행 시 출력, 문서에 적지 않음).
- 키링: 서비스별 20개(stock).
- 리더: 현충사 지점별 5개 + 성지 지점별 3개, 등록 코드 발급 상태.

---

## 9. 작업 방식

- 단계(Phase)별로 진행합니다. 각 단계가 끝나면:
  1. `npm run lint`, `npm run typecheck`, `npm test` 통과
  2. `docs/PROGRESS.md` 갱신: **이번에 된 것 / 아직 안 된 것 / 테스트 체크리스트(기획서 16장) 번호별 상태 / 기획 쪽에 확인할 것**
  3. 커밋. 메시지에 화면 ID 포함 (예: `feat(R-01,R-02): 리더 태그·결과 화면`)
- 기획서 16장 테스트 체크리스트 23개가 v1 완료 기준입니다. 실제 기기가 필요한 항목(5, 6 등)은 "기기 테스트 필요"로 표시하고, 나머지는 가상 리더·자동 테스트로 확인합니다.
- 피드백은 기획서 15.3 형식(`[화면 ID] [종류] [상황] [실제] [기대]`)으로 들어옵니다. 우선순위: 오류 → 문서와 다른 것 → 새 요청. 새 요청은 바로 만들지 말고 PROGRESS.md에 적고 확인받습니다.
- 기획서가 v1.1 등으로 바뀌면 `docs/`의 PDF를 교체하고, 바뀐 부분만 반영합니다.
- 외부 사이트 접근이 필요한 설정(카카오 키 발급, Vercel 배포, Supabase 프로젝트 생성)은 직접 하지 말고 사람이 할 일로 PROGRESS.md에 단계별로 적습니다.
