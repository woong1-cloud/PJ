# UX 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 요구사항 상태 체계를 재정의하고, 배포예상일·브랜드 전환기·목록 검색을 추가해 화면 완성도를 지라 수준으로 끌어올린다.

**Architecture:** 기존 Next.js App Router + Supabase 구조를 유지한다. 상태값은 `lib/statuses.js` 단일 출처에서만 정의하고, 지금 흩어져 있는 하드코딩 문자열을 전부 상수 참조로 바꾼다. 새 순수 함수(`isOverdue`, `sortRequirements`)는 TDD로 만든다.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui(base-ui), Supabase(Postgres+Auth), Vitest

**설계 문서:** `docs/superpowers/specs/2026-07-29-ux-redesign-design.md`

**작업 위치:** `C:\Users\han_jiwoong\Desktop\agent\.worktrees\ux-redesign\pj` (브랜치 `feature/ux-redesign`, 베이스라인 73 테스트 통과 확인됨)

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `supabase/migrations/0007_status_rename_and_dates.sql` | 상태값 변환 + 예상일 컬럼 | 신규 |
| `lib/statuses.js` | 상태 단일 출처 | 수정 |
| `lib/overdue.js` + `.test.js` | 지연 판정 | 신규 |
| `lib/sortRequirements.js` + `.test.js` | 목록 정렬 | 신규 |
| `lib/statusGuide.js` | 상태 설명 데이터(가이드+툴팁 공용) | 신규 |
| `app/api/requirements/route.js` | 검색·정렬·완료숨김·기본값 | 수정 |
| `app/api/requirements/[id]/expected-date/route.js` | 예상일 변경 | 신규 |
| `app/api/team-members/route.js` | `hasAccount` 노출 | 수정 |
| `components/RequirementList.jsx` | 목록 테이블 개편 | 수정 |
| `components/FilterBar.jsx` | 검색 + 완료숨김 | 수정 |
| `components/BrandSwitcher.jsx` | 브랜드 전환 | 신규 |
| `components/TopBar.jsx` | 메뉴 재편 | 수정 |
| `components/StatusGuide.jsx` | 상태 가이드 섹션 | 신규 |
| `lib/identity.js` | `switchBrand` 헬퍼 | 수정 |

---

## UX-Task 1: 마이그레이션 0007 (상태 변환 + 예상일 컬럼)

**Files:**
- Create: `pj/supabase/migrations/0007_status_rename_and_dates.sql`

이 마이그레이션은 사용자가 Supabase SQL Editor에서 직접 실행한다. 파일만 만들고 실행은 마지막 검증 단계에서 요청한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 0007: 요구사항 상태 이름 재정의 + 배포예상일 추가
--
-- 상태 이름에 "누구 차례인지"가 드러나게 바꾼다. '검토'와 '정책정의'는
-- 둘 다 IT가 들고 있는 단계라 '검토중' 하나로 합친다.
--
-- ⚠️ 주의: project_brands.status 에도 '진행중' 이 있다(전개 상태).
--    아래 UPDATE 는 반드시 requirements 테이블만 대상으로 한다.

-- 1) 제약을 먼저 없애야 데이터를 바꿀 수 있다
alter table requirements drop constraint if exists requirements_status_check;

-- 2) 데이터 변환
update requirements set status = '작성중'   where status = '대기';
update requirements set status = '검토대기' where status = '요청';
update requirements set status = '검토중'   where status in ('검토', '정책정의');
update requirements set status = '개발중'   where status = '진행중';

-- 3) 기본값도 함께 바꾼다 (0001_init.sql 에서 '대기' 로 설정돼 있다)
alter table requirements alter column status set default '작성중';

-- 4) 새 제약
alter table requirements add constraint requirements_status_check
  check (status in ('작성중','검토대기','검토중','개발중','완료','중복'));

-- 5) 배포예상일 — IT(3차 이상)만 입력한다. 앱 레벨에서 통제한다.
alter table requirements add column if not exists expected_release_date date;

-- 검증용: 변환 후 남아 있는 옛 상태가 없어야 한다 (0건이어야 정상)
-- select status, count(*) from requirements
--   where status in ('대기','요청','검토','정책정의','진행중') group by status;
```

- [ ] **Step 2: 커밋**

```bash
git add pj/supabase/migrations/0007_status_rename_and_dates.sql
git commit -m "feat: 상태 이름 재정의 + 배포예상일 마이그레이션"
```

---

## UX-Task 2: lib/statuses.js 갱신

**Files:**
- Modify: `pj/lib/statuses.js`

- [ ] **Step 1: 전체 내용 교체**

```js
// 요구사항 상태 단일 출처. '중복'은 병합 전용(직접 전환 불가).
//
// 이름은 "누구 차례인지"가 드러나게 지었다. '작성중'은 브랜드가 아직 제출하지
// 않은 초안이고, '검토대기'는 제출됐지만 IT가 아직 손대지 않은 상태다.
export const REQUIREMENT_STATUSES = ['작성중', '검토대기', '검토중', '개발중', '완료', '중복'];

// 보드 컬럼(중복 제외, 왼쪽→오른쪽 순서).
export const BOARD_STATUSES = ['작성중', '검토대기', '검토중', '개발중', '완료'];

export const MERGED_STATUS = '중복';
export const DONE_STATUS = '완료';
// 새 요구사항의 최초 상태. DB default 와 반드시 일치해야 한다(0007 마이그레이션).
export const INITIAL_STATUS = '작성중';
```

- [ ] **Step 2: 테스트 실행 — 이 시점에 깨지는 것이 정상**

```bash
npm test -- --run
```

기존 테스트가 옛 상태 문자열을 쓰므로 실패한다. UX-Task 3에서 고친다.

- [ ] **Step 3: 커밋**

```bash
git add pj/lib/statuses.js
git commit -m "feat: 상태 상수를 새 이름으로 교체"
```

---

## UX-Task 3: 하드코딩된 상태 문자열 제거

**Files:**
- Modify: `pj/app/api/requirements/route.js:92`
- Modify: `pj/components/KanbanBoard.jsx:23,73`
- Modify: `pj/components/RequirementCard.jsx:40`
- Modify: `pj/components/MergeDialog.jsx:36`
- Modify: `pj/components/RequirementList.jsx:4-13,28,57,86`
- Modify: `pj/lib/completedAt.test.js`, `pj/lib/dashboardStats.test.js`, `pj/lib/merge.test.js`, `pj/lib/projectProgress.test.js`

**⚠️ 절대 건드리지 말 것:** `lib/projectStatuses.js`, `app/projects/page.js`, `components/ProjectBrandsSection.jsx`, `app/admin/dashboard/page.js`의 `진행중`/`적용완료`. 이들은 **프로젝트 전개 상태**로 완전히 다른 값이다. `'완료'`는 `'적용완료'`·`'미완료'`의 부분 문자열이므로 정규식 일괄 치환을 쓰지 말고 따옴표로 감싼 완전한 리터럴만 손으로 바꾼다.

- [ ] **Step 1: 요구사항 생성 기본 상태를 상수로**

`app/api/requirements/route.js` — import에 `INITIAL_STATUS` 추가:

```js
import { INITIAL_STATUS } from '@/lib/statuses';
```

92번째 줄 `status: '대기',` 를 다음으로 교체:

```js
        status: INITIAL_STATUS,
```

> 이 한 줄이 가장 위험하다. 옛 값이 그대로면 새 CHECK 제약에 걸려 등록이 500으로 실패한다.

- [ ] **Step 2: KanbanBoard의 '대기' 참조 교체**

`components/KanbanBoard.jsx` — import에 `INITIAL_STATUS` 추가한 뒤, 23번째 줄과 73번째 줄의 `'대기'`를 `INITIAL_STATUS`로 바꾼다.

23행 부근(컬럼 뱃지):
```js
        {status === INITIAL_STATUS && (
```

73행 부근(정렬 방향 — 작성중만 오래된 것부터):
```js
      const oldestFirst = s === INITIAL_STATUS;
```

- [ ] **Step 3: '완료'·'중복' 리터럴 교체**

각 파일에서 해당 리터럴을 상수로 바꾼다. 이미 `@/lib/statuses`를 import하는 파일은 이름만 추가한다.

- `components/RequirementCard.jsx:40` — `req.status === '완료'` → `req.status === DONE_STATUS`
- `components/MergeDialog.jsx:36` — `r.status !== '중복'` → `r.status !== MERGED_STATUS`
- `components/RequirementList.jsx:28,57,86` — `req.status === '중복'` → `req.status === MERGED_STATUS`

- [ ] **Step 4: STATUS_STYLES 맵 교체**

`components/RequirementList.jsx` 4-13행을 통째로 교체한다.

```js
// 상태를 3덩어리로 읽히게 한다 — 제출 전(회색 테두리) / IT가 봐야 함(앰버) /
// IT 진행 중(남색) / 완료(초록). '검토대기'만 앰버인 것이 핵심이다.
const STATUS_STYLES = {
  작성중: 'border border-slate-300 text-slate-500',
  검토대기: 'bg-amber-50 text-amber-700',
  검토중: 'bg-indigo-50 text-indigo-700',
  개발중: 'bg-indigo-50 text-indigo-700',
  완료: 'bg-emerald-50 text-emerald-700',
  중복: 'bg-slate-100 text-slate-400 line-through',
};
const DEFAULT_STATUS_STYLE = 'bg-slate-100 text-slate-600';
```

> `??` 폴백 때문에 키를 틀려도 예외가 안 나고 뱃지만 전부 회색이 된다. 브라우저 검증에서 색을 눈으로 확인할 것.

- [ ] **Step 5: 테스트 픽스처의 상태 문자열 갱신**

네 파일에서 **요구사항 상태**만 새 이름으로 바꾼다.

- `lib/completedAt.test.js` — 대기→작성중, 진행중→개발중, 완료 유지
- `lib/dashboardStats.test.js` — 픽스처의 `status:` 필드
- `lib/merge.test.js` — `sourceStatus`/`targetStatus`
- `lib/projectProgress.test.js` — **혼합 파일이다.** `requirements` 배열 안의 `status`만 바꾸고, `projectBrands` 배열의 `전개예정`/`진행중`/`적용완료`는 그대로 둔다.

- [ ] **Step 6: 테스트 통과 확인**

```bash
npm test -- --run
```
Expected: 73 passed

- [ ] **Step 7: 옛 문자열이 남아 있지 않은지 확인**

```bash
grep -rn "'대기'\|'요청'\|'정책정의'" app/ components/ lib/ --include=*.js --include=*.jsx
```
Expected: 주석 외에는 결과 없음. `'검토'`는 `'검토대기'`·`'검토중'`의 부분 문자열이라 별도 확인이 필요하니 눈으로 본다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor: 하드코딩된 상태 문자열을 상수 참조로 교체"
```

---

## UX-Task 4: isOverdue 순수 함수 (TDD)

**Files:**
- Create: `pj/lib/overdue.js`
- Test: `pj/lib/overdue.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { isOverdue } from './overdue';

describe('isOverdue', () => {
  const TODAY = '2026-07-29';

  it('예상일이 없으면 지연이 아니다', () => {
    expect(isOverdue(null, '개발중', TODAY)).toBe(false);
  });

  it('예상일이 미래면 지연이 아니다', () => {
    expect(isOverdue('2026-08-14', '개발중', TODAY)).toBe(false);
  });

  it('예상일이 오늘이면 아직 지연이 아니다', () => {
    expect(isOverdue(TODAY, '개발중', TODAY)).toBe(false);
  });

  it('예상일이 지났고 미완료면 지연이다', () => {
    expect(isOverdue('2026-07-25', '개발중', TODAY)).toBe(true);
  });

  it('완료된 건은 예상일이 지났어도 지연이 아니다', () => {
    expect(isOverdue('2026-07-25', '완료', TODAY)).toBe(false);
  });

  it('병합된 건은 예상일이 지났어도 지연이 아니다', () => {
    expect(isOverdue('2026-07-25', '중복', TODAY)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- --run lib/overdue.test.js
```
Expected: FAIL — `isOverdue` is not defined

- [ ] **Step 3: 구현**

```js
import { DONE_STATUS, MERGED_STATUS } from './statuses';

// 날짜는 'YYYY-MM-DD' 문자열이다. 이 형식은 사전순 비교가 곧 날짜순 비교라
// Date 객체로 바꾸지 않는다 — 시간대 때문에 하루가 밀리는 사고를 피할 수 있다.
export function isOverdue(expectedDate, status, todayIso) {
  if (!expectedDate) return false;
  if (status === DONE_STATUS || status === MERGED_STATUS) return false;
  return expectedDate < todayIso;
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- --run lib/overdue.test.js
```
Expected: 6 passed

- [ ] **Step 5: 커밋**

```bash
git add pj/lib/overdue.js pj/lib/overdue.test.js
git commit -m "feat: 배포예상일 지연 판정 순수 함수"
```

---

## UX-Task 5: sortRequirements 순수 함수 (TDD)

**Files:**
- Create: `pj/lib/sortRequirements.js`
- Test: `pj/lib/sortRequirements.test.js`

우선순위는 `상 > 중 > 하` 순서라 사전순이 맞지 않는다. 정렬은 클라이언트에서 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { sortRequirements } from './sortRequirements';

const rows = [
  { id: 'a', request_date: '2026-07-20', priority: '중', status: '개발중', expected_release_date: '2026-08-01' },
  { id: 'b', request_date: '2026-07-25', priority: '상', status: '작성중', expected_release_date: null },
  { id: 'c', request_date: '2026-07-22', priority: '하', status: '완료', expected_release_date: '2026-07-10' },
];
const ids = (list) => list.map((r) => r.id);

describe('sortRequirements', () => {
  it('요청일 내림차순이 기본이다', () => {
    expect(ids(sortRequirements(rows, 'request_date', 'desc'))).toEqual(['b', 'c', 'a']);
  });

  it('요청일 오름차순', () => {
    expect(ids(sortRequirements(rows, 'request_date', 'asc'))).toEqual(['a', 'c', 'b']);
  });

  it('우선순위는 상>중>하 순서다 (사전순이 아니다)', () => {
    expect(ids(sortRequirements(rows, 'priority', 'asc'))).toEqual(['b', 'a', 'c']);
  });

  it('우선순위 내림차순은 하>중>상', () => {
    expect(ids(sortRequirements(rows, 'priority', 'desc'))).toEqual(['c', 'a', 'b']);
  });

  it('상태는 진행 순서대로 정렬한다 (사전순이 아니다)', () => {
    expect(ids(sortRequirements(rows, 'status', 'asc'))).toEqual(['b', 'a', 'c']);
  });

  it('예상일이 없는 행은 항상 뒤로 보낸다', () => {
    expect(ids(sortRequirements(rows, 'expected_release_date', 'asc'))).toEqual(['c', 'a', 'b']);
  });

  it('예상일 내림차순에서도 빈 값은 뒤에 남는다', () => {
    expect(ids(sortRequirements(rows, 'expected_release_date', 'desc'))).toEqual(['a', 'c', 'b']);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const before = ids(rows);
    sortRequirements(rows, 'priority', 'asc');
    expect(ids(rows)).toEqual(before);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- --run lib/sortRequirements.test.js
```
Expected: FAIL

- [ ] **Step 3: 구현**

```js
import { BOARD_STATUSES, MERGED_STATUS } from './statuses';

const PRIORITY_RANK = { 상: 0, 중: 1, 하: 2 };
// 보드 순서를 그대로 쓰고, 병합된 건은 항상 맨 뒤에 둔다.
const STATUS_RANK = Object.fromEntries(BOARD_STATUSES.map((s, i) => [s, i]));
STATUS_RANK[MERGED_STATUS] = BOARD_STATUSES.length;

function rankOf(row, key) {
  if (key === 'priority') return PRIORITY_RANK[row.priority] ?? 99;
  if (key === 'status') return STATUS_RANK[row.status] ?? 99;
  return null;
}

export function sortRequirements(rows, key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ra = rankOf(a, key);
    if (ra !== null) return (ra - rankOf(b, key)) * sign;

    // 날짜 계열. 빈 값은 정렬 방향과 무관하게 항상 뒤로 보낸다 —
    // "예상일 순으로 보고 싶다"는 요구에 빈 행이 먼저 나오면 쓸모가 없다.
    const va = a[key] ?? '';
    const vb = b[key] ?? '';
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return va < vb ? -sign : va > vb ? sign : 0;
  });
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- --run lib/sortRequirements.test.js
```
Expected: 8 passed

- [ ] **Step 5: 커밋**

```bash
git add pj/lib/sortRequirements.js pj/lib/sortRequirements.test.js
git commit -m "feat: 목록 정렬 순수 함수 (우선순위·상태는 의미 순서)"
```

---

## UX-Task 6: 목록 API 확장

**Files:**
- Modify: `pj/app/api/requirements/route.js`

- [ ] **Step 1: GET에 검색·완료숨김 추가**

`GET` 핸들러에서 파라미터를 읽는 부분에 추가:

```js
    const q = searchParams.get('q');
    const includeDone = searchParams.get('includeDone') === 'true';
```

`select` 문자열의 첫 줄에 두 컬럼을 추가한다:

```js
        'id, priority, urgency, request_date, status, title, is_confidential, sprint_tag, duplicate_count, ' +
          'completed_at, expected_release_date, ' +
```

기존 필터 블록 아래에 추가:

```js
    if (q && q.trim()) query = query.ilike('title', `%${q.trim()}%`);
    // 완료·중복은 기본으로 숨긴다. 지금은 끝난 건이 목록 상단을 차지한다.
    if (!includeDone) query = query.not('status', 'in', `(${DONE_STATUS},${MERGED_STATUS})`);
```

import에 `DONE_STATUS, MERGED_STATUS`를 추가한다(`INITIAL_STATUS`는 UX-Task 3에서 이미 추가됨).

- [ ] **Step 2: POST에 우선순위 기본값**

`insert` 객체에서 `priority` 줄을 교체:

```js
        // 참고용 필드지만 비어 있으면 목록에서 노이즈가 된다. 기본값을 준다.
        priority: priority || '중',
```

- [ ] **Step 3: 검증**

```bash
npm run lint && npm test -- --run
```
Expected: lint 통과(기존 `<img>` 경고 2건은 무관), 73 passed

- [ ] **Step 4: 커밋**

```bash
git add pj/app/api/requirements/route.js
git commit -m "feat: 목록 API 검색·완료숨김 + 우선순위 기본값"
```

---

## UX-Task 7: 배포예상일 API

**Files:**
- Create: `pj/app/api/requirements/[id]/expected-date/route.js`

- [ ] **Step 1: 라우트 작성**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId, expectedReleaseDate } = body;
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (expectedReleaseDate !== null && !DATE_PATTERN.test(expectedReleaseDate ?? '')) {
      throw new ApiError(400, '날짜 형식이 올바르지 않습니다.');
    }

    // 배포예상일은 IT가 정한다. 요청한 쪽이 희망일을 적으면 의미가 없어진다.
    const { memberId } = await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, expected_release_date')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    const nowIso = new Date().toISOString();
    const { error: updError } = await supabase
      .from('requirements')
      .update({ expected_release_date: expectedReleaseDate, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    // 날짜가 밀리는 것 자체가 추적할 가치가 있는 정보다.
    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '예상일변경',
      field_name: 'expected_release_date',
      old_value: current.expected_release_date,
      new_value: expectedReleaseDate,
    });
    if (logError) throw logError;

    return Response.json({ ok: true, expectedReleaseDate });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 상세 API가 예상일을 내려주는지 확인**

`app/api/requirements/[id]/route.js`의 `select`에 `expected_release_date`가 없으면 추가한다.

- [ ] **Step 3: 검증 후 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: 배포예상일 변경 API (3차 이상)"
```

---

## UX-Task 8: RequirementList 개편

**Files:**
- Modify: `pj/components/RequirementList.jsx`

UX-Task 3에서 `STATUS_STYLES`와 `중복` 참조는 이미 고쳤다. 여기서는 컬럼 구성과 날짜 표시를 바꾼다.

- [ ] **Step 1: 날짜 셀 컴포넌트 추가**

파일 상단(`Meta` 함수 아래)에 추가:

```js
const PRIORITY_STYLES = { 상: 'text-rose-600', 중: 'text-amber-600', 하: 'text-slate-400' };

// 미완료면 예상일, 완료면 완료일. 두 컬럼으로 나누면 대부분 빈칸이 된다.
function DateCell({ req, today }) {
  if (req.status === DONE_STATUS && req.completed_at) {
    return <span className="text-slate-500">{req.completed_at.slice(5, 10)} 완료</span>;
  }
  if (!req.expected_release_date) return <span className="text-slate-400">—</span>;
  const short = req.expected_release_date.slice(5);
  if (isOverdue(req.expected_release_date, req.status, today)) {
    return <span className="font-medium text-rose-600">⚠ {short} 지연</span>;
  }
  return <span className="text-slate-500">{short} 예정</span>;
}
```

import에 추가:
```js
import { DONE_STATUS, MERGED_STATUS } from '@/lib/statuses';
import { isOverdue } from '@/lib/overdue';
```

- [ ] **Step 2: 데스크톱 테이블 헤더 교체**

`요청일`을 빼고 `담당자`와 `예상·완료`를 넣는다. 정렬 가능한 헤더는 클릭 핸들러를 받는다.

```jsx
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <SortableTh label="상태" sortKey="status" sort={sort} onSort={onSort} className="w-24" />
              <th className="px-3 py-2">제목</th>
              <th className="px-3 py-2 w-28">카테고리</th>
              <SortableTh label="우선" sortKey="priority" sort={sort} onSort={onSort} className="w-16" />
              <th className="px-3 py-2 w-20">담당자</th>
              <SortableTh label="예상·완료" sortKey="expected_release_date" sort={sort} onSort={onSort} className="w-28" />
            </tr>
          </thead>
```

- [ ] **Step 3: SortableTh 컴포넌트 추가**

```jsx
function SortableTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort?.key === sortKey;
  return (
    <th className={`px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <span className={active ? 'text-slate-900' : 'text-slate-300'}>
          {active && sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}
```

- [ ] **Step 4: 본문 행 교체**

```jsx
              <tr
                key={req.id}
                className={`border-t border-slate-200 hover:bg-slate-50 ${
                  req.status === MERGED_STATUS ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-2"><StatusBadge status={req.status} /></td>
                <td className="max-w-0 px-3 py-2 text-slate-900">
                  <Link
                    href={`/requirements/${req.id}`}
                    className="block truncate hover:underline"
                    title={req.title}
                  >
                    {req.title}
                  </Link>
                  <Meta req={req} />
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {req.category?.category_name ?? '미분류'}
                </td>
                <td className={`px-3 py-2 ${PRIORITY_STYLES[req.priority] ?? 'text-slate-400'}`}>
                  {req.priority ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">{req.assignee?.name ?? '—'}</td>
                <td className="px-3 py-2 text-xs"><DateCell req={req} today={today} /></td>
              </tr>
```

`max-w-0` + `truncate` 조합이 제목 컬럼을 남은 폭에 맞춰 말줄임 처리한다.

- [ ] **Step 5: 컴포넌트 시그니처 변경**

```jsx
export function RequirementList({ requirements, sort, onSort, today }) {
```

모바일 카드 뷰에도 `<DateCell req={req} today={today} />`를 담당자 옆에 추가한다.

- [ ] **Step 6: 검증 후 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: 목록 컬럼 개편 — 담당자·예상일 추가, 정렬 헤더, 밀도 개선"
```

---

## UX-Task 9: FilterBar 검색 + 완료 숨김

**Files:**
- Modify: `pj/components/FilterBar.jsx`

- [ ] **Step 1: 검색 입력과 토글 추가**

`FilterBar`의 props에 `query`, `onQueryChange`, `includeDone`, `onIncludeDoneChange`를 추가하고, 반환 JSX 맨 앞에 검색 입력을, 맨 뒤에 토글을 넣는다.

```jsx
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="제목 검색"
        className="h-8 w-48 rounded-lg border border-slate-300 px-3 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
      />
```

초기화 버튼 앞에:

```jsx
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={!includeDone}
          onChange={(e) => onIncludeDoneChange(!e.target.checked)}
          className="h-3.5 w-3.5 accent-indigo-600"
        />
        완료 숨김
      </label>
```

체크박스가 `!includeDone`을 표시하는 것에 주의한다 — 라벨이 "완료 숨김"이므로 체크됨 = 숨김 = `includeDone === false`다.

- [ ] **Step 2: 초기화 버튼 조건에 검색어 포함**

```jsx
      {(value.assignee || value.category || value.priority || value.project || query) && (
```

초기화 시 `onQueryChange('')`도 함께 호출한다.

- [ ] **Step 3: 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: 목록 필터바에 제목 검색과 완료 숨김 토글"
```

---

## UX-Task 10: 목록 페이지 통합

**Files:**
- Modify: `pj/app/requirements/page.js`

- [ ] **Step 1: 상태 추가**

```js
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [includeDone, setIncludeDone] = useState(false);
  const [sort, setSort] = useState({ key: 'request_date', dir: 'desc' });
  // 오늘 날짜는 렌더마다 새로 만들면 불필요한 재계산이 생기므로 한 번만 잡는다.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
```

- [ ] **Step 2: 검색어 디바운스**

```js
  // 타이핑마다 조회하면 요청이 쏟아진다. 300ms 멈춘 뒤에만 보낸다.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
```

- [ ] **Step 3: 조회 키와 파라미터에 반영**

`currentKey`에 `debouncedQuery`, `includeDone`을 추가하고, 조회 effect의 파라미터에 추가한다:

```js
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    if (includeDone) params.set('includeDone', 'true');
```

effect 의존성 배열에 `debouncedQuery`, `includeDone`을 추가한다.

- [ ] **Step 4: 정렬 적용**

```js
  const sortedRequirements = useMemo(
    () => sortRequirements(requirements, sort.key, sort.dir),
    [requirements, sort],
  );

  function handleSort(key) {
    // 같은 컬럼을 다시 누르면 방향만 뒤집는다.
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    );
  }
```

import에 `useMemo`와 `sortRequirements`를 추가한다.

- [ ] **Step 5: 자식 컴포넌트에 전달**

```jsx
      <FilterBar
        teamMembers={teamMembers}
        categories={categories}
        projects={projects}
        value={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        query={query}
        onQueryChange={setQuery}
        includeDone={includeDone}
        onIncludeDoneChange={setIncludeDone}
      />
```

```jsx
        <RequirementList
          requirements={sortedRequirements}
          sort={sort}
          onSort={handleSort}
          today={today}
        />
```

- [ ] **Step 6: 검증 후 커밋**

```bash
npm run lint && npm test -- --run && git add -A
git commit -m "feat: 목록 페이지에 검색·정렬·완료숨김 통합"
```

---

## UX-Task 11: 브랜드 전환 헬퍼 + BrandSwitcher

**Files:**
- Modify: `pj/lib/identity.js`
- Create: `pj/components/BrandSwitcher.jsx`

- [ ] **Step 1: identity에 switchBrand 추가**

`lib/identity.js` 끝에:

```js
// 브랜드를 바꿀 때 tier 도 반드시 함께 바꾼다. 등급은 브랜드마다 다르다 —
// 스파오에서 2차인 사람이 미쏘에서는 4차일 수 있다. brandId 만 갈아끼우면
// 권한이 잘못 계산된다.
export function switchBrand(identity, brandId, tier) {
  saveIdentity({ ...identity, brandId, tier });
}
```

- [ ] **Step 2: BrandSwitcher 작성**

```jsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from './IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { switchBrand } from '@/lib/identity';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function BrandSwitcher() {
  const { identity } = useIdentity();
  const router = useRouter();
  const globalAdmin = isGlobalAdmin(identity);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    // 전체관리자는 모든 브랜드를 오갈 수 있어야 하므로 별도 목록을 쓴다.
    const url = globalAdmin ? '/api/brands' : '/api/my-brands';
    fetch(url)
      .then((res) => res.json())
      .then((d) => {
        const list = globalAdmin ? (d.brands ?? []).filter((b) => b.is_active) : (d.brands ?? []);
        setBrands(list);
      })
      .catch(() => {});
  }, [globalAdmin]);

  const current = brands.find((b) => b.id === identity.brandId);

  function handlePick(brandId) {
    if (brandId === identity.brandId) return;
    const picked = brands.find((b) => b.id === brandId);
    if (!picked) return;
    // 전체관리자는 어느 브랜드에서든 1차로 동작한다. 그 외에는 배치된 등급을 쓴다.
    switchBrand(identity, brandId, globalAdmin ? '1차' : picked.tier);
    router.refresh();
    window.location.reload();
  }

  // 오갈 곳이 없으면 드롭다운을 띄울 이유가 없다.
  if (brands.length <= 1) {
    return (
      <span className="text-sm font-medium text-slate-900">
        {current?.name ?? identity.brandName ?? ''}
      </span>
    );
  }

  const items = brands.map((b) => ({ value: b.id, label: b.name }));
  return (
    <Select items={items} value={identity.brandId} onValueChange={handlePick}>
      <SelectTrigger className="h-8 w-36 text-sm font-medium">
        <SelectValue placeholder="브랜드" />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

> `window.location.reload()`를 쓰는 이유: identity가 localStorage에 있고 `IdentityProvider`가 이를 구독하지 않는다(주석 참조). 전체 새로고침이 가장 확실하며, 브랜드 전환은 드문 동작이라 비용이 문제되지 않는다.

- [ ] **Step 3: 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: 브랜드 전환기 — tier 를 함께 갱신한다"
```

---

## UX-Task 12: TopBar 재편

**Files:**
- Modify: `pj/components/TopBar.jsx`

- [ ] **Step 1: 전체 교체**

```jsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useIdentity } from './IdentityProvider';
import { BrandSwitcher } from './BrandSwitcher';
import { canManageBrand, isGlobalAdmin } from '@/lib/tiers';

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`border-b-2 pb-1 text-sm transition-colors ${
        active
          ? 'border-indigo-600 font-medium text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </Link>
  );
}

export function TopBar() {
  const { identity, logout } = useIdentity();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const manageBrand = canManageBrand(identity);
  const globalAdmin = isGlobalAdmin(identity);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-5">
        <BrandSwitcher />
        <span className="h-4 w-px bg-slate-200" />
        {/* 업무 메뉴는 셋뿐이다. 목록/보드는 페이지 안의 뷰 토글로 흡수했다. */}
        <NavLink href="/requirements" active={pathname.startsWith('/requirements')}>
          요구사항
        </NavLink>
        <NavLink href="/projects" active={pathname.startsWith('/projects')}>
          프로젝트
        </NavLink>
        {globalAdmin && (
          <NavLink href="/admin/dashboard" active={pathname.startsWith('/admin/dashboard')}>
            대시보드
          </NavLink>
        )}
      </div>

      <div className="relative flex items-center gap-3">
        <span className="text-sm text-slate-500">{identity.name}</span>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          aria-label="계정 메뉴"
        >
          {identity.name?.[0] ?? '?'}
        </button>
        {menuOpen && (
          <>
            {/* 바깥을 누르면 닫힌다 */}
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
              aria-label="메뉴 닫기"
            />
            <div className="absolute right-0 top-9 z-20 flex w-44 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {identity.isGlobalAdmin && (
                <span className="px-3 py-1.5 text-xs text-indigo-700">전체 관리자</span>
              )}
              {manageBrand && (
                <MenuLink href="/requirements/settings" onClick={() => setMenuOpen(false)}>
                  설정
                </MenuLink>
              )}
              {globalAdmin && (
                <MenuLink href="/admin/brands" onClick={() => setMenuOpen(false)}>
                  브랜드 관리
                </MenuLink>
              )}
              <MenuLink href="/change-password" onClick={() => setMenuOpen(false)}>
                비밀번호 변경
              </MenuLink>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function MenuLink({ href, onClick, children }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}
```

`보드` 링크가 사라진 것이 의도된 변경이다. 목록 페이지의 `보드` 버튼은 그대로 둔다.

- [ ] **Step 2: 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: TopBar 재편 — 브랜드 전환기, active 표시, 관리 메뉴 드롭다운"
```

---

## UX-Task 13: 대시보드 브랜드 이동을 헬퍼로 통일

**Files:**
- Modify: `pj/app/admin/dashboard/page.js`

- [ ] **Step 1: goToBrand 교체**

```js
  function goToBrand(brandId) {
    // 전체관리자 전용 화면이라 1차가 맞다. 판단 근거를 헬퍼에 몰아둔다.
    switchBrand(identity, brandId, '1차');
    router.push('/requirements');
  }
```

import에서 `saveIdentity`를 `switchBrand`로 바꾼다.

- [ ] **Step 2: 커밋**

```bash
npm run lint && git add -A && git commit -m "refactor: 대시보드 브랜드 이동을 switchBrand 헬퍼로"
```

---

## UX-Task 14: 상태 가이드

**Files:**
- Create: `pj/components/StatusGuide.jsx`
- Modify: `pj/app/admin/dashboard/page.js`

- [ ] **Step 1: 설명 데이터 — 이미 있다**

> **계획 변경(2026-07-29):** `lib/statusGuide.js`를 새로 만들지 않는다. UX-Task 3 직후 `lib/statusMeta.js`를 만들면서 색·뜻·다음행동을 한곳에 모았고, `STATUS_GUIDE`가 거기서 이미 export된다. 같은 데이터를 두 파일로 나누지 않는다.
>
> `STATUS_GUIDE`는 `REQUIREMENT_STATUSES` 순서를 따르는 `{ status, style, meaning, next }` 배열이다. `lib/statusMeta.test.js`가 누락을 막아준다.

- [ ] **Step 2: StatusGuide 컴포넌트**

```jsx
import { BOARD_STATUSES } from '@/lib/statuses';
import { STATUS_GUIDE } from '@/lib/statusGuide';

export function StatusGuide() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-slate-700">상태 안내</h2>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
        {BOARD_STATUSES.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{s}</span>
            {i < BOARD_STATUSES.length - 1 && <span className="text-slate-300">→</span>}
          </span>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 w-24">상태</th>
            <th className="py-2">뜻</th>
            <th className="py-2 w-36">다음 행동</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_GUIDE.map((row) => (
            <tr key={row.status} className="border-b border-slate-100">
              <td className="py-2 font-medium text-slate-900">{row.status}</td>
              <td className="py-2 text-slate-600">{row.meaning}</td>
              <td className="py-2 text-slate-500">{row.next}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        중복은 직접 지정할 수 없고 중복처리를 통해서만 만들어집니다.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: 대시보드에 붙이기**

`app/admin/dashboard/page.js`의 프로젝트 `</section>` 다음, 최상위 `</div>` 앞에 `<StatusGuide />`를 넣고 import를 추가한다.

- [ ] **Step 4: 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: 대시보드 상태 안내 섹션"
```

---

## UX-Task 15: 팀원 계정 상태 노출

**Files:**
- Modify: `pj/app/api/team-members/route.js`
- Modify: `pj/app/admin/brands/page.js` (또는 팀원 목록을 렌더하는 컴포넌트)

- [ ] **Step 1: API에 hasAccount 추가**

`GET` 핸들러에서 `auth_user_id`를 select에 포함시키되, 응답에서는 불리언으로 바꿔 내보낸다.

```js
    const teamMembers = (data ?? []).map(({ auth_user_id, ...rest }) => ({
      ...rest,
      hasAccount: Boolean(auth_user_id),
    }));
```

> 내부 식별자를 화면에 보낼 이유가 없다. 필요한 것은 유무뿐이다.

- [ ] **Step 2: 팀원 목록에 뱃지**

팀원 이름 옆에 조건부 렌더:

```jsx
{!member.hasAccount && (
  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
    계정 없음
  </span>
)}
```

계정이 없는 팀원 행에만 `계정 만들기` 버튼을 두어 기존 `AccountCredentialDialog`를 연다. 이미 계정이 있는 팀원에게는 기존 비밀번호 초기화 동작을 유지한다.

- [ ] **Step 3: 커밋**

```bash
npm run lint && git add -A && git commit -m "feat: 팀원 목록에 계정 없음 표시와 즉시 생성"
```

---

## UX-Task 16: 마이그레이션 실행 + 전체 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 사용자에게 마이그레이션 실행 요청**

`supabase/migrations/0007_status_rename_and_dates.sql`을 Supabase SQL Editor에서 실행해달라고 요청한다. 실행 전에는 앱이 옛 데이터를 읽으므로 보드에서 카드가 사라져 보인다 — 정상이며 마이그레이션 후 복구된다.

- [ ] **Step 2: 변환 결과 확인**

```sql
select status, count(*) from requirements group by status order by status;
```
Expected: `작성중`/`검토대기`/`검토중`/`개발중`/`완료`/`중복`만 나온다. 옛 이름이 하나라도 있으면 실패다.

- [ ] **Step 3: 정적 검증**

```bash
npm run lint && npm run build && npm test -- --run
```
Expected: lint 통과, 빌드 성공, 테스트 전량 통과

- [ ] **Step 4: 브라우저 검증**

`.claude/launch.json`의 경로를 이 워크트리로 맞춘 뒤 `preview_start`로 띄우고 다음을 확인한다.

**상태 체계**
- [ ] 목록 뱃지가 상태별로 다른 색이다 — **전부 회색이면 `STATUS_STYLES` 키가 틀린 것이다**
- [ ] `검토대기`만 앰버로 튄다
- [ ] 보드 컬럼이 5개다
- [ ] **보드에서 카드가 사라지지 않았다** — 마이그레이션 누락 시 조용히 없어진다
- [ ] 새 요구사항을 등록하면 `작성중`으로 들어간다

**날짜**
- [ ] 3차 이상으로 배포예상일을 지정할 수 있다
- [ ] 과거 날짜를 넣으면 목록에 빨간 지연 표시가 뜬다
- [ ] 완료로 바꾸면 지연 표시가 사라지고 완료일이 보인다
- [ ] 4차 계정으로는 예상일을 바꿀 수 없다(403)

**화면 구조**
- [ ] 브랜드 전환기로 브랜드를 바꾸면 목록이 그 브랜드 것으로 바뀐다
- [ ] 전환 후 권한 표시가 그 브랜드 등급에 맞다
- [ ] 현재 메뉴에 밑줄이 있다
- [ ] 프로필 드롭다운이 열리고 바깥을 누르면 닫힌다
- [ ] TopBar에 `보드` 링크가 없고, 목록 페이지 버튼으로는 갈 수 있다

**목록**
- [ ] 제목 검색이 동작하고 타이핑 중 요청이 쏟아지지 않는다
- [ ] 완료 항목이 기본으로 숨겨지고 토글로 보인다
- [ ] 헤더 클릭으로 정렬 방향이 바뀐다
- [ ] 우선순위 정렬이 상→중→하 순서다

**나머지**
- [ ] 대시보드 하단에 상태 안내가 보인다
- [ ] 계정 없는 팀원에 `계정 없음` 뱃지가 있고 거기서 계정을 만들 수 있다

- [ ] **Step 5: 최종 커밋**

```bash
git add -A && git commit -m "chore: UX 개편 브라우저 검증 완료"
```

---

## 자체 점검

**스펙 대응:** 설계 문서 1~6절이 각각 Task 1~3(상태), 4·7·8(날짜), 11~13(화면 구조), 6·8~10(목록), 14(가이드), 15(팀원)에 대응한다. 7절 테스트 전략은 Task 4·5의 TDD와 Task 16의 검증으로, 9절 작업 순서는 이 계획의 Task 번호 순서로 반영했다.

**이름 일관성:** `INITIAL_STATUS`, `isOverdue`, `sortRequirements`, `switchBrand`, `STATUS_GUIDE`, `hasAccount`가 정의된 Task와 사용하는 Task에서 동일하다.

**의존 순서:** Task 2가 상수를 바꾸면 Task 3까지 테스트가 깨진 상태로 남는다. 이는 의도된 것이며 Task 2 Step 2에 명시했다. Task 8은 Task 4(`isOverdue`)에, Task 10은 Task 5(`sortRequirements`)와 Task 9(FilterBar props)에 의존한다.
