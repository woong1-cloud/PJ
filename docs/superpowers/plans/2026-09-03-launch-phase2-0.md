# 런칭 2-0 구현 계획 — 흔들리는 목록

> **작업자에게:** `superpowers:subagent-driven-development` 또는
> `superpowers:executing-plans` 로 한 과제씩 실행한다. 단계는 체크박스(`- [ ]`)다.

**목표:** HOKA 통합 WBS 451건이 모아 런칭에 들어가고, 전제 7줄이 화면에 보인다.

**아키텍처:** 가져오기의 시트 판정을 이름에서 머리 행으로 옮기고, 코드 정규식을
넓히고, `해당없음` 을 상태에 더한다. 런칭에도 가져오기 문을 내되 `준비` 상태에서만
열린다. 판정은 전부 `lib/` 의 순수 함수로 빼고 거기만 검사한다.

**기술 스택:** Next.js 16 (App Router, JS) · Supabase · Vitest(`environment: 'node'`)

**스펙:** `docs/superpowers/specs/2026-09-03-launch-phase2-design.md` 2·3·4·6.5절

---

## 먼저 읽을 것

- **테스트에 DOM 이 없다.** `vitest.config` 가 `environment: 'node'` 다.
  렌더 테스트를 만들지 말고 판정을 순수 함수로 빼서 그것만 검사한다.
- **SQL 은 사람이 돌린다.** 마이그레이션 파일을 쓰고 사용자에게 넘긴다.
  프로덕션 DB 에 직접 쓰지 않는다.
- **배포는 `npm run package:src`** 다. `npm run package` 가 아니다.
- 커밋 메시지는 한국어. 끝에
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` 를 붙인다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0032_launch_phase2.sql` | 스키마 (2-1·2-2 것까지 한 번에) |
| `lib/sheetHeader.js` | 있음. 안 고친다 |
| `lib/launchImport.js` | 시트 판정 · 코드 형식 · 제외 읽기 |
| `lib/launchContext.js` | **새로.** `00_개요` 의 [제반사항] 파싱 |
| `lib/launchTask.js` | `해당없음` 판정과 분모 |
| `lib/launchReimport.js` | **새로.** 재가져오기 규칙 (2.5절 표) |
| `app/api/launch/[id]/import/route.js` | **새로.** 런칭에 직접 가져오기 |
| `app/api/launch/[id]/tasks/route.js` | **새로.** 항목 손으로 더하기 |
| `app/api/launch/[id]/tasks/[taskId]/route.js` | 있음. `해당없음` · 사유 |
| `app/api/launch/[id]/tasks/bulk/route.js` | **새로.** 여러 줄 한 번에 |
| `app/api/launch/guides/[id]/import/route.js` | 있음. 코드 정규식만 |
| `components/launch/ImportDialog.jsx` | 가이드·런칭 양쪽에서 쓰게 |
| `components/launch/LaunchBoard.jsx` | 해당없음 · 다중 선택 · `⋯` 메뉴 |
| `components/launch/NotApplicableDialog.jsx` | **새로.** 사유 필수 창 |
| `components/launch/LaunchContext.jsx` | **새로.** 전제 블록 |
| `app/launch/[id]/page.js` | 준비/진행 중 배너 |

---

## Task 1: 마이그레이션 0032

**파일** — 만들기: `supabase/migrations/0032_launch_phase2.sql`

- [ ] **1단계: SQL 을 쓴다**

```sql
-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 런칭 2단계 — 흔들리는 목록.
--
-- 1단계는 "403건을 한 번 넣고 쓴다"를 전제로 만들었다. 그 전제가 틀렸다.
-- 목록은 매주 흔들린다 — 항목이 더해지고 빠진다. 이 마이그레이션이 그것을
-- 다룰 자리를 만든다.

-- 1) 해당없음.
--
-- 별도 boolean 을 두지 않는다. 시트가 이미 '상태' 열에 '해당없음' 을 쓰고
-- 있어서, 같은 말을 두 축으로 나누면 "완료면서 해당없음"이 만들어지고
-- 그때 진척률이 무슨 뜻인지 아무도 모른다.
alter table launch_tasks drop constraint if exists launch_tasks_status_check;
alter table launch_tasks add constraint launch_tasks_status_check
  check (status in ('할 것', '하는 중', '완료', '막힘', '해당없음'));

-- 2) 어디서 왔나 / 왜 뺐나.
--
-- source 가 'manual' 인 항목은 재가져오기가 안 건드린다. 시트 밖에서 난
-- 일이라 시트에 없는 게 당연하다. 그리고 이 값이 있어야 나중에 "HOKA 에서
-- 새로 생긴 것"을 뽑아 가이드로 되돌릴 수 있다(4단계).
alter table launch_tasks add column if not exists source text not null default 'guide';
alter table launch_tasks drop constraint if exists launch_tasks_source_check;
alter table launch_tasks add constraint launch_tasks_source_check
  check (source in ('guide', 'import', 'manual'));

-- 사유는 화면에서 필수다. DB 에서 not null 로 막지 않는 이유는 이미 들어간
-- 행이 있고, 상태가 '해당없음' 일 때만 뜻이 있기 때문이다.
--
-- 가져오기가 뺀 것은 사유가 '양식에서 빠짐' 이다. 사람이 뺀 것은 사람이 쓴
-- 문장이다. 그 차이로 되살릴지를 가른다 — 컬럼을 따로 두지 않는 이유다.
alter table launch_tasks add column if not exists excluded_reason text;
alter table launch_tasks add column if not exists excluded_at timestamptz;
alter table launch_tasks add column if not exists excluded_by uuid references team_members(id);

-- 3) 지식.
--
-- context: 00_개요 의 [제반사항] 7줄. 451건이 왜 그렇게 생겼는지의 답이다.
-- jsonb 인 이유는 항목 이름이 브랜드마다 달라서다 — 컬럼으로 박으면 다음
-- 브랜드에서 '가맹 여부' 가 생겼을 때 마이그레이션을 해야 한다.
alter table launches add column if not exists context jsonb not null default '[]';

-- plain_text: 01_WBS 의 '쉬운 설명' 같은 문장.
-- "새 회사를 세우고 온라인으로 물건을 팔 수 있는 허가를 받는 일"
--
-- 451건을 다 채우라는 게 아니다. 비어 있어도 된다. 브랜드가 "이게 뭔 소리야"
-- 하고 물으면 그때 한 줄 채우고, 다음 브랜드는 채워진 것을 받는다.
alter table launch_guide_items add column if not exists plain_text text;
alter table launch_tasks       add column if not exists plain_text text;

-- 4) 결정 대기 (2-1 에서 쓴다).
--
-- RAID 로그의 D 다. 476건 중 회의에서 실제로 다투는 것은 이 14건이고
-- 나머지는 그 결과다.
create table if not exists launch_decisions (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references launches(id) on delete cascade,
  -- 시트 순서. 사람이 시기 순으로 적어 두었으니 그대로 쓴다.
  seq integer not null,
  -- '9월 중'. 날짜로 바꾸지 않는다 — 2026-09-15 로 바꾸면 없는 정확도를
  -- 만들고, 그 날짜가 지나면 화면이 붉어진다. 있지도 않은 약속을 어겼다고.
  when_text text,
  title text not null,
  -- 미결 시 영향. 3단계 협조요청 메일에 그대로 담긴다.
  impact text,
  owner_text text,
  status text not null default '대기'
    check (status in ('대기', '결정', '보류')),
  decided_at timestamptz,
  decided_note text,
  decided_by uuid references team_members(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (launch_id, seq)
);

create index if not exists launch_decisions_launch_idx
  on launch_decisions (launch_id, seq);

-- 5) 막힘 → 결정 (2-1 에서 쓴다).
--
-- "A dependency is not a note. It blocks specific tasks."
-- blocked_reason 에 "재고 운영 방식 미결"이라고 써 봐야 그건 글자일 뿐이고,
-- 결정이 내려져도 막힌 항목은 안 풀린다.
--
-- launch_decisions 를 참조하므로 반드시 그 테이블 다음에 온다.
alter table launch_tasks add column if not exists blocked_decision_id uuid
  references launch_decisions(id) on delete set null;

comment on column launch_tasks.excluded_reason is
  '해당없음 사유. 가져오기가 뺀 것은 ''양식에서 빠짐''.';
comment on column launches.context is
  '프로젝트 전제. 00_개요 의 [제반사항]. [{label, value}]';
comment on column launch_tasks.plain_text is
  '처음 하는 사람을 위한 한 줄. 비어 있어도 된다.';
```

- [ ] **2단계: 사용자에게 넘긴다**

파일 경로를 알려주고 Supabase SQL Editor 에서 실행해 달라고 한다.
**직접 실행하지 않는다.**

- [ ] **3단계: 커밋**

```bash
git add supabase/migrations/0032_launch_phase2.sql
git commit -m "feat(launch): 0032 — 해당없음·전제·쉬운 설명·결정 대기"
```

---

## Task 2: `lib/launchImport.js` — 시트를 머리 행으로 고른다

**파일**
- 고치기: `lib/launchImport.js`
- 고치기: `lib/launchImport.test.js`

- [ ] **1단계: 실패하는 테스트를 쓴다**

`lib/launchImport.test.js` 의 `describe('isTaskSheet', ...)` 블록을 통째로
아래로 바꾼다. 기존 블록은 `isTaskSheet('01_신규법인')` 처럼 이름만 넘기는데,
그 시그니처가 바뀐다.

```js
const HEADER = [
  'ID', '결정권', '소속', '주관', '지원', '대분류', '체크 항목', '채널',
  '선행조건', 'D-day', '기한', '상태', '산출물/증빙', '비고', '진행상태',
];

describe('isTaskSheet', () => {
  // 이름이 아니라 머리 행이 정한다.
  //
  // 이름 규칙(/^(0[1-9]|1[0-8])_/)이 통합 WBS 에서 두 번 틀렸다 —
  // 01_WBS 를 항목 시트로 오인했고 D01~D19 를 건너뛰었다. 'D' 를 정규식에
  // 더하는 것은 같은 실수를 한 번 더 하는 것이다. 다음 파일은 또 다른
  // 이름을 쓴다.
  it('머리 행이 있으면 이름과 무관하게 항목 시트다', () => {
    expect(isTaskSheet({ name: 'D01_법인·행정', rows: [HEADER] })).toBe(true);
    expect(isTaskSheet({ name: '01_신규법인', rows: [HEADER] })).toBe(true);
    expect(isTaskSheet({ name: '아무이름', rows: [HEADER] })).toBe(true);
  });

  it('머리 행이 없으면 아니다 — 01_WBS · 02_간트 가 여기서 빠진다', () => {
    const wbs = ['ID', '구분', '핵심 과업', '쉬운 설명', '주관', '담당자', '참여'];
    const gantt = ['ID', '구분', '핵심 과업', '주관', '담당자', '시작', '종료', '상태'];
    expect(isTaskSheet({ name: '01_WBS', rows: [wbs] })).toBe(false);
    expect(isTaskSheet({ name: '02_간트', rows: [gantt] })).toBe(false);
    expect(isTaskSheet({ name: '00_개요', rows: [['제목만']] })).toBe(false);
  });

  it('제목 줄이 위에 붙어 있어도 찾는다', () => {
    expect(isTaskSheet({ name: 'D05', rows: [['상품 콘텐츠'], [], HEADER] })).toBe(true);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(isTaskSheet({ name: 'X', rows: [] })).toBe(false);
    expect(isTaskSheet({})).toBe(false);
    expect(isTaskSheet()).toBe(false);
  });
});
```

- [ ] **2단계: 실패를 확인한다**

```bash
npx vitest run lib/launchImport.test.js
```

기대: `isTaskSheet is not a function` 이 아니라, 이름 기반이라 `아무이름` 이
`false` 로 나와 실패한다.

- [ ] **3단계: 구현한다**

`lib/launchImport.js` 에서 `TASK_SHEET` 정규식과 `isTaskSheet` 를 지우고
아래로 바꾼다. `findHeaderRow` 를 import 에 더한다.

```js
import { findHeaderRow, toObjects } from './sheetHeader';
```

```js
// 항목 시트인가 — 이름이 아니라 머리 행이 정한다.
//
// 이름 규칙(/^(0[1-9]|1[0-8])_/)이 통합 WBS 에서 두 번 틀렸다. 01_WBS 와
// 02_간트 를 항목 시트로 오인했고, 정작 항목이 있는 D01~D19 를 건너뛰었다.
// 'D' 를 정규식에 더하는 것은 같은 실수를 한 번 더 하는 것이다 — 다음
// 파일은 또 다른 이름을 쓴다.
//
// 세 열(ID · 체크 항목 · D-day)이 다 있는 행을 가진 시트만 항목 시트다.
// 01_WBS 는 '체크 항목' 도 'D-day' 도 없어서 저절로 빠진다.
export function isTaskSheet({ name, rows } = {}) {
  if (typeof name !== 'string' || !name.trim()) return false;
  return findHeaderRow(rows ?? [], REQUIRED) >= 0;
}
```

`parseSheet` 와 `parseWorkbook` 의 부르는 자리를 함께 고친다.

```js
export function parseSheet({ sheetName, rows = [] }) {
  if (!isTaskSheet({ name: sheetName, rows })) return [];
  return toObjects({ rows, required: REQUIRED })
    .map((row, index) => parseRow({ sheetName, row, index }))
    .filter(Boolean);
}
```

```js
export function parseWorkbook(sheets = []) {
  const items = [];
  const skipped = [];
  for (const sheet of sheets ?? []) {
    if (!isTaskSheet({ name: sheet?.name, rows: sheet?.rows })) {
      if (sheet?.name) skipped.push(sheet.name);
      continue;
    }
    items.push(...parseSheet({ sheetName: sheet.name, rows: sheet.rows }));
  }
  const byCode = new Map();
  for (const item of items) byCode.set(item.code, item);
  return { items: [...byCode.values()], skipped, duplicates: items.length - byCode.size };
}
```

- [ ] **4단계: 통과를 확인한다**

```bash
npx vitest run lib/launchImport.test.js
```

기대: PASS. `parseSheet('20_협조요청', [HEADER, ...])` 를 검사하던 옛 테스트가
있으면 함께 깨진다 — 이제 머리 행이 있으니 통과한다. 그 테스트는 **지운다.**
이름으로 거르지 않기로 한 것이 이 과제의 요점이라, 남겨두면 규칙 둘이 싸운다.

- [ ] **5단계: 커밋**

```bash
git add lib/launchImport.js lib/launchImport.test.js
git commit -m "fix(launch): 항목 시트를 이름이 아니라 머리 행으로 고른다"
```

---

## Task 3: 코드 형식 `07B-01`

**파일**
- 고치기: `lib/launchImport.js`
- 고치기: `lib/launchImport.test.js`
- 고치기: `app/api/launch/guides/[id]/import/route.js`

- [ ] **1단계: 실패하는 테스트를 쓴다**

`lib/launchImport.test.js` 에 더한다.

```js
describe('코드 형식', () => {
  // 통합 WBS 가 07B-01 · 10A-03 · 10B-01 을 쓴다. 51건이다.
  // /^\d{2}-\d{2}$/ 로 검사하면 그 51건이 조용히 버려진다.
  it('한 글자 접미가 붙은 코드를 받는다', () => {
    const row = cells({ ID: '07B-02', '체크 항목': '재고 수정 권한 제한', 'D-day': -95 });
    expect(parseRow({ sheetName: 'D08_WMS·재고', row })?.code).toBe('07B-02');
  });

  it('선행조건도 같은 형식을 받는다 — 한쪽만 고치면 연결이 끊긴다', () => {
    expect(parseDeps('07B-01, 10A-03')).toEqual(['07B-01', '10A-03']);
    expect(parseDeps('01-01 02-03')).toEqual(['01-01', '02-03']);
  });

  it('두 글자 접미나 소문자는 안 받는다', () => {
    expect(parseDeps('07BB-01, 07b-01')).toEqual([]);
  });
});
```

`cells()` 헬퍼가 파일 위에 이미 있다. 없으면 아래를 쓴다.

```js
function cells(over = {}) {
  return {
    ID: '01-01', 결정권: 'CAIO실', 소속: '지원조직', 주관: '법무팀', 지원: '재무팀',
    대분류: '법인/자격', '체크 항목': '법인 설립', 채널: '공통', 선행조건: '',
    'D-day': -120, 기한: 46268, 상태: '미착수', '산출물/증빙': '등기부', 비고: '',
    ...over,
  };
}
```

- [ ] **2단계: 실패를 확인한다**

```bash
npx vitest run lib/launchImport.test.js -t "코드 형식"
```

기대: FAIL — `parseRow` 가 `null` 을 돌려주고 `parseDeps` 가 빈 배열이다.

- [ ] **3단계: 구현한다**

`lib/launchImport.js` 위쪽에 상수를 하나 만들고 두 자리를 고친다.

```js
// 항목 코드. 통합 WBS 가 07B-01 · 10A-03 을 쓴다 — 앞자리에 한 글자가
// 붙는다. \d{2}-\d{2} 로만 받으면 그런 51건이 조용히 버려지고, 그것을
// 가리키는 선행조건도 함께 끊긴다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;
```

`parseDeps` 안:

```js
    .filter((s) => CODE.test(s));
```

`parseRow` 안:

```js
  if (!CODE.test(code) || !title) return null;
```

`app/api/launch/guides/[id]/import/route.js` 에도 같은 정규식이 **두 번**
있다. 파일 위에 같은 상수를 두고 둘 다 바꾼다.

```js
// lib/launchImport.js 의 CODE 와 같아야 한다. 서버가 화면을 안 믿고 다시
// 거르는 자리라, 여기가 좁으면 화면이 읽은 것이 서버에서 사라진다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;
```

- [ ] **4단계: 통과를 확인한다**

```bash
npx vitest run lib/launchImport.test.js
```

- [ ] **5단계: 커밋**

```bash
git add lib/launchImport.js lib/launchImport.test.js "app/api/launch/guides/[id]/import/route.js"
git commit -m "fix(launch): 07B-01 형식 코드를 받는다 — 51건이 버려지고 있었다"
```

---

## Task 4: 제외를 읽는다

**파일**
- 고치기: `lib/launchImport.js`
- 고치기: `lib/launchImport.test.js`

- [ ] **1단계: 실패하는 테스트를 쓴다**

```js
describe('제외 읽기', () => {
  // 476건 중 25건이 상태=해당없음 · 진행상태=제외 다. 비고에 이유가 남아
  // 있다 — "[중복] 01-22에서 관리". 이 팀은 지우지 않고 제외한다.
  it("진행상태가 '제외' 면 해당없음으로 들어온다", () => {
    const row = cells({ 진행상태: '제외', 비고: '[중복] 01-21에서 관리' });
    const out = parseRow({ sheetName: 'D03', row });
    expect(out.not_applicable).toBe(true);
    expect(out.excluded_reason).toBe('[중복] 01-21에서 관리');
  });

  it("상태가 '해당없음' 이어도 같다", () => {
    expect(parseRow({ sheetName: 'D03', row: cells({ 상태: '해당없음' }) }).not_applicable)
      .toBe(true);
  });

  it('비고가 비어 있으면 사유를 만들어 준다 — 사유 없는 해당없음은 없다', () => {
    const out = parseRow({ sheetName: 'D03', row: cells({ 진행상태: '제외', 비고: '' }) });
    expect(out.excluded_reason).toBe('양식에서 제외 표시됨');
  });

  it('그 밖의 상태 값은 여전히 안 읽는다', () => {
    // 시트의 진행 상태와 모아의 상태가 갈리면 어느 쪽이 맞는지 아무도 모른다.
    const out = parseRow({ sheetName: 'D01', row: cells({ 상태: '진행중', 진행상태: '이번주' }) });
    expect(out.not_applicable).toBe(false);
    expect(out.status).toBeUndefined();
  });
});
```

- [ ] **2단계: 실패를 확인한다**

```bash
npx vitest run lib/launchImport.test.js -t "제외 읽기"
```

기대: FAIL — `not_applicable` 이 `undefined` 다.

- [ ] **3단계: 구현한다**

`COL` 에 두 열을 더한다.

```js
export const COL = {
  // ... 기존 그대로
  // '기한'은 일부러 안 읽는다.
  deliverable: '산출물/증빙',
  note: '비고',
  // 아래 둘은 '범위'를 읽기 위한 것이다. 진행 상태를 읽는 게 아니다 —
  // '해당없음'은 "이 브랜드에는 안 하는 일"이라는 판단이고, 가져올 때
  // 한 번 반영하면 끝난다.
  status: '상태',
  progress: '진행상태',
};
```

`parseRow` 의 `return` 앞에 더하고, 돌려주는 객체에 두 칸을 더한다.

```js
  // 시트가 '제외'라고 표시한 것. 지우지 않고 남기는 것이 이 팀의 습관이라
  // 그대로 받는다 — 지우면 왜 뺐는지가 사라지고 다음 사람이 다시 넣는다.
  const notApplicable =
    text(row?.[COL.status]) === '해당없음' || text(row?.[COL.progress]) === '제외';
```

```js
    not_applicable: notApplicable,
    // 사유 없는 해당없음은 6개월 뒤 아무 말도 못 한다. 비고가 비었으면
    // 최소한 어디서 왔는지는 남긴다.
    excluded_reason: notApplicable
      ? text(row?.[COL.note]) || '양식에서 제외 표시됨'
      : null,
```

- [ ] **4단계: 통과를 확인한다**

```bash
npx vitest run lib/launchImport.test.js
```

- [ ] **5단계: 커밋**

```bash
git add lib/launchImport.js lib/launchImport.test.js
git commit -m "feat(launch): 시트의 제외 25건을 해당없음으로 읽는다"
```

---

## Task 5: `lib/launchTask.js` — 해당없음과 분모

**파일**
- 고치기: `lib/launchTask.js`
- 고치기: `lib/launchTask.test.js`

- [ ] **1단계: 실패하는 테스트를 쓴다**

`lib/launchTask.test.js` 의 `LAUNCH_STATUSES` 블록을 바꾸고, 아래를 더한다.

```js
describe('LAUNCH_STATUSES', () => {
  it('다섯이다 — 요구사항의 열 개를 쓰지 않는다', () => {
    // 넷에서 다섯으로 늘리는 것은 의도된 변경이다.
    //
    // '해당없음'은 진행 상태가 아니라 범위다. "이 브랜드에는 안 하는 일"
    // 이고, 시트가 이미 25건을 그렇게 쓰고 있어서 같은 말을 쓴다.
    // 진척률 분모에서 빠진다(아래 progress 참고).
    //
    // 화면의 상태 단추는 넷 그대로다 — 해당없음은 ⋯ 메뉴에 있다.
    expect(LAUNCH_STATUSES).toEqual(['할 것', '하는 중', '완료', '막힘', '해당없음']);
    expect(BOARD_STATUSES).toEqual(['할 것', '하는 중', '완료', '막힘']);
  });
});

describe('isNotApplicable', () => {
  it('상태가 해당없음일 때만 참', () => {
    expect(isNotApplicable({ status: '해당없음' })).toBe(true);
    expect(isNotApplicable({ status: '할 것' })).toBe(false);
    expect(isNotApplicable(null)).toBe(false);
  });
});

describe('해당없음은 세지 않는다', () => {
  const openDate = '2027-01-01';
  const today = '2026-09-03';
  const na = { status: '해당없음', day_offset: -200, depends_on: ['01-01'] };

  it('지남에 안 든다', () => {
    // -200 이면 2026-06-15 라 한참 지났다. 그래도 할 일이 아니다.
    expect(isLate({ task: na, openDate, today })).toBe(false);
  });

  it('이번 주에 안 든다', () => {
    expect(isThisWeek({ task: { ...na, day_offset: -118 }, openDate, today })).toBe(false);
  });

  it('선행 대기에 안 든다', () => {
    const tasks = [{ code: '01-01', status: '할 것' }, na];
    expect(isWaitingOnDep({ task: na, tasks })).toBe(false);
  });

  it('진척률 분모에서 빠진다', () => {
    // 476건 중 25건이 해당없음이면 분모는 451이다. 안 빼면 아무리 해도
    // 95%가 천장이 되고, 그 순간 진척률이 아무 말도 안 하게 된다.
    const tasks = [
      { status: '완료', day_offset: -10 },
      { status: '할 것', day_offset: -10 },
      { status: '해당없음', day_offset: -10 },
      { status: '해당없음', day_offset: -10 },
    ];
    const p = progress({ tasks, openDate, today });
    expect(p.total).toBe(2);
    expect(p.done).toBe(1);
    expect(p.percent).toBe(50);
    expect(p.notApplicable).toBe(2);
  });

  it('전부 해당없음이면 0으로 나누지 않는다', () => {
    const p = progress({ tasks: [{ status: '해당없음', day_offset: 0 }], openDate, today });
    expect(p.total).toBe(0);
    expect(p.percent).toBe(0);
  });
});

describe('isDoneThisWeek', () => {
  it('최근 7일 안에 완료한 것', () => {
    const today = '2026-09-03';
    expect(isDoneThisWeek({ task: { status: '완료', done_at: '2026-09-01T00:00:00Z' }, today }))
      .toBe(true);
    expect(isDoneThisWeek({ task: { status: '완료', done_at: '2026-08-20T00:00:00Z' }, today }))
      .toBe(false);
    // 완료 시각이 없으면 셀 수 없다. 옛 데이터가 그럴 수 있다.
    expect(isDoneThisWeek({ task: { status: '완료' }, today })).toBe(false);
    expect(isDoneThisWeek({ task: { status: '할 것', done_at: '2026-09-01' }, today })).toBe(false);
  });
});
```

import 줄에 `BOARD_STATUSES` · `isNotApplicable` · `isDoneThisWeek` 를 더한다.

- [ ] **2단계: 실패를 확인한다**

```bash
npx vitest run lib/launchTask.test.js
```

- [ ] **3단계: 구현한다**

`lib/launchTask.js`:

```js
export const NA_STATUS = '해당없음';

// 상태 다섯. 화면의 단추는 넷이고 해당없음은 ⋯ 메뉴에 있다 —
// 451줄에 다섯째 단추를 붙이면 줄이 넘치고, 자주 누르는 것도 아니다.
export const LAUNCH_STATUSES = ['할 것', '하는 중', '완료', '막힘', NA_STATUS];
export const BOARD_STATUSES = ['할 것', '하는 중', '완료', '막힘'];

// 이 브랜드에는 안 하는 일.
//
// 완료와 다르다. 하나는 끝난 것이고 하나는 애초에 할 일이 아니다.
// 그래서 지남·이번 주·선행 대기·분모 어디에도 안 든다.
export function isNotApplicable(task) {
  return task?.status === NA_STATUS;
}
```

`isLate` · `isThisWeek` · `isWaitingOnDep` 의 첫 줄에 조건을 더한다.

```js
export function isLate({ task, openDate, today } = {}) {
  if (!task || isDone(task) || isNotApplicable(task)) return false;
  // ... 그대로
}
```

```js
export function isThisWeek({ task, openDate, today } = {}) {
  if (!task || isDone(task) || isNotApplicable(task)) return false;
  // ... 그대로
}
```

```js
export function isWaitingOnDep({ task, tasks = [] } = {}) {
  const deps = task?.depends_on ?? [];
  if (!Array.isArray(deps) || deps.length === 0) return false;
  if (isDone(task) || isNotApplicable(task)) return false;
  // ... 그대로
}
```

`taskTone` 에 분기를 더한다. **`isDone` 보다 먼저** 온다 — 해당없음이면서
완료인 행은 없지만, 순서가 뜻을 정한다.

```js
export function taskTone({ task, openDate, today, tasks } = {}) {
  if (!task) return 'flat';
  if (isNotApplicable(task)) return 'na';
  if (isDone(task)) return 'done';
  // ... 그대로
}
```

`progress` 를 바꾼다.

```js
export function progress({ tasks = [], openDate, today } = {}) {
  const all = tasks ?? [];
  // 해당없음은 분모에서 뺀다. 476건 중 25건이 해당없음이면 분모는 451이다 —
  // 안 빼면 아무리 해도 95%가 천장이 되고, 그때 진척률이 아무 말도 안 한다.
  const list = all.filter((task) => !isNotApplicable(task));
  const total = list.length;
  const done = list.filter(isDone).length;
  return {
    total,
    done,
    late: list.filter((task) => isLate({ task, openDate, today })).length,
    blocked: list.filter(isBlocked).length,
    thisWeek: list.filter((task) => isThisWeek({ task, openDate, today })).length,
    doneThisWeek: list.filter((task) => isDoneThisWeek({ task, today })).length,
    // 화면이 "451 (+해당없음 25)"를 보여줄 수 있어야 한다. 분모만 줄이고
    // 뺀 개수를 안 주면 "전체가 몇 건이냐"에 답할 수 없다.
    notApplicable: all.length - total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// 이번 주에 끝난 것. 주간 진척의 마지막 칸이다 — 칭찬 자리가 아니라
// 확인 자리다. 완료로 옮겼는데 실제로는 안 끝난 것이 여기서 걸린다.
export function isDoneThisWeek({ task, today } = {}) {
  if (!isDone(task) || !task?.done_at) return false;
  const at = String(task.done_at).slice(0, 10);
  const days = dDay(at, today);
  return Number.isFinite(days) && days <= 0 && days >= -WEEK_DAYS;
}
```

- [ ] **4단계: 통과를 확인한다**

```bash
npx vitest run lib/launchTask.test.js
```

- [ ] **5단계: 화면이 안 깨졌는지 본다**

`components/launch/LaunchBoard.jsx` 가 `LAUNCH_STATUSES` 로 단추를 그린다.
`BOARD_STATUSES` 로 바꾼다. 안 바꾸면 451줄에 단추가 다섯 개 나온다.

```js
import { BOARD_STATUSES, /* ... */ } from '@/lib/launchTask';
```

```jsx
        {BOARD_STATUSES.map((status) => (
```

```bash
npx vitest run && npx eslint components/launch lib
```

- [ ] **6단계: 커밋**

```bash
git add lib/launchTask.js lib/launchTask.test.js components/launch/LaunchBoard.jsx
git commit -m "feat(launch): 해당없음을 상태에 더하고 분모에서 뺀다"
```

---

## Task 6: `lib/launchReimport.js` — 재가져오기 규칙

**파일**
- 만들기: `lib/launchReimport.js`
- 만들기: `lib/launchReimport.test.js`

이 파일이 이 계획에서 가장 중요하다. 스펙 2.5절의 표가 그대로 코드가 된다.

- [ ] **1단계: 실패하는 테스트를 쓴다**

```js
import { describe, expect, it } from 'vitest';
import { IMPORT_EXCLUDED_REASON, planReimport } from './launchReimport';

const inc = (code, over = {}) => ({
  code, title: '제목', workstream: 'D01', day_offset: -100,
  not_applicable: false, excluded_reason: null, ...over,
});
const have = (code, over = {}) => ({
  id: 'u-' + code, code, status: '할 것', source: 'import',
  excluded_reason: null, ...over,
});

describe('planReimport', () => {
  it('새 코드는 만든다', () => {
    const p = planReimport({ incoming: [inc('01-01')], existing: [] });
    expect(p.create.map((c) => c.code)).toEqual(['01-01']);
    expect(p.create[0].status).toBe('할 것');
  });

  it('양식이 해당없음이면 해당없음으로 만든다', () => {
    const p = planReimport({
      incoming: [inc('03-03', { not_applicable: true, excluded_reason: '[중복] 01-21에서 관리' })],
      existing: [],
    });
    expect(p.create[0].status).toBe('해당없음');
    expect(p.create[0].excluded_reason).toBe('[중복] 01-21에서 관리');
  });

  it('있는 코드는 계획 열만 갱신한다', () => {
    const p = planReimport({
      incoming: [inc('01-01', { title: '고친 제목', day_offset: -75 })],
      existing: [have('01-01', { status: '하는 중' })],
    });
    expect(p.update).toHaveLength(1);
    expect(p.update[0].patch.title).toBe('고친 제목');
    expect(p.update[0].patch.day_offset).toBe(-75);
  });

  it('진행은 안 건드린다 — 이걸 지우면 아무도 두 번 안 올린다', () => {
    const p = planReimport({
      incoming: [inc('01-01')],
      existing: [have('01-01', { status: '막힘' })],
    });
    const keys = Object.keys(p.update[0].patch);
    for (const k of ['status', 'assignee', 'blocked_reason', 'done_at', 'blocked_decision_id']) {
      expect(keys, k).not.toContain(k);
    }
  });

  it('시트에서 사라지면 해당없음으로 바꾼다', () => {
    const p = planReimport({ incoming: [], existing: [have('13-27')] });
    expect(p.exclude).toHaveLength(1);
    expect(p.exclude[0].excluded_reason).toBe(IMPORT_EXCLUDED_REASON);
  });

  it('사라졌는데 완료면 그대로 둔다 — 이미 한 일이다', () => {
    const p = planReimport({ incoming: [], existing: [have('01-01', { status: '완료' })] });
    expect(p.exclude).toEqual([]);
    expect(p.untouched.map((u) => u.code)).toEqual(['01-01']);
  });

  it('사라졌는데 이미 해당없음이면 그대로 둔다', () => {
    const p = planReimport({
      incoming: [],
      existing: [have('09-04', { status: '해당없음', excluded_reason: '우리는 안 함' })],
    });
    expect(p.exclude).toEqual([]);
  });

  it('사라졌는데 손으로 넣은 항목이면 그대로 둔다', () => {
    // 시트 밖에서 난 일이라 시트에 없는 게 당연하다.
    const p = planReimport({ incoming: [], existing: [have('19-91', { source: 'manual' })] });
    expect(p.exclude).toEqual([]);
    expect(p.untouched[0].why).toBe('manual');
  });

  it('가져오기가 뺐던 것이 다시 나타나면 되살린다', () => {
    const p = planReimport({
      incoming: [inc('13-27')],
      existing: [have('13-27', { status: '해당없음', excluded_reason: IMPORT_EXCLUDED_REASON })],
    });
    expect(p.restore.map((r) => r.code)).toEqual(['13-27']);
  });

  it('직전 상태가 사유 뒤에 붙어 있어도 되살린다', () => {
    // 서버가 저장할 때 '양식에서 빠짐 (직전 상태: 하는 중)' 으로 쓴다.
    // 완전 일치로 검사하면 되살리기가 조용히 안 된다.
    const p = planReimport({
      incoming: [inc('16-11')],
      existing: [have('16-11', {
        status: '해당없음',
        excluded_reason: `${IMPORT_EXCLUDED_REASON} (직전 상태: 하는 중)`,
      })],
    });
    expect(p.restore.map((r) => r.code)).toEqual(['16-11']);
    expect(p.restore[0].status).toBe('하는 중');
  });

  it('직전 상태가 안 적혀 있으면 할 것으로 되살린다', () => {
    const p = planReimport({
      incoming: [inc('13-27')],
      existing: [have('13-27', { status: '해당없음', excluded_reason: IMPORT_EXCLUDED_REASON })],
    });
    expect(p.restore[0].status).toBe('할 것');
  });

  it('사람이 사유를 적어 뺀 것은 다시 나타나도 안 되살린다', () => {
    // 사람의 판단이 파일보다 세다. 안 그러면 "우리는 안 함"으로 뺀 항목이
    // 다음 가져오기마다 되살아난다.
    const p = planReimport({
      incoming: [inc('09-04')],
      existing: [have('09-04', { status: '해당없음', excluded_reason: '우리는 인하우스로 함' })],
    });
    expect(p.restore).toEqual([]);
    expect(p.update).toHaveLength(1); // 계획 열은 그래도 갱신한다
  });

  it('빈 입력에서 죽지 않는다', () => {
    const p = planReimport({});
    expect(p).toEqual({ create: [], update: [], exclude: [], restore: [], untouched: [] });
  });
});
```

- [ ] **2단계: 실패를 확인한다**

```bash
npx vitest run lib/launchReimport.test.js
```

기대: `Cannot find module './launchReimport'`

- [ ] **3단계: 구현한다**

```js
import { DONE_STATUS, NA_STATUS, TODO_STATUS } from './launchTask';

// 재가져오기 계획.
//
// 같은 파일을 열 번 올려도 안전해야 한다. 그러지 않으면 아무도 두 번 안
// 올리고, 그러면 양식을 만든 의미가 없다.
//
// 규칙 하나가 나머지를 정한다: 계획은 엑셀이 원본, 진행은 모아가 원본.
// 재가져오기가 지난주 회의에서 찍은 상태를 지우면 그 순간 못 쓰는 기능이
// 된다.

// 가져오기가 뺀 것의 사유. 사람이 쓴 사유와 가르는 표식이다.
//
// 컬럼을 따로 두지 않는 이유: 사유가 어차피 필수다. 필수인 값 하나로
// 구분되면 컬럼을 더 두는 것은 같은 사실을 두 벌 갖는 것이다.
export const IMPORT_EXCLUDED_REASON = '양식에서 빠짐';

// 서버는 사유 뒤에 직전 상태를 붙여 저장한다 —
//   '양식에서 빠짐 (직전 상태: 하는 중)'
//
// 되살릴 때 '할 것' 으로만 돌아가면 "하는 중이었는데"가 사라진다. 컬럼을
// 하나 더 두는 대신 사유 문자열에 담는다. 사유는 어차피 사람이 읽는 것이고,
// 거기 적혀 있는 것이 가장 정직하다.
const PREV = /\(직전 상태:\s*([^)]+)\)/;

function importExcluded(row) {
  return String(row?.excluded_reason ?? '').startsWith(IMPORT_EXCLUDED_REASON);
}

function previousStatus(row) {
  const m = String(row?.excluded_reason ?? '').match(PREV);
  return m ? m[1].trim() : TODO_STATUS;
}

// 엑셀이 원본인 열. 이 목록에 없는 것은 절대 안 덮는다.
const PLAN_COLUMNS = [
  'title', 'workstream', 'category', 'channel', 'decision_org', 'owner_org',
  'owner_role', 'support_role', 'depends_on', 'day_offset', 'deliverable',
  'note', 'is_critical', 'sort_order', 'plain_text',
];

function planPatch(item) {
  const patch = {};
  for (const key of PLAN_COLUMNS) {
    if (item[key] !== undefined) patch[key] = item[key];
  }
  return patch;
}

export function planReimport({ incoming = [], existing = [] } = {}) {
  const rows = incoming ?? [];
  const have = new Map((existing ?? []).map((e) => [e.code, e]));
  const seen = new Set(rows.map((i) => i.code));

  const create = [];
  const update = [];
  const restore = [];

  for (const item of rows) {
    const cur = have.get(item.code);

    if (!cur) {
      create.push({
        ...planPatch(item),
        code: item.code,
        source: 'import',
        status: item.not_applicable ? NA_STATUS : TODO_STATUS,
        excluded_reason: item.not_applicable ? item.excluded_reason : null,
      });
      continue;
    }

    // 계획 열은 언제나 갱신한다. 해당없음인 항목도 마찬가지다 — 되살아날
    // 때 옛 제목으로 돌아오면 안 된다.
    update.push({ id: cur.id, code: cur.code, patch: planPatch(item) });

    // 가져오기가 뺐던 것이 다시 나타났다. 사람이 뺀 것은 안 건드린다 —
    // 사람의 판단이 파일보다 세다.
    //
    // startsWith 인 것이 요점이다. 서버가 직전 상태를 뒤에 붙여 저장하므로
    // 완전 일치로 검사하면 되살리기가 조용히 안 된다.
    if (cur.status === NA_STATUS && importExcluded(cur)) {
      restore.push({ id: cur.id, code: cur.code, status: previousStatus(cur) });
    }
  }

  const exclude = [];
  const untouched = [];

  for (const cur of existing ?? []) {
    if (seen.has(cur.code)) continue;

    // 이미 한 일을 없던 일로 만들 수 없다.
    if (cur.status === DONE_STATUS) {
      untouched.push({ id: cur.id, code: cur.code, why: 'done' });
      continue;
    }
    if (cur.status === NA_STATUS) {
      untouched.push({ id: cur.id, code: cur.code, why: 'already' });
      continue;
    }
    // 시트 밖에서 난 일이라 시트에 없는 게 당연하다.
    if (cur.source === 'manual') {
      untouched.push({ id: cur.id, code: cur.code, why: 'manual' });
      continue;
    }

    exclude.push({
      id: cur.id,
      code: cur.code,
      // 뺄 때의 상태를 사유에 함께 적는다. 되살릴 때 '할 것' 으로만
      // 돌아가면 "하는 중이었는데" 가 사라진다.
      excluded_reason: IMPORT_EXCLUDED_REASON,
      previous_status: cur.status,
    });
  }

  return { create, update, exclude, restore, untouched };
}
```

- [ ] **4단계: 통과를 확인한다**

```bash
npx vitest run lib/launchReimport.test.js
```

- [ ] **5단계: 커밋**

```bash
git add lib/launchReimport.js lib/launchReimport.test.js
git commit -m "feat(launch): 재가져오기 규칙 — 계획만 덮고 진행은 안 건드린다"
```

---

## Task 7: `lib/launchContext.js` — 전제 7줄

**파일**
- 만들기: `lib/launchContext.js`
- 만들기: `lib/launchContext.test.js`

- [ ] **1단계: 실패하는 테스트를 쓴다**

```js
import { describe, expect, it } from 'vitest';
import { parseContext } from './launchContext';

// 00_개요 의 실제 모양. 제목 한 줄, 오픈일, 기준일, 그리고 [제반사항] 블록.
const ROWS = [
  ['신규 스포츠 브랜드 온라인 오픈 체크리스트 — 개요 및 역할', '', ''],
  ['오픈 목표일', 46388, ''],
  ['기준일 2026-09-03   ·   D-120일', '', ''],
  ['[제반사항]', '', ''],
  ['구축 방식', '자체 구축 차세대 플랫폼 기반', ''],
  ['개발 주체', '내부 개발이 아닌 외주 개발', ''],
  ['재고', 'WMS(이허브) 확정. 운영 방식은 미결', ''],
  ['[먼저 결정할 것] — 결정 전에는 후속 과업이 착수되지 않는 항목', '', ''],
  ['시기', '결정 항목', '미결 시 영향'],
];

describe('parseContext', () => {
  it('[제반사항] 블록만 읽는다', () => {
    expect(parseContext(ROWS)).toEqual([
      { label: '구축 방식', value: '자체 구축 차세대 플랫폼 기반' },
      { label: '개발 주체', value: '내부 개발이 아닌 외주 개발' },
      { label: '재고', value: 'WMS(이허브) 확정. 운영 방식은 미결' },
    ]);
  });

  it('다음 [ 에서 멈춘다 — 안 멈추면 결정 표가 전제로 들어온다', () => {
    expect(parseContext(ROWS).some((c) => c.label === '시기')).toBe(false);
  });

  it('블록이 없으면 빈 배열', () => {
    // 다음 브랜드의 파일에 이 블록이 없을 수 있다. 그때 손으로 넣는다.
    expect(parseContext([['제목'], ['아무거나', '값']])).toEqual([]);
  });

  it('값이 없는 줄은 버린다', () => {
    const rows = [['[제반사항]'], ['법인', '신규 법인'], ['빈칸', ''], ['', '값만']];
    expect(parseContext(rows)).toEqual([{ label: '법인', value: '신규 법인' }]);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(parseContext([])).toEqual([]);
    expect(parseContext()).toEqual([]);
  });
});
```

- [ ] **2단계: 실패를 확인한다**

```bash
npx vitest run lib/launchContext.test.js
```

- [ ] **3단계: 구현한다**

```js
// 00_개요 의 [제반사항] → 런칭의 전제.
//
// 451건이 왜 그렇게 생겼는지의 답이 이 7줄이다.
//
//   구축 방식 — 자체 구축 차세대 플랫폼 기반
//   개발 주체 — 내부 개발이 아닌 외주 개발
//   재고 — WMS(이허브) 확정. 운영 방식은 미결
//
// 반년 뒤에 "왜 회원 연동을 안 했지"를 여기서 읽는다. 항목 하나하나를
// 뒤져서는 못 찾는다.

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

const START = '[제반사항]';

// rows 는 배열 행이다(`header: 1`). 다른 파서와 같은 모양으로 받는다.
export function parseContext(rows = []) {
  const list = rows ?? [];
  const at = list.findIndex((r) => (r ?? []).some((c) => text(c).startsWith(START)));
  if (at < 0) return [];

  const out = [];
  for (let i = at + 1; i < list.length; i += 1) {
    const cells = (list[i] ?? []).map(text);
    const label = cells[0] ?? '';
    // 다음 블록에서 멈춘다. 안 멈추면 [먼저 결정할 것] 의 표가 전제로
    // 들어오고, 그러면 화면 맨 위에 '시기 / 결정 항목' 이 뜬다.
    if (label.startsWith('[')) break;
    const value = cells.slice(1).find(Boolean) ?? '';
    if (!label || !value) continue;
    out.push({ label, value });
  }
  return out;
}
```

- [ ] **4단계: 통과를 확인한다**

```bash
npx vitest run lib/launchContext.test.js
```

- [ ] **5단계: 커밋**

```bash
git add lib/launchContext.js lib/launchContext.test.js
git commit -m "feat(launch): 00_개요 의 [제반사항] 을 런칭 전제로 읽는다"
```

---

## Task 8: 런칭에 직접 가져오기 (서버)

**파일**
- 만들기: `app/api/launch/[id]/import/route.js`

- [ ] **1단계: 라우트를 쓴다**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { planReimport, IMPORT_EXCLUDED_REASON } from '@/lib/launchReimport';
import { NA_STATUS, TODO_STATUS } from '@/lib/launchTask';

const MAX_ITEMS = 2000;
// lib/launchImport.js 의 CODE 와 같아야 한다. 여기가 좁으면 화면이 읽은
// 것이 서버에서 조용히 사라진다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;

// 런칭에 엑셀을 직접 가져온다.
//
// 1단계에는 길이 하나뿐이었다 — 엑셀 → 가이드 → 복제 → 런칭. 항목은 값
// 복사라 가이드를 고쳐도 진행 중인 런칭에 안 닿는다. 그 원칙은 맞지만,
// HOKA 파일은 가이드가 아니라 그 런칭 자체다. 길을 하나 더 낸다.
//
// 준비 상태에서만 열린다. 진행 중으로 넘어가면 엑셀 문이 닫히고 그 뒤로는
// 모아에서만 관리한다 — 이 프로젝트의 목적이 그것이다.
export async function POST(request, { params }) {
  try {
    const { memberId } = await requireGlobalAdmin();
    const { id } = await params;
    const { items, context, sourceVersion } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, '가져올 항목이 없습니다.');
    }
    if (items.length > MAX_ITEMS) throw new ApiError(400, '한 번에 처리할 수 있는 양을 넘었습니다.');

    const supabase = getSupabaseAdmin();
    const { data: launch, error: lErr } = await supabase
      .from('launches')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!launch) throw new ApiError(404, '런칭을 찾을 수 없습니다.');
    if (launch.status !== '준비') {
      throw new ApiError(
        400,
        '진행 중인 런칭은 엑셀로 덮어쓸 수 없습니다. 준비로 되돌린 뒤 다시 시도하세요.',
      );
    }

    // 화면이 보낸 것을 믿지 않는다. 아는 열만 골라 담는다.
    const clean = [];
    for (const raw of items) {
      const code = String(raw?.code ?? '').trim();
      const title = String(raw?.title ?? '').trim();
      const workstream = String(raw?.workstream ?? '').trim();
      const dayOffset = Number(raw?.day_offset);
      if (!CODE.test(code) || !title || !workstream) continue;
      if (!Number.isFinite(dayOffset)) continue;

      const na = raw?.not_applicable === true;
      clean.push({
        code,
        workstream,
        title,
        category: raw?.category ?? null,
        channel: raw?.channel ?? null,
        decision_org: raw?.decision_org ?? null,
        owner_org: raw?.owner_org ?? null,
        owner_role: raw?.owner_role ?? null,
        support_role: raw?.support_role ?? null,
        depends_on: Array.isArray(raw?.depends_on)
          ? raw.depends_on.filter((c) => CODE.test(String(c)))
          : [],
        day_offset: Math.trunc(dayOffset),
        deliverable: raw?.deliverable ?? null,
        note: raw?.note ?? null,
        plain_text: raw?.plain_text ?? null,
        is_critical: raw?.is_critical === true,
        sort_order: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : 0,
        not_applicable: na,
        // 사유 없는 해당없음은 만들지 않는다.
        excluded_reason: na ? String(raw?.excluded_reason ?? '').trim() || '양식에서 제외 표시됨' : null,
      });
    }
    if (clean.length === 0) throw new ApiError(400, '읽을 수 있는 항목이 없습니다.');

    const { data: existing, error: exErr } = await supabase
      .from('launch_tasks')
      .select('id, code, status, source, excluded_reason')
      .eq('launch_id', id);
    if (exErr) throw exErr;

    const plan = planReimport({ incoming: clean, existing: existing ?? [] });
    const now = new Date().toISOString();

    if (plan.create.length > 0) {
      const rows = plan.create.map((c) => ({
        ...c,
        launch_id: id,
        excluded_at: c.status === NA_STATUS ? now : null,
        excluded_by: c.status === NA_STATUS ? memberId : null,
      }));
      const { error } = await supabase.from('launch_tasks').insert(rows);
      if (error) throw error;
    }

    // 계획 열만 덮는다. 상태·담당·막힌 이유·완료 시각은 patch 에 없다
    // (lib/launchReimport.js 의 PLAN_COLUMNS).
    for (const u of plan.update) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({ ...u.patch, updated_at: now })
        .eq('id', u.id);
      if (error) throw error;
    }

    for (const e of plan.exclude) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({
          status: NA_STATUS,
          // 뺄 때의 상태를 사유에 붙여 남긴다. 되살릴 때 '하는 중이었는데'
          // 가 사라지지 않게 하는 유일한 자리다.
          excluded_reason: `${IMPORT_EXCLUDED_REASON} (직전 상태: ${e.previous_status})`,
          excluded_at: now,
          excluded_by: memberId,
          updated_at: now,
        })
        .eq('id', e.id);
      if (error) throw error;
    }

    for (const r of plan.restore) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({
          // 뺄 때의 상태로 돌아간다. '할 것' 으로만 돌리면 "하는 중이었는데"
          // 가 사라진다.
          status: r.status ?? TODO_STATUS,
          excluded_reason: null,
          excluded_at: null,
          excluded_by: null,
          updated_at: now,
        })
        .eq('id', r.id);
      if (error) throw error;
    }

    // 전제 7줄. 항목과 함께 온다.
    const patch = { updated_at: now };
    if (Array.isArray(context) && context.length > 0) {
      patch.context = context
        .filter((c) => String(c?.label ?? '').trim() && String(c?.value ?? '').trim())
        .slice(0, 40)
        .map((c) => ({ label: String(c.label).trim(), value: String(c.value).trim() }));
    }
    if (sourceVersion) patch.note = String(sourceVersion).slice(0, 200);
    await supabase.from('launches').update(patch).eq('id', id);

    return Response.json({
      ok: true,
      created: plan.create.length,
      updated: plan.update.length,
      excluded: plan.exclude,
      restored: plan.restore.length,
      untouched: plan.untouched,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **2단계: 린트와 빌드**

```bash
npx eslint "app/api/launch" && npx next build
```

기대: 오류 없음.

- [ ] **3단계: 커밋**

```bash
git add "app/api/launch/[id]/import/route.js"
git commit -m "feat(launch): 런칭에 엑셀 직접 가져오기 — 준비 상태에서만"
```

---

## Task 9: 항목 추가·삭제·다중 처리 (서버)

**파일**
- 만들기: `app/api/launch/[id]/tasks/route.js`
- 만들기: `app/api/launch/[id]/tasks/bulk/route.js`
- 고치기: `app/api/launch/[id]/tasks/[taskId]/route.js`

- [ ] **1단계: `POST /tasks` 를 쓴다**

`app/api/launch/[id]/tasks/route.js`. `app/api/launch/guides/[id]/items/route.js`
의 POST 와 같은 모양이다 — 코드를 서버가 짓는다.

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { isWorkstream, nextCode } from '@/lib/launchCode';

// 런칭에 항목을 손으로 더한다.
//
// 지금까지 추가는 가이드에만 있었다. 매주 흔들리는 목록에서 그건 뒤집힌
// 구조다 — 회의 중에 빠진 것을 발견하면 그 자리에서 넣어야 한다.
//
// source = 'manual' 이 중요하다. 재가져오기가 안 건드리는 근거이고,
// 나중에 "HOKA 에서 새로 생긴 것"을 뽑아 가이드로 되돌리는 근거다(4단계).
export async function POST(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const body = await request.json();

    const workstream = String(body?.workstream ?? '').trim();
    const title = String(body?.title ?? '').trim();
    const dayOffset = Number(body?.day_offset);
    if (!isWorkstream(workstream)) throw new ApiError(400, '워크스트림을 골라 주세요.');
    if (!title) throw new ApiError(400, '체크 항목을 입력하세요.');
    if (!Number.isFinite(dayOffset)) throw new ApiError(400, 'D-day 를 숫자로 입력하세요.');

    const supabase = getSupabaseAdmin();
    const { data: codes, error: cErr } = await supabase
      .from('launch_tasks')
      .select('code')
      .eq('launch_id', id);
    if (cErr) throw cErr;

    const code = nextCode({ workstream, existingCodes: (codes ?? []).map((c) => c.code) });
    if (!code) throw new ApiError(400, '코드를 지을 수 없습니다.');

    const { data, error } = await supabase
      .from('launch_tasks')
      .insert({
        launch_id: id,
        code,
        workstream,
        title,
        day_offset: Math.trunc(dayOffset),
        category: body?.category || null,
        channel: body?.channel || null,
        decision_org: body?.decision_org || null,
        owner_org: body?.owner_org || null,
        owner_role: body?.owner_role || null,
        support_role: body?.support_role || null,
        depends_on: Array.isArray(body?.depends_on) ? body.depends_on : [],
        deliverable: body?.deliverable || null,
        note: body?.note || null,
        plain_text: body?.plain_text || null,
        is_critical: body?.is_critical === true,
        source: 'manual',
      })
      .select('*')
      .single();
    // 23505 = unique_violation. (launch_id, code) 가 겹쳤다는 뜻이다.
    if (error?.code === '23505') throw new ApiError(409, '같은 코드가 이미 있습니다. 다시 시도해 주세요.');
    if (error) throw error;

    return Response.json({ task: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **2단계: `DELETE` 를 기존 라우트에 더한다**

`app/api/launch/[id]/tasks/[taskId]/route.js` 끝에 붙인다.

```js
// 항목을 지운다.
//
// 해당없음과 다른 일이다. 해당없음은 "이 브랜드에는 안 하는 일"이라 이유가
// 남고 다음 브랜드를 위한 기록이 되지만, 지우기는 잘못 넣은 것을 치우는
// 일이다. 화면에서도 구분선 아래에 둔다.
export async function DELETE(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id, taskId } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('launch_tasks')
      .delete()
      .eq('id', taskId)
      .eq('launch_id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **3단계: `PATCH` 가 해당없음을 받게 한다**

같은 파일의 `PATCH` 에서 상태 분기를 고친다. `LAUNCH_STATUSES` 는 이제
다섯이라 검증은 그대로 통과한다. 아래를 더한다.

```js
import { LAUNCH_STATUSES, DONE_STATUS, BLOCKED_STATUS, NA_STATUS } from '@/lib/launchTask';
```

```js
    if (body.status !== undefined) {
      if (!LAUNCH_STATUSES.includes(body.status)) throw new ApiError(400, '알 수 없는 상태입니다.');

      // 해당없음은 사유가 필수다. 사유 없는 해당없음은 6개월 뒤 아무 말도
      // 못 한다 — 다음 브랜드가 "HOKA는 왜 앱을 뺐지"에 답해야 한다.
      if (body.status === NA_STATUS) {
        const reason = String(body.excludedReason ?? '').trim();
        if (!reason) throw new ApiError(400, '해당없음 사유를 적어 주세요.');
        patch.excluded_reason = reason;
        patch.excluded_at = new Date().toISOString();
        patch.excluded_by = memberId;
      } else {
        patch.excluded_reason = null;
        patch.excluded_at = null;
        patch.excluded_by = null;
      }

      patch.status = body.status;
      patch.done_at = body.status === DONE_STATUS ? new Date().toISOString() : null;
      if (body.status !== BLOCKED_STATUS) patch.blocked_reason = null;
    }
```

`memberId` 를 쓰므로 위쪽을 바꾼다.

```js
    const { memberId } = await requireGlobalAdmin();
```

- [ ] **4단계: `bulk` 라우트를 쓴다**

`app/api/launch/[id]/tasks/bulk/route.js`.

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { NA_STATUS, TODO_STATUS } from '@/lib/launchTask';

// 한 번에 여러 줄.
//
// 앱을 안 하기로 하면 18건이다. 한 줄씩 누르면 18번 클릭에 18번 입력이고,
// 그러면 아무도 안 한다. 엑셀에서는 복붙으로 되는 일이라 이게 없으면
// "차라리 엑셀이 낫다"가 된다.
const MAX = 500;

export async function POST(request, { params }) {
  try {
    const { memberId } = await requireGlobalAdmin();
    const { id } = await params;
    const { taskIds, action, reason } = await request.json();

    const ids = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];
    // .in() 에 빈 배열을 넘기면 PostgREST 가 400 을 낸다.
    if (ids.length === 0) throw new ApiError(400, '고른 항목이 없습니다.');
    if (ids.length > MAX) throw new ApiError(400, '한 번에 처리할 수 있는 양을 넘었습니다.');

    const now = new Date().toISOString();
    let patch;

    if (action === 'not_applicable') {
      const text = String(reason ?? '').trim();
      if (!text) throw new ApiError(400, '해당없음 사유를 적어 주세요.');
      patch = {
        status: NA_STATUS,
        excluded_reason: text,
        excluded_at: now,
        excluded_by: memberId,
        blocked_reason: null,
        done_at: null,
      };
    } else if (action === 'restore') {
      patch = { status: TODO_STATUS, excluded_reason: null, excluded_at: null, excluded_by: null };
    } else {
      throw new ApiError(400, '알 수 없는 동작입니다.');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('launch_tasks')
      .update({ ...patch, updated_at: now })
      .eq('launch_id', id)
      .in('id', ids)
      .select('id');
    if (error) throw error;

    return Response.json({ ok: true, changed: (data ?? []).length });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **5단계: 린트와 빌드**

```bash
npx eslint "app/api/launch" && npx next build
```

- [ ] **6단계: 커밋**

```bash
git add "app/api/launch/[id]/tasks"
git commit -m "feat(launch): 항목 추가·삭제·다중 해당없음 — 사유는 필수"
```

---

## Task 10: 준비/진행 중 전환 (서버)

**파일**
- 고치기: `app/api/launch/[id]/route.js`

- [ ] **1단계: `PATCH` 에 주석과 검증을 더한다**

이미 `status` 를 받고 있다. 바뀌는 것은 규칙을 글로 남기는 것과, `준비` 로
되돌릴 때 진행을 안 지운다는 보장이다.

```js
    if (body.status !== undefined) {
      // 준비 ↔ 진행 중은 엑셀 문의 열쇠다(2.5절).
      //
      // 준비 — 엑셀을 올릴 수 있다. 브랜드와 양식을 두세 번 주고받는 구간.
      // 진행 중 — 문이 닫힌다. 그 뒤로는 모아에서만 관리한다.
      //
      // 되돌릴 수 있어야 한다. "엑셀 한 번 더 올려야 하는데"가 생겼을 때
      // 막히면 사람이 다른 길을 찾는다. 되돌려도 상태·담당·막힌 이유는
      // 그대로 둔다 — 이 update 는 launches 만 건드리므로 저절로 그렇다.
      patch.status = body.status;
    }
```

- [ ] **2단계: 빌드**

```bash
npx next build
```

- [ ] **3단계: 커밋**

```bash
git add "app/api/launch/[id]/route.js"
git commit -m "docs(launch): 준비↔진행 중이 엑셀 문의 열쇠임을 명시"
```

---

## Task 11: `ImportDialog` 를 런칭에서도 쓴다

**파일**
- 고치기: `components/launch/ImportDialog.jsx`

- [ ] **1단계: `target` 을 받게 한다**

지금은 `guideId` 만 받고 가이드 라우트로 보낸다. 런칭에서도 쓰려면 어디로
보낼지를 밖에서 정해야 한다.

props 를 바꾼다: `{ open, target, onClose, onDone }`.
`target` 은 `{ kind: 'guide' | 'launch', id }` 다.

```js
export function ImportDialog({ open, target, onClose, onDone }) {
```

`submit()` 안의 주소와 몸통을 바꾼다.

```js
    const url =
      target.kind === 'launch'
        ? `/api/launch/${target.id}/import`
        : `/api/launch/guides/${target.id}/import`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: preview.items,
        // 역할 사전은 가이드에만 있다. 런칭에 보내도 쓰이지 않는다.
        roles: target.kind === 'guide' ? preview.roles : undefined,
        // 전제는 런칭에만 있다. 가이드는 브랜드가 없어서 전제도 없다.
        context: target.kind === 'launch' ? preview.context : undefined,
        sourceVersion: file?.name ?? null,
      }),
    }).catch(() => null);
```

- [ ] **2단계: 전제를 읽는다**

`read()` 안, `parseWorkbook` 다음에 더한다.

```js
import { parseContext } from '@/lib/launchContext';
```

```js
      // 전제 7줄. 00_개요 에 있고, 항목 시트가 아니라 건너뛴 시트에서 온다.
      const overview = sheets.find((s) => (s.rows ?? []).some((r) =>
        (r ?? []).some((c) => String(c ?? '').trim().startsWith('[제반사항]'))));
      const context = parseContext(overview?.rows ?? []);
```

`setPreview` 에 `context` 를 더한다.

```js
      setPreview({ ...parsed, roles, context, sheetCount: sheets.length });
```

- [ ] **3단계: 안내 문구를 고친다**

읽은 항목이 0건일 때의 문구가 옛 규칙을 말하고 있다.

```js
        setError(
          '읽을 항목이 없습니다. ID · 체크 항목 · D-day 세 열이 있는 머리 행을 가진 시트가 필요합니다.',
        );
```

미리보기 상자에 전제와 해당없음을 더한다.

```jsx
              <p className="text-xs text-slate-500">
                ★ {preview.items.filter((i) => i.is_critical).length} · 선행조건{' '}
                {preview.items.filter((i) => i.depends_on?.length).length} · 해당없음{' '}
                {preview.items.filter((i) => i.not_applicable).length}
              </p>
              {preview.context?.length > 0 && (
                <p className="text-xs text-slate-500">전제 {preview.context.length}줄을 함께 가져옵니다.</p>
              )}
```

- [ ] **4단계: 부르는 자리를 고친다**

`app/launch/guide/page.js` 에서:

```jsx
      <ImportDialog
        open={importOpen}
        target={{ kind: 'guide', id: guide?.id }}
        onClose={() => setImportOpen(false)}
        onDone={(body) => {
          setDone(body);
          setReloadToken((t) => t + 1);
        }}
      />
```

- [ ] **5단계: 린트와 빌드**

```bash
npx eslint components/launch app/launch && npx next build
```

- [ ] **6단계: 커밋**

```bash
git add components/launch/ImportDialog.jsx app/launch/guide/page.js
git commit -m "feat(launch): 가져오기 창을 런칭에서도 쓴다 · 전제를 함께 읽는다"
```

---

## Task 12: 전제 블록 (화면)

**파일**
- 만들기: `components/launch/LaunchContext.jsx`
- 고치기: `app/launch/[id]/page.js`

- [ ] **1단계: 컴포넌트를 쓴다**

```jsx
'use client';

import { useState } from 'react';

// 런칭의 전제.
//
// 00_개요 의 [제반사항] 7줄이다. 451건이 왜 그렇게 생겼는지의 답이 여기
// 있다 — 반년 뒤에 "왜 회원 연동을 안 했지"를 항목에서 찾을 수는 없다.
//
// 기본은 접혀 있다. 매일 볼 것은 아니지만 찾을 때 반드시 있어야 하는 것이다.
//
// props: context [{label, value}]
export function LaunchContext({ context = [] }) {
  const [open, setOpen] = useState(false);
  if (!context || context.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
        <span className="text-sm font-medium text-slate-800">전제</span>
        <span className="text-xs text-slate-400">{context.length}줄</span>
        {!open && (
          <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
            {context.map((c) => c.label).join(' · ')}
          </span>
        )}
      </button>

      {open && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
          {context.map((c) => (
            <div key={c.label} className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-slate-500">{c.label}</dt>
              <dd className="min-w-0 flex-1 text-[13px] text-slate-700">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
```

- [ ] **2단계: 상세 화면에 붙인다**

`app/launch/[id]/page.js` 에서 `launch` 를 받는 select 에 `context` 를 더해야
한다. `app/api/launch/[id]/route.js` 의 GET select 문자열 두 곳에
`, context` 를 더한다.

그리고 화면에서 통계 상자 바로 위에 넣는다.

```jsx
import { LaunchContext } from '@/components/launch/LaunchContext';
```

```jsx
      <LaunchContext context={launch.context} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border ...">
```

- [ ] **3단계: 진척률 표시를 고친다**

분모가 451이 되면 "전체가 몇 건이냐"에 화면이 451이라고 답한다. 파일은
476건이다. 회의에서 "어? 476 아니야?"가 나오지 않게 뺀 개수를 함께 둔다.

```jsx
        <Stat label="완료" value={`${stat.done}/${stat.total}`} sub={`${stat.percent}%`} />
        <Stat label="이번 주" value={stat.thisWeek} />
        <Stat label="지남" value={stat.late} tone={stat.late > 0 ? 'rose' : undefined} />
        <Stat label="막힘" value={stat.blocked} tone={stat.blocked > 0 ? 'amber' : undefined} />
        {stat.notApplicable > 0 && <Stat label="해당없음" value={stat.notApplicable} />}
```

- [ ] **4단계: 린트와 빌드**

```bash
npx eslint components/launch app/launch "app/api/launch" && npx next build
```

- [ ] **5단계: 커밋**

```bash
git add components/launch/LaunchContext.jsx "app/launch/[id]/page.js" "app/api/launch/[id]/route.js"
git commit -m "feat(launch): 전제 7줄을 런칭 화면 맨 위에"
```

---

## Task 13: 보드 — 해당없음 · 다중 선택 · 준비 배너

**파일**
- 만들기: `components/launch/NotApplicableDialog.jsx`
- 고치기: `components/launch/LaunchBoard.jsx`
- 고치기: `app/launch/[id]/page.js`

- [ ] **1단계: 사유 창을 쓴다**

```jsx
'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// 해당없음 사유를 받는다. 필수다.
//
// 컴플라이언스 도구가 통제 항목을 N/A 처리할 때 사유를 강제하는 것과 같은
// 이유다 — 다음 브랜드가 "HOKA는 왜 앱을 뺐지"에 답해야 한다.
//
// 빠른 선택지를 붙이는 이유: 451건에서 자유 입력만 받으면 아무도 안 쓴다.
// 누르면 채워지고 고칠 수 있다.
const QUICK = [
  '이 채널에 입점하지 않음',
  '2차로 미루기로 함',
  '다른 항목에서 관리 (중복)',
  '신규 법인이 아니라 불필요',
];

// props: open, count, title, onClose, onSubmit(reason)
export function NotApplicableDialog({ open, count = 1, title, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function close() {
    onClose();
    setReason('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError('사유를 적어야 저장됩니다.');
      return;
    }
    setSaving(true);
    await onSubmit(text);
    setSaving(false);
    close();
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>해당없음으로 두기</DialogTitle>
          <DialogDescription>
            {count > 1 ? `${count}건을 한 번에 처리합니다.` : title}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="na-reason" className="text-[11.5px] text-slate-500">
            왜 이 브랜드에는 해당이 없나요? <b>필수입니다</b>
          </label>
          <textarea
            id="na-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
            autoFocus
            rows={3}
            placeholder="예: 앱은 오픈 후 2차로 미루기로 함 (9/2 결정)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setReason(q)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] text-slate-600 hover:border-indigo-400 hover:text-indigo-700"
              >
                {q}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? '저장 중...' : '해당없음으로'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **2단계: 보드에 붙인다**

`components/launch/LaunchBoard.jsx` 에서:

1. `BOARD_STATUSES` 를 쓴다 (Task 5 에서 이미 바꿨다)
2. 필터 칩에 `해당없음` 을 더한다
3. 줄마다 체크박스를 둔다. 하나라도 고르면 위에 막대가 뜬다
4. `⋯` 메뉴에 `해당없음으로 두기` 와 `지우기` 를 둔다

체크박스 상태와 다중 처리:

```js
  const [picked, setPicked] = useState(() => new Set());
  const [naOpen, setNaOpen] = useState(null); // null | {ids, title}

  async function bulkNotApplicable(ids, reason) {
    const res = await fetch(`/api/launch/${launch.id}/tasks/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: ids, action: 'not_applicable', reason }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '바꾸지 못했습니다.');
      return;
    }
    setPicked(new Set());
    onReload?.();
  }
```

`onReload` 를 props 에 더한다. 다중 처리는 한 줄만 갈아 끼울 수 없어서
목록을 다시 받아야 한다. `app/launch/[id]/page.js` 에서
`onReload={() => setReloadToken((t) => t + 1)}` 로 넘기고, 그 화면의 로드
effect 가 `reloadToken` 을 의존성에 갖게 한다 (`app/launch/guide/page.js` 와
같은 방식 — effect 밖의 함수를 effect 에서 부르면 lint 가 막는다).

`TaskRow` 에 체크박스를 더한다. 색 점 **앞**에 온다 — 고르는 일이 읽는 일보다
먼저 눈에 닿아야 한다.

```jsx
function TaskRow({ task, tasks, openDate, today, busy, checked, onCheck, onStatus, onMenu }) {
  const tone = taskTone({ task, openDate, today, tasks });
  const na = isNotApplicable(task);
  // ... 그대로

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onCheck(task.id)}
        aria-label={`${task.code} 고르기`}
        className="mt-1 h-3.5 w-3.5 shrink-0"
      />
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_BAR[tone]}`} aria-hidden />
      {/* ... 그대로 */}
```

`TONE_BAR` 에 색을 하나 더한다. 해당없음은 회색이고 취소선이 없다 — 완료와
달라 보여야 한다. 하나는 끝난 것이고 하나는 애초에 안 하는 것이다.

```js
const TONE_BAR = {
  done: 'bg-emerald-400',
  blocked: 'bg-amber-500',
  late: 'bg-rose-500',
  soon: 'bg-indigo-400',
  waiting: 'bg-slate-300',
  na: 'bg-slate-200',
  flat: 'bg-transparent',
};
```

해당없음인 줄의 본문:

```jsx
        <p className={`text-sm ${done ? 'text-slate-400 line-through' : na ? 'text-slate-400' : 'text-slate-800'}`}>
          {task.is_critical && !na && <span className="mr-1 text-amber-500">★</span>}
          <span className="mr-1.5 text-xs tabular-nums text-slate-400">{task.code}</span>
          {task.title}
          {na && (
            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">
              해당없음
            </span>
          )}
        </p>
```

해당없음이면 상태 단추 대신 사유와 되돌리기를 보여준다.

```jsx
      <div className="flex shrink-0 gap-1">
        {na ? (
          <button type="button" onClick={() => onStatus('할 것')} className="...">
            되돌리기
          </button>
        ) : (
          BOARD_STATUSES.map((status) => (/* ... 그대로 */))
        )}
      </div>
```

사유는 `meta` 줄에 둔다.

```jsx
          {na && task.excluded_reason && (
            <span className="text-slate-400">{task.excluded_reason}</span>
          )}
```

`GET /api/launch/[id]` 의 select 에 `excluded_reason` 을 더해야 화면에 온다.
안 더하면 사유가 항상 빈칸이다.

고른 줄이 있을 때 뜨는 막대:

```jsx
      {picked.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm text-indigo-800">{picked.size}건 골랐습니다</span>
          <button
            type="button"
            onClick={() => setNaOpen({ ids: [...picked] })}
            className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50"
          >
            해당없음으로
          </button>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700"
          >
            선택 해제
          </button>
        </div>
      )}
```

- [ ] **3단계: 준비 배너**

`app/launch/[id]/page.js` 에 넣는다. 목업의 그 배너다.

```jsx
      {launch.status === '준비' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>📋</span>
          <div>
            <b>아직 준비 단계입니다.</b> 엑셀로 요건을 정리해 올린 뒤 시작합니다.
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              엑셀에서 가져오기
            </Button>
            <Button type="button" onClick={() => setStatus('진행 중')} className="bg-indigo-600 hover:bg-indigo-700">
              시작하기
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>🚀</span>
          <div>
            <b>진행 중입니다.</b> 이제부터는 모아에서 관리합니다 — 엑셀 문은 닫혔습니다.
          </div>
          <button
            type="button"
            onClick={() => setStatus('준비')}
            className="ml-auto text-xs text-slate-500 underline hover:text-slate-700"
          >
            준비로 되돌리기
          </button>
        </div>
      )}
```

```js
  async function setStatus(next) {
    const res = await fetch(`/api/launch/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '바꾸지 못했습니다.');
      return;
    }
    const body = await res.json();
    setLaunch(body.launch);
  }
```

- [ ] **4단계: 린트와 빌드**

```bash
npx eslint components/launch app/launch && npx next build
```

`react-hooks/set-state-in-effect` 가 나오면 effect 안에서 setState 를 부르는
자리다. effect 안에 async 함수를 두고 `reloadToken` 으로 다시 부르는 방식으로
고친다 (`app/launch/guide/page.js` 가 그렇게 되어 있다).

- [ ] **5단계: 커밋**

```bash
git add components/launch app/launch
git commit -m "feat(launch): 해당없음 사유 창 · 다중 선택 · 준비/진행 배너"
```

---

## Task 14: 전체 확인과 배포

- [ ] **1단계: 전부 돌린다**

```bash
npx vitest run
```

기대: 전부 PASS. 실패하면 Task 5 의 `LAUNCH_STATUSES` 처럼 **의도된 변경인지
먼저 판단하고**, 의도된 것이면 테스트에 이유를 적고 고친다. 아니면 코드가
틀린 것이다.

```bash
npx eslint . && npx next build
```

- [ ] **2단계: 사용자에게 SQL 을 넘긴다**

`supabase/migrations/0032_launch_phase2.sql` 을 실행해 달라고 한다.
**실행 전에 배포하면 화면이 500 을 낸다** — 새 컬럼을 select 하기 때문이다.
순서를 분명히 말한다: **SQL 먼저, 배포 나중.**

- [ ] **3단계: ZIP 을 만든다**

```bash
npm run package:src
```

`npm run package` 가 아니다. 배포 플랫폼이 소스에서 다시 빌드한다.

- [ ] **4단계: 실제 파일로 확인해 달라고 한다**

배포 뒤에 사용자가 할 일을 적어 준다.

1. `/launch` 에서 HOKA 런칭을 만든다 (준비 상태)
2. `온라인_오픈WBS_통합_260902(1).xlsx` 를 올린다
3. 미리보기에서 확인할 것 — **읽은 시트 19 · 건너뛴 시트 3**(`00_개요` ·
   `01_WBS` · `02_간트`) · **항목 476** · **해당없음 25** · **전제 7줄**
4. 반영한 뒤 `07B-01` · `10A-03` · `10B-01` 이 실제로 보드에 있는지
5. 진척률 분모가 **451** 인지 (476 아님)
6. 같은 파일을 **한 번 더** 올려서 `새로 0 · 갱신 476` 이 나오는지

6번이 이 계획 전체의 시험이다. 재가져오기가 안전하지 않으면 아무도 두 번
안 올린다.

---

## 다음 계획

이 계획은 **2-0** 만 덮는다. 나머지 둘은 각자 계획 문서를 갖는다.

| | 무엇 | 스펙 |
|---|---|---|
| **2-1** | 결정 대기 14건 · 막힘↔결정 연결 · 주간 진척 | 5·6절 |
| **2-2** | 양식 내보내기 (ExcelJS · `00_먼저 볼 것` 57줄) | 7절 |

마이그레이션 0032 가 2-1 의 테이블(`launch_decisions`)과 컬럼
(`blocked_decision_id`)까지 이미 만든다. 2-1 은 SQL 없이 시작한다.

---

## 되짚어 볼 위험

| 무엇 | 왜 | 어떻게 |
|---|---|---|
| `isTaskSheet` 시그니처 변경 | 부르는 자리가 셋(파서 둘 + 테스트) | Task 2 에서 한 번에 |
| `LAUNCH_STATUSES` 가 다섯 | 화면이 단추를 다섯 개 그린다 | `BOARD_STATUSES` 를 따로 둔다 |
| 파생 시트가 머리 행을 우연히 가짐 | 원본을 덮을 수 있다 | 미리보기에 시트 이름·건수를 보여 사람이 알아채게 |
| SQL 전에 배포 | 새 컬럼 select 로 500 | Task 14 에서 순서를 못 박는다 |
| `update` 를 줄마다 도는 것 | 476건이면 476번 왕복 | 2-0 은 그대로 둔다. 준비 단계에서 몇 번 하는 일이고, 느리면 그때 묶는다 |
