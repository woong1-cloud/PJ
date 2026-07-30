# 모아 MOA

요구사항과 프로젝트를 한곳에 모읍니다.

이랜드 온라인BU 멀티브랜드 요구사항 관리 웹앱. 여러 브랜드(스파오·미쏘·뉴발란스…)가
각자 요구사항을 올리고, IT가 검토·개발·배포까지 한 화면에서 굴린다.

## 무엇을 하는 앱인가

- **요구사항** — 브랜드가 올리고 IT가 처리한다. 목록 / 칸반 보드 두 뷰.
- **프로젝트** — 여러 브랜드에 같은 건을 전개할 때 묶는 단위. 목록 / 로드맵 두 뷰.
- **대시보드** — 전사 현황(전체관리자용).
- **코멘트 · @멘션 · 알림** — 요구사항마다 대화가 붙고, 내 건에 무슨 일이
  생기면 벨로 알린다.

## 상태 흐름

이름만 보고 지금 누구 차례인지 알 수 있게 지었다.

```
작성중 → 검토대기 → 검토중 → 개발중 → 완료
                              ↘ 반려 / 취소 / 중복
```

`작성중`은 브랜드가 쓰는 중, `검토대기`는 IT 차례, `검토중`부터 IT가 잡은 것이다.
정의는 `lib/statuses.js` 와 `lib/statusMeta.js` 한 곳에만 있다. 앱 안에서는
도움말(`/help`)에 같은 내용이 사람 말로 적혀 있다.

## 권한

4단계다. 숫자가 작을수록 권한이 크다.

| 등급 | 하는 일 |
|---|---|
| 1차 | 전체관리자 — 브랜드·팀원 관리 (`is_global_admin`) |
| 2차 | 브랜드 관리자 — 그 브랜드의 팀·카테고리 설정 |
| 3차 | IT 실무자 — 상태 변경, 담당자 지정, 배포예상일 |
| 4차 | 요청자 — 자기 브랜드에 요구사항 등록 |

**RLS 를 쓰지 않는다.** 판정은 전부 서버 라우트에서 `requireBrandAccess()` /
`requireGlobalAdmin()` 로 한다(`lib/permissions.js`). 그래서 서버는
`service_role` 키로 DB에 붙고, 그 키는 브라우저로 절대 나가지 않는다.
클라이언트가 보내는 등급·소속은 신뢰하지 않는다 — 서버가 매번 다시 조회한다.

## 개발

```bash
npm install
cp .env.local.example .env.local   # 값을 채운다
npm run dev
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 순수 함수 테스트 (vitest) |
| `npm run lint` | eslint |
| `npm run build` | 프로덕션 빌드 (standalone) |
| `npm run package` | 사내 배포용 ZIP → `dist/` |

## DB

`supabase/migrations/` 를 번호 순서대로 Supabase SQL 에디터에서 실행한다.
0001 부터 차례대로 — 중간을 건너뛰면 뒤 마이그레이션이 없는 컬럼을 참조한다.

## 배포

`npm run build && npm run package` 로 ZIP 을 만들어 사내 서버에 올린다.
ZIP 안의 `배포안내.md` 에 실행 방법과 확인 절차가 있다.

주의할 점 하나: `NEXT_PUBLIC_` 으로 시작하는 환경변수는 **빌드할 때 코드에
박혀 들어간다.** Supabase 프로젝트를 옮기려면 ZIP 을 다시 만들어야 한다.
런타임에 읽는 값은 `SUPABASE_URL` 과 `SUPABASE_SERVICE_ROLE_KEY` 둘뿐이다.

## 문서

`docs/specs/` 에 설계 스펙, `docs/plans/` 에 구현 계획이 날짜순으로 있다.
"왜 이렇게 되어 있는지"는 대부분 거기와 코드 주석에 적혀 있다.

## 기술 스택

Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui (base-ui) ·
Supabase (Postgres + Auth) · Vitest
