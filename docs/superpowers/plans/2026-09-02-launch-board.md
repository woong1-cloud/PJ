# 브랜드 런칭 구현 계획 — 1단계

스펙: `docs/superpowers/specs/2026-09-02-launch-board-design.md`

**목표:** 시트를 대신할 수 있는 최소 덩어리 — 가이드 · 가져오기 · 런칭 목록 · 보드.

**메뉴 이름은 `런칭 (beta)`** 다. 403건짜리 새 개념이 붙는 것이라, 쓰는 사람이
"이건 아직 다듬는 중"임을 알고 들어와야 한다. 요구사항·주간회의와 같은 무게로
보이면 안 된다.

**테스트 환경이 `node` 라 DOM 이 없다.** 렌더 테스트는 만들지 않고 판정을
순수 함수로 빼서 그것만 검사한다.

1단계가 크다. 세 번에 나눠 배포한다.

---

## 1-A. 데이터 모델과 셈 (배포 가능, 화면 없음)

### A1. 마이그레이션 0031

**파일** — 만들기: `supabase/migrations/0031_launch.sql`

테이블 여섯.

| 테이블 | 무엇 |
|---|---|
| `launch_guides` | 가이드 (지금은 하나) |
| `launch_roles` | 역할 사전 (`24_R&R분배`) |
| `launch_guide_items` | 가이드 항목 403건 |
| `launches` | 브랜드 런칭 |
| `launch_tasks` | 런칭 항목 (가이드의 복제본) |
| `launch_members` | 참여자 + 역할 매핑 |

`due_date` 컬럼은 **없다.** `open_date + day_offset` 으로 계산한다(스펙 3절).

`unique (guide_id, code)` 와 `unique (launch_id, code)` 가 가져오기의 못이다 —
이게 있어야 같은 파일을 두 번 올려도 안전하다.

### A2. `lib/launchDate.js`

**파일** — 만들기: `lib/launchDate.js`, `lib/launchDate.test.js`

```js
export function dueDate(openDate, dayOffset)   // 'YYYY-MM-DD' | null
export function dDay(dateStr, today)           // 정수 | null
export function dDayLabel(days)                // 'D-125' | 'D+3' | 'D-DAY'
```

UTC 로만 셈한다. 시간대를 태우면 하루가 어긋나고, 403건에서 그 하루가 여기저기
다르게 나타난다.

**검사할 것:** 음수·0·양수 offset / 오픈일이 바뀌면 전부 따라온다 / 월·연 경계 /
읽을 수 없는 값은 `null` / `D-DAY` 는 0일 때만.

### A3. `lib/launchTask.js`

**파일** — 만들기: `lib/launchTask.js`, `lib/launchTask.test.js`

```js
export const LAUNCH_STATUSES = ['할 것', '하는 중', '완료', '막힘'];
export const BLOCKED_STATUS = '막힘';
export const LAUNCH_DONE = '완료';

export function isDone(task)
export function isLate({ task, openDate, today })      // 완료는 지남이 아니다
export function isThisWeek({ task, openDate, today })
export function isBlockedByDep({ task, tasks })        // 선행이 안 끝났나
export function taskTone({ task, openDate, today })    // 화면 색 하나로
```

**검사할 것:** 완료는 지남이 아니다 / 기한 당일은 아직 안 지났다 / 막힘은 상태와
무관하게 회의 안건이다 / 선행이 여럿이면 하나라도 안 끝나면 대기 / 선행 코드가
목록에 없으면 대기가 아니다(다른 유형이라 안 가져온 것일 수 있다).

### A4. `lib/launchImport.js` — 이 계획에서 가장 중요한 파일

**파일** — 만들기: `lib/launchImport.js`, `lib/launchImport.test.js`

시트에서 뽑은 행 배열을 받아 가이드 항목으로 바꾼다. **파일을 읽지 않는다** —
파싱은 화면이 하고, 이 함수는 순수하다.

```js
export const IMPORT_COLUMNS = [
  'ID','결정권','소속','주관','지원','대분류','체크 항목','채널',
  '선행조건','D-day','기한','상태','산출물/증빙','비고','진행상태',
];

export const DERIVED_SHEETS = /^(00|19|20|21|22|23|24)_/;

export function isTaskSheet(name)          // 01~18 만 참
export function parseRows({ sheetName, rows })   // → 항목 배열
export function planImport({ incoming, existing })  // → { create, update, skip }
```

**규칙 넷.**

1. `기한` 열은 **안 읽는다.** `D-day` 만 쓴다(스펙 3절).
2. 파생 시트(`19`~`24`)와 `00` 은 건너뛴다.
3. `비고` 에 `★` 가 있으면 `is_critical`.
4. `선행조건` 이 여럿이면 쉼표·슬래시로 나눈다.

`planImport` 가 upsert 계획을 만든다. **정의는 덮고 상태는 안 덮는다** — 이건
가이드 항목에는 상태가 없으니 자연히 지켜지지만, 런칭 항목을 갱신할 때가 진짜
자리다(1-C).

**검사할 것:**
- v10 의 15열을 읽는다
- `기한` 열 값이 달라도 결과가 같다 ← 3절을 지키는 검사
- `19_목표역산`·`24_R&R분배` 는 건너뛴다
- `★` 를 비고에서 읽는다
- 선행조건 `01-01, 01-02` 를 둘로 나눈다
- 빈 행·머리 행을 버린다
- `D-day` 가 없으면 그 행을 버린다 (기한을 셀 수 없다)
- `planImport` 가 새것·갱신·건너뜀을 가른다
- 같은 `code` 가 두 번 오면 뒤엣것이 이긴다

### A5. `lib/launchRoles.js`

**파일** — 만들기: `lib/launchRoles.js`, `lib/launchRoles.test.js`

`24_R&R분배` 를 역할 사전으로 바꾼다.

```js
export function parseRoles(rows)   // [{ name, org, scopeText, count }]
```

시트 아래쪽의 `시트 × 역할 분포` 표는 안 읽는다 — 파생이다.

**검사할 것:** 역할 13종을 읽는다 / 분포 표에서 멈춘다 / 건수 열은 참고로만 읽고
저장하지 않는다(모아가 다시 센다).

### A6. 검증·커밋

`npx vitest run` · `npm run build` · SQL 을 사람에게 넘긴다.

---

## 1-B. 가이드와 가져오기

### B1. 파싱은 화면에서

**파일** — 만들기: `components/launch/ImportDialog.jsx`

`xlsx` 를 **동적으로** 불러온다. 가져오기 창을 열 때만 받으므로 다른 화면이
무거워지지 않는다.

```js
const XLSX = await import('xlsx');
```

파일을 서버에 올리지 않는다. 저장소도 업로드 배관도 필요 없고, 서버는 JSON 만
받는다. 대신 **서버가 다시 검증한다** — 화면이 보낸 것을 믿지 않는다.

CSV 도 같은 창에서 받는다.

### B2. 미리보기 후 확정

403건이 그냥 들어가면 무섭다.

```
읽은 시트 18개 · 건너뛴 시트 7개(파생)
새로 추가 403 · 갱신 0 · 건너뜀 0
역할 13종

  [그만두기]  [가져오기]
```

### B3. 서버

**파일**
- 만들기: `app/api/launch/guides/route.js` (GET·POST)
- 만들기: `app/api/launch/guides/[id]/import/route.js` (POST)

전체 관리자만. `planImport` 를 서버에서 다시 돌린다.

### B4. 가이드 화면

**파일**
- 만들기: `app/launch/layout.js` (`IdentityProvider` + `TopBar`)
- 만들기: `app/launch/guide/page.js`
- 만들기: `components/launch/GuideView.jsx`

워크스트림별로 접었다 편다. 검색이 있다 — 403건은 훑는 목록이 아니라 찾아
들어가는 문서다.

항목마다: 제목 · ★ · 왜(비고) · 산출물 · 권장 D-day · 선행 · 결정권/소속/주관/지원.

역할 사전도 여기 있다.

### B5. 메뉴

**파일** — 고치기: `components/TopBar.jsx`

`프로젝트` 오른쪽에 `런칭 (beta)`. 전체 관리자에게만 보인다 — 1단계에서는
가이드와 가져오기뿐이라 참여자가 할 일이 없다.

---

## 1-C. 런칭 목록과 보드

### C1. 서버

**파일**
- 만들기: `app/api/launch/route.js` (GET 목록 · POST 생성)
- 만들기: `app/api/launch/[id]/route.js` (GET 상세)
- 만들기: `app/api/launch/[id]/tasks/[taskId]/route.js` (PATCH 상태·담당)

생성은 가이드에서 복제한다. **참조가 아니라 값 복사** — `guide_item_id` 만
남긴다(되먹임용).

### C2. 런칭 목록과 만들기

**파일**
- 만들기: `app/launch/page.js`
- 만들기: `components/launch/LaunchList.jsx`
- 만들기: `components/launch/NewLaunchDialog.jsx`

유형을 고르면 가져올 워크스트림이 정해지고, 개별로 더하고 뺀다. 몇 건이
복제되는지 화면에 숫자로 보인다.

### C3. 보드

**파일**
- 만들기: `app/launch/[id]/page.js`
- 만들기: `components/launch/LaunchBoard.jsx`

워크스트림별 접기. 행에서 상태를 바꾼다. 선행이 안 끝났으면 `대기`.

`막힘` 을 고르면 사유를 한 줄 받는다 — 주간 진척(2단계)에서 그 문장이 안건이
된다.

### C4. 권한

**파일** — 만들기: `lib/launchAccess.js`, `app/api/launch/**`

| 누가 | 무엇을 |
|---|---|
| 전체 관리자 | 전부 |
| 참여자(can_edit) | 상태·담당·항목 추가 |
| 참여자 | 읽기 |
| 그 외 | 못 본다 |

브랜드 등급을 안 본다(스펙 8절).

---

## 되짚어 볼 위험

| 무엇 | 왜 |
|---|---|
| `xlsx` 새 의존성 | 배포가 `npm install` 을 다시 도니 문제없다. 동적 import 라 다른 화면은 안 무거워진다 |
| 403건 화면 | 워크스트림별로 접히지 않으면 못 읽는다. 접기가 기본값이다 |
| `unique(code)` | 이게 없으면 두 번째 업로드가 중복을 만든다. 마이그레이션에서 반드시 |
| 메뉴가 늘어남 | 상단바가 여섯이 된다. `(beta)` 를 붙여 무게를 낮춘다 |
| 1단계가 큼 | 세 번에 나눠 배포한다. 1-A 는 화면이 없어 안전하다 |
