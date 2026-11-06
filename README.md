# 착(CHAK) 웹 — 1단계 (DB · 도장 서버 · 현장 리더)

순수 JavaScript + React(Next.js App Router) + Supabase + Vercel.
TypeScript 파일은 없습니다. 이전 0단계(TS) 폴더는 **이 폴더로 통째로 교체**하세요.

## 디렉토리 구조

```
chak-web/
├─ .env.local                  환경변수 (Supabase·카카오 키 입력됨, secret key는 직접 입력)
├─ .env.example                환경변수 견본
├─ package.json                스크립트: dev / build / start / admin:create
├─ jsconfig.json               @/ 경로 별칭
├─ next.config.mjs
├─ postcss.config.mjs          Tailwind v4
├─ middleware.js               접속 주소 → 관광지/순례 판별, /k/코드 등을 /[service]/… 로 연결
│
├─ app/
│  ├─ layout.jsx               공통 레이아웃 (폰트: Pretendard, Noto Serif KR)
│  ├─ globals.css              디자인 토큰 (관광지·순례 테마)
│  ├─ not-found.jsx
│  ├─ [service]/               관광지(tour) · 순례(pilgrim) 사용자 화면 (2·4단계에서 채움)
│  │  ├─ layout.jsx
│  │  ├─ page.jsx              임시 첫 화면
│  │  └─ design/page.jsx       디자인 시안 미리보기
│  ├─ reader/                  현장 리더 R-01~R-03
│  │  ├─ page.jsx
│  │  ├─ ReaderApp.jsx
│  │  └─ reader.css
│  └─ api/
│     ├─ health/route.js       연결 확인 (운영 전 삭제)
│     └─ reader/
│        ├─ register/route.js  리더 등록 (6자리 코드 → 리더 토큰)
│        ├─ stamp/route.js     도장 기록 (POST /api/reader/stamp)
│        └─ heartbeat/route.js 리더 상태 신호
│
├─ lib/
│  ├─ service.js               웹 판별 (TOUR_HOSTS / PILGRIM_HOSTS)
│  ├─ keyring-code.js          키링 코드 형식 (31자 · 8자리)
│  ├─ supabase/
│  │  ├─ admin.js              서버 전용 (secret key)
│  │  └─ browser.js            브라우저용 (publishable key)
│  ├─ server/http.js           응답 · 토큰 · IP 해시 도우미
│  └─ reader/
│     ├─ queue.js              오프라인 대기열 (IndexedDB, 최대 500건)
│     ├─ nfc.js                NDEF 주소에서 코드 추출, 칩 UID 정리
│     └─ messages.js           R-02 결과 문구
│
├─ public/reader-sw.js         리더 화면 오프라인 캐시 (설치 기능 없음)
├─ scripts/create-super-admin.mjs   최고 관리자 계정 생성
│
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_schema.sql       테이블 17개 + 사진 3장 제한 + 차단 카운터
│  │  ├─ 0002_functions.sql    도장 기록 · 리더 등록 · 키링 발급 · 분실 이전 · 코드 차단
│  │  ├─ 0003_rls.sql          권한(RLS) · 저장소 버킷
│  │  └─ 0004_seed.sql         임시 시연 데이터
│  └─ queries/check.sql        확인용 쿼리 (등록 코드 · 키링 코드 · 최근 도장 등)
│
├─ design/                     DESIGN.tour.md · DESIGN.pilgrim.md (디자인 시안 v0.1)
└─ docs/DECISIONS.md           기획 ↔ 개발 결정 기록
```

## 설치 · 실행 순서

1. Node.js 20.6 이상에서 `npm install`
2. `.env.local`에 `SUPABASE_SECRET_KEY`(Supabase → Settings → API Keys의 secret key)와 `IP_HASH_SALT`(아무 긴 문자열)를 넣습니다.
3. Supabase 대시보드 → SQL Editor에서 `supabase/migrations/0001` → `0002` → `0003` → `0004` 순서로 실행합니다.
4. `npm run admin:create` → 최고 관리자 계정 생성(비밀번호를 비워 두면 임시 비밀번호가 한 번 표시됨)
5. `npm run dev` → http://tour.localhost:3000 , http://pilgrim.localhost:3000
   (열리지 않으면 hosts 파일에 `127.0.0.1 tour.localhost pilgrim.localhost` 추가)
6. http://tour.localhost:3000/api/health 에서 `db: "ok"` 확인

## Vercel 배포

1. GitHub에 올리고 Vercel 프로젝트에 연결합니다(.env.local은 올라가지 않음).
2. Settings → Domains: 관광 웹 = `chack-gamma.vercel.app`. 순례 웹 주소는 아직 없음(정해지면 추가).
3. Settings → Environment Variables에 `.env.local` 값을 넣고 주소 목록을 바꿉니다.
   - `TOUR_HOSTS=chack-gamma.vercel.app,tour.localhost`
   - `PILGRIM_HOSTS=pilgrim.localhost` (순례 주소가 정해지면 맨 앞에 추가)
   - `SUPER_ADMIN_*`은 넣지 않아도 됩니다.
4. 카카오 개발자 콘솔 Web 사이트 도메인에도 두 주소를 등록합니다.

## 리더 시험 (기획서 시험 1~4번)

Web NFC는 **안드로이드 + 크롬 + https**에서만 동작하므로 Vercel 배포 주소에서 시험합니다.

1. `supabase/queries/check.sql` ②의 키링 코드를 NFC 기록 앱으로 시험용 키링에 URL로 기록
   (`https://<관광지 배포 주소>/k/<코드>`). 도메인 확정 전이므로 시험용 키링에만 기록하세요.
2. 안드로이드 크롬에서 `/reader` → ①의 "현충사 · 홍살문" 등록 코드 입력 → R-01에 지점 이름 표시 (시험 1)
3. [리더 시작] → NFC 권한 허용 → 키링 태그 → "도장 쾅! 홍살문 · 현충사 1/5", `visits`에 1행 (시험 2)
4. 10초 뒤 같은 키링 → "오늘은 이미 도장을 받았어요" (시험 3)
5. 온라인에서 `/reader`를 한 번 새로고침(캐시 저장) → 와이파이 끄기 → 태그 → "저장했어요!" → 와이파이 켜기 → 20초 안에 전송, `tagged_at`이 실제 태그 시각 (시험 4)

## 검증 상태

- 이 묶음은 인터넷이 없는 환경에서 만들어 `npm install`·`next build`·SQL 실행을 하지 못했습니다.
- JS/JSX 파일은 문법 검사만 통과했습니다. 빌드·SQL 오류가 나면 메시지를 그대로 알려 주세요.
