# 모바일 UI/UX 전면 재검토 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱 전용으로 만들어진 모아 MOA를 브랜드 요청자가 폰에서 실제로 쓸 수 있게 만든다.

**Architecture:** 화면을 두 벌로 만들지 않는다. 같은 컴포넌트 안에서 `md:`(768px) 분기로 갈린다. 필터 선택지처럼 두 곳에서 쓰이는 데이터는 순수 함수로 뽑아 한 곳에서 정의하고 양쪽이 그것을 읽는다. 마이그레이션과 API 변경은 없다.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui(base-ui), Vitest

**Spec:** `docs/superpowers/specs/2026-08-03-mobile-uiux-design.md`

---

## 파일 구조

| 파일 | 책임 | 변경 |
|---|---|---|
| `lib/requirementFilters.js` | 필터 값 ↔ URL ↔ API 쿼리 | `countActiveFilters` 추가 |
| `lib/filterFields.js` | **신규.** 필터 7종의 키·라벨·선택지 정의 | 신규 |
| `components/FilterSheet.jsx` | **신규.** 모바일 필터 시트(내부는 Dialog) | 신규 |
| `components/FilterBar.jsx` | 필터 컨트롤. 모바일=검색+버튼, 데스크톱=현행 | 수정 |
| `components/TopBar.jsx` | 상단바. 모바일 압축 + 시트 메뉴 | 수정 |
| `components/NewRequirementFab.jsx` | **신규.** 목록 전용 플로팅 등록 버튼 | 신규 |
| `components/RequirementList.jsx` | 표(데스크톱) + 카드(모바일). 카드 4줄 고정 | 수정 |
| `components/RequirementFormDialog.jsx` | 등록 폼. 에러 위치·필드 순서·유형 안내 | 수정 |
| `components/RequirementDetail.jsx` | 상세. 제목 분리 + 모바일 메타 우선 | 수정 |
| `components/ImageDropzone.jsx` | 첨부. 모바일 문구 분기 | 수정 |
| `components/NotificationBell.jsx` | 알림 패널 폭 | 수정 |
| `components/StatusGuide.jsx` `TierGuide.jsx` | 도움말. 모바일 정의 목록 | 수정 |
| `components/BrandListSection.jsx` 외 3 | 관리 표. `overflow-x-auto` 래퍼 | 수정 |
| `app/requirements/page.js` | 목록 헤더 모바일 숨김 + FAB | 수정 |
| `app/requirements/board/page.js` | 모바일 안내 | 수정 |
| `app/login|signup|change-password/page.js` | 터치 타깃 | 수정 |

**테스트 가능한 것은 순수 함수 둘뿐이다.** 나머지는 화면 계층이라 lint·build·기존 테스트 유지 + 실기기 확인으로 검증한다. 스펙의 "검증" 절 참조.

---

## Task 1: countActiveFilters (TDD)

모바일 필터 버튼에 붙일 숫자. 값이 걸려 있는데 컨트롤이 시트 안에 숨어 있으면 사용자는 결과가 왜 좁아졌는지 알 수 없다.

**Files:**
- Modify: `lib/requirementFilters.js`
- Test: `lib/requirementFilters.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/requirementFilters.test.js` 끝에 추가:

```js
describe('countActiveFilters', () => {
  it('걸린 필터 개수를 센다', () => {
    expect(countActiveFilters({ filters: { status: '개발중', type: '오류' } })).toBe(2);
  });

  it('빈 값은 안 센다 — 없는 필터를 개수에 넣으면 배지가 늘 켜져 있다', () => {
    expect(countActiveFilters({ filters: { status: '', type: null, assignee: undefined } })).toBe(0);
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters()).toBe(0);
  });

  it('FILTER_KEYS 밖의 값은 무시한다 — 주소를 손으로 고친 경우', () => {
    expect(countActiveFilters({ filters: { status: '개발중', nonsense: 'x' } })).toBe(1);
  });

  it('내 요청만도 하나로 센다 — 시트 안에 있으므로 안 세면 안 보인다', () => {
    expect(countActiveFilters({ filters: {}, mine: true })).toBe(1);
  });

  it('종결 표시는 기본에서 벗어났을 때만 센다', () => {
    // 기본은 종결 숨김(includeDone=false)이다. 그 상태를 세면 첫 화면부터
    // 배지에 1 이 뜬다.
    expect(countActiveFilters({ filters: {}, includeDone: false })).toBe(0);
    expect(countActiveFilters({ filters: {}, includeDone: true })).toBe(1);
  });

  it('검색어는 안 센다 — 검색창이 시트 밖에 따로 보인다', () => {
    expect(countActiveFilters({ filters: {}, query: '쿠폰' })).toBe(0);
  });
});
```

임포트 줄에 `countActiveFilters` 를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/requirementFilters.test.js`
Expected: FAIL — `countActiveFilters is not a function`

- [ ] **Step 3: 구현**

`lib/requirementFilters.js` 의 `hasActiveFilters` 바로 아래에 추가:

```js
// 모바일 필터 시트 버튼에 붙는 숫자.
//
// hasActiveFilters 와 따로 두는 이유: 저쪽은 '초기화' 버튼을 띄울지 여부라
// 검색어까지 포함해 참/거짓만 보면 되고, 이쪽은 시트 안에 숨은 것이 몇 개인지
// 세야 한다. 검색창은 시트 밖에 그대로 보이므로 query 는 세지 않는다.
//
// includeDone 은 기본이 false(종결 숨김)다. 그 상태를 세면 아무것도 안 건드린
// 첫 화면에서 배지에 1 이 뜬다.
export function countActiveFilters({ filters = {}, mine = false, includeDone = false } = {}) {
  let n = FILTER_KEYS.filter((k) => filters[k]).length;
  if (mine) n += 1;
  if (includeDone) n += 1;
  return n;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/requirementFilters.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/requirementFilters.js lib/requirementFilters.test.js
git commit -m "feat: countActiveFilters — 모바일 필터 시트 배지용 개수"
```

---

## Task 2: buildFilterFields (TDD)

필터 7종의 선택지를 한 곳에서 정의한다. FilterBar와 FilterSheet가 같은 배열을 읽는다. 복제하면 필터를 하나 늘릴 때 한쪽만 고치는 사고가 난다.

**Files:**
- Create: `lib/filterFields.js`
- Test: `lib/filterFields.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/filterFields.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildFilterFields, PRIMARY_FILTER_KEYS } from './filterFields';
import { FILTER_KEYS } from './requirementFilters';

const opts = {
  teamMembers: [{ id: 'm1', name: '박실무' }],
  categories: [{ id: 'c1', category_name: '주문' }],
  projects: [{ id: 'p1', name: '결제 개편' }],
};

describe('buildFilterFields', () => {
  it('FILTER_KEYS 를 하나도 빠짐없이 덮는다', () => {
    const keys = buildFilterFields(opts).map((f) => f.key);
    expect(keys.sort()).toEqual([...FILTER_KEYS].sort());
  });

  it('조회로 받은 목록을 선택지로 옮긴다', () => {
    const fields = buildFilterFields(opts);
    expect(fields.find((f) => f.key === 'assignee').options).toEqual([
      { value: 'm1', label: '박실무' },
    ]);
    expect(fields.find((f) => f.key === 'category').options).toEqual([
      { value: 'c1', label: '주문' },
    ]);
    expect(fields.find((f) => f.key === 'project').options).toEqual([
      { value: 'p1', label: '결제 개편' },
    ]);
  });

  it('고정 목록은 인자 없이도 채워진다', () => {
    const fields = buildFilterFields();
    expect(fields.find((f) => f.key === 'priority').options).toEqual([
      { value: '상', label: '상' },
      { value: '중', label: '중' },
      { value: '하', label: '하' },
    ]);
    expect(fields.find((f) => f.key === 'status').options.length).toBeGreaterThan(0);
  });

  it('조회가 안 끝났으면 빈 선택지다 — 터지지 않는다', () => {
    expect(() => buildFilterFields({})).not.toThrow();
    expect(buildFilterFields({}).find((f) => f.key === 'assignee').options).toEqual([]);
  });

  it('모든 필드에 라벨이 있다 — 시트에서 셀렉트 위에 적는다', () => {
    for (const f of buildFilterFields(opts)) {
      expect(typeof f.label).toBe('string');
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it('데스크톱에서 접지 않는 것은 상태와 유형이다', () => {
    expect(PRIMARY_FILTER_KEYS).toEqual(['status', 'type']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/filterFields.test.js`
Expected: FAIL — `Failed to resolve import "./filterFields"`

- [ ] **Step 3: 구현**

`lib/filterFields.js`:

```js
import { CHANNELS } from './channels';
import { REQUIREMENT_STATUSES } from './statuses';
import { REQUIREMENT_TYPES } from './requirementTypes';

const PRIORITIES = ['상', '중', '하'];

// 데스크톱 필터바에서 접지 않고 늘 보이는 둘.
// 나머지는 '필터 더보기' 뒤에 있고, 모바일에서는 전부 시트 안에 있다.
export const PRIMARY_FILTER_KEYS = ['status', 'type'];

const asOptions = (values) => values.map((v) => ({ value: v, label: v }));

// 필터 7종의 정의를 한 곳에 둔다.
//
// 필터바(데스크톱)와 필터 시트(모바일)가 같은 배열을 읽는다. 양쪽에 셀렉트를
// 복제해 두면 필터를 하나 늘릴 때 한쪽만 고치는 사고가 난다 — 이 프로젝트에서
// 이미 겪었다(유형을 목록·보드에 넣고 상세를 빠뜨렸다).
//
// 순서가 곧 화면 순서다. lib/requirementFilters.js 의 FILTER_KEYS 와 같은
// 집합이어야 하며, 그것을 테스트가 지킨다.
export function buildFilterFields({ teamMembers = [], categories = [], projects = [] } = {}) {
  return [
    { key: 'status', label: '상태', options: asOptions(REQUIREMENT_STATUSES) },
    { key: 'type', label: '유형', options: asOptions(REQUIREMENT_TYPES) },
    { key: 'assignee', label: '담당자', options: teamMembers.map((m) => ({ value: m.id, label: m.name })) },
    { key: 'category', label: '카테고리', options: categories.map((c) => ({ value: c.id, label: c.category_name })) },
    { key: 'channel', label: '채널', options: asOptions(CHANNELS) },
    { key: 'priority', label: '우선순위', options: asOptions(PRIORITIES) },
    { key: 'project', label: '프로젝트', options: projects.map((p) => ({ value: p.id, label: p.name })) },
  ];
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/filterFields.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/filterFields.js lib/filterFields.test.js
git commit -m "feat: buildFilterFields — 필터 선택지 정의를 한 곳으로"
```

---

## Task 3: FilterSheet + FilterBar 모바일 분기

**Files:**
- Create: `components/FilterSheet.jsx`
- Modify: `components/FilterBar.jsx`

- [ ] **Step 1: FilterSheet 를 만든다**

`components/FilterSheet.jsx` — `Dialog` 를 열고 안에 `buildFilterFields` 의 필드를 세로로 쌓는다. 새 오버레이 메커니즘을 만들지 않는다.

구조:
- `<Dialog open onOpenChange>` → `<DialogContent className="max-h-[85vh] overflow-y-auto">`
- `<DialogHeader><DialogTitle>필터</DialogTitle></DialogHeader>`
- 필드마다 `<Label>{field.label}</Label>` + `<Select>` (트리거 `h-11 w-full text-sm`)
  - 값이 걸린 필드에는 트리거 옆에 `지우기` 버튼(`onChange({ [key]: '' })`)
- `종결 숨김` / `내 요청만` 체크박스 — `showIncludeDone`, `onMineChange` 가 있을 때만
- 푸터: `초기화`(onReset 후 닫기) + `닫기`. 둘 다 `h-11 flex-1`

Select 트리거를 44px(`h-11`)로 두는 것이 이 화면의 요점이다. 데스크톱 필터바의 `h-8` 을 그대로 시트에 넣으면 손가락으로 못 누른다.

- [ ] **Step 2: FilterBar 를 모바일/데스크톱으로 가른다**

`components/FilterBar.jsx`:

- 기존 인라인 `FilterSelect` 7개를 `buildFilterFields` 순회로 바꾼다. `PRIMARY_FILTER_KEYS` 에 든 것은 항상, 나머지는 `expanded` 일 때만 그린다. **데스크톱 화면 결과는 지금과 같아야 한다.**
- 최상위를 둘로 나눈다:
  - 모바일(`md:hidden`): `<input type="search" className="h-11 flex-1 ...">` + `필터 N` 버튼(`h-11`). 버튼 숫자는 `countActiveFilters`.
  - 데스크톱(`hidden md:flex`): 지금 그대로
- `필터 N` 버튼이 `FilterSheet` 를 연다. 시트에는 기존 props 를 그대로 넘긴다.

- [ ] **Step 3: 검증**

```bash
npm run lint && npx vitest run
```
Expected: 0 errors, 479 tests passed

- [ ] **Step 4: 커밋**

```bash
git add components/FilterSheet.jsx components/FilterBar.jsx
git commit -m "feat: 모바일 필터 시트 — 검색+버튼 한 줄로"
```

---

## Task 4: TopBar 모바일 압축

**Files:**
- Modify: `components/TopBar.jsx`

- [ ] **Step 1: 왼쪽 묶음을 가른다**

- 모바일: `모아` + `·` + 브랜드명 텍스트만. `BrandSwitcher` 대신 현재 브랜드 이름을 텍스트로 — 전환은 데스크톱에서 한다. **표시는 반드시 남긴다**(어느 브랜드를 보는지 모르는 것이 가장 위험하다).
  - `BrandSwitcher` 에 `readOnly` prop 을 추가해 텍스트만 그리게 하고, TopBar 에서 모바일용으로 한 번 더 쓴다. `brands.length <= 1` 일 때 이미 텍스트만 그리는 분기가 있으므로 그 경로를 재사용한다.
- 모바일: `요구사항`·`프로젝트`·`대시보드` `NavLink` 와 구분선 둘을 `hidden md:flex` 로 감싼다.
- 데스크톱: 지금 그대로.

- [ ] **Step 2: 아바타 메뉴에 이동 링크를 넣는다**

메뉴 최상단에 `md:hidden` 묶음으로 `요구사항` / `프로젝트` / (전체관리자면) `대시보드` 를 넣고 그 아래 구분선(`border-t`). 기존 항목(설정·브랜드 관리·팀원 관리·도움말·비밀번호 변경·로그아웃)은 그대로.

`MenuLink` 의 `py-1.5` 를 `py-1.5 md:py-1.5` → 모바일 44px 로: `className="flex min-h-11 items-center px-3 text-sm text-slate-600 hover:bg-slate-50 md:min-h-0 md:py-1.5"`. 로그아웃 버튼도 같게 맞춘다.

메뉴 폭도 가른다: `w-44` → `w-56 md:w-44`.

- [ ] **Step 3: 검증**

```bash
npm run lint && npm run build
```
Expected: 0 errors, build 성공

- [ ] **Step 4: 커밋**

```bash
git add components/TopBar.jsx components/BrandSwitcher.jsx
git commit -m "fix: TopBar 모바일 잘림 — 압축 + 이동 링크를 계정 메뉴로"
```

---

## Task 5: 플로팅 등록 버튼 + 목록 헤더 모바일 숨김

**Files:**
- Create: `components/NewRequirementFab.jsx`
- Modify: `app/requirements/page.js`

- [ ] **Step 1: FAB 컴포넌트**

`components/NewRequirementFab.jsx`:

```jsx
'use client';

// 목록 화면 전용 등록 버튼.
//
// 모바일에서 헤더의 '+ 새 요구사항' 을 지웠기 때문에 이 버튼이 유일한 입구다.
// 다른 화면에는 띄우지 않는다 — "여기서 뭘 등록한다는 거지"가 된다.
export function NewRequirementFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="새 요구사항 등록"
      className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl leading-none text-white shadow-lg active:bg-indigo-700 md:hidden"
    >
      +
    </button>
  );
}
```

- [ ] **Step 2: 목록 페이지에 붙인다**

`app/requirements/page.js`:
- 헤더 줄(`요구사항 목록` + CSV + `+ 새 요구사항` + 뷰 토글)을 `hidden md:flex` 로 감싼다
- 목록 컨테이너에 `pb-20 md:pb-0` — FAB 가 마지막 카드를 가리지 않게
- `<NewRequirementFab onClick={() => setDialogOpen(true)} />` 를 추가

- [ ] **Step 3: 검증**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add components/NewRequirementFab.jsx app/requirements/page.js
git commit -m "feat: 모바일 플로팅 등록 버튼 + 목록 헤더 정리"
```

---

## Task 6: 목록 모바일 카드 4줄 고정

**Files:**
- Modify: `components/RequirementList.jsx`

- [ ] **Step 1: 카드를 4줄로 다시 쓴다**

현재 마지막 줄이 값 6~9개를 `·` 로 이어 붙여 감기는 자리가 데이터마다 다르다. `Meta` 가 `inline-flex` 인데 부모도 `flex` 라 예측이 안 되는 것도 겹친다.

새 구조 — `requirements` prop 옆에 `myMemberId` 를 받지 않는다. 요청자는 조건 없이 항상 그린다(스펙 2.1 참조).

```
1줄: [상태 배지]                    [예상·완료일]   justify-between
2줄: 제목                                           line-clamp-2
3줄: 유형 · 채널                    담당 ○○○      justify-between
4줄: ○○○ 요청 · 📎N · 프로젝트명 · 미연결          11px 회색
```

- 3줄 오른쪽: `담당 {req.assignee?.name ?? '미지정'}`. 미지정은 `text-slate-400`.
- 4줄은 `flex flex-wrap gap-x-2` 로 두고 각 항목을 조건부로 넣는다. 요청자는 항상 있으므로 줄은 항상 생긴다 — 그래서 카드 높이가 균일해진다.
- 카테고리는 뺀다.
- `Meta` 컴포넌트는 표(데스크톱)에서만 쓴다. 카드에서는 4줄이 그 역할을 한다.

- [ ] **Step 2: 검증**

```bash
npm run lint && npx vitest run && npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add components/RequirementList.jsx
git commit -m "fix: 모바일 카드 4줄 고정 — 담당자 노출, 높이 균일화"
```

---

## Task 7: 등록 폼

**Files:**
- Modify: `components/RequirementFormDialog.jsx`
- Modify: `components/ImageDropzone.jsx`

- [ ] **Step 1: 에러 위치를 옮긴다 (실제 버그)**

`<form>` 최상단의 `{error && <p>}` 를 지우고 `<DialogFooter>` **바로 위**로 옮긴다.

모바일에서 폼을 다 내려가 아래쪽 버튼을 눌렀을 때 에러가 화면 밖 위에 뜨면 사용자 눈에는 아무 일도 안 일어난 것으로 보인다. 어제 채널을 필수로 만들며 이 경로를 새로 만들어 놓고 보지 못했다.

- [ ] **Step 2: 오른쪽 열 순서를 바꾼다**

`유형 → 우선순위+채널 → 카테고리+요청일 → 프로젝트`
→ `채널*+유형 → 우선순위+카테고리 → 요청일+프로젝트`

필수값이 먼저 나와야 한다. 모바일에서 세로로 떨어질 때도 마찬가지다.

- [ ] **Step 3: 유형 안내 박스를 모바일에서 접는다**

안내 박스를 `useState(false)` 로 접고 `유형이 뭔가요?` 버튼으로 편다. 데스크톱은 기본 펼침 — `useState(typeof window === 'undefined' ? true : window.innerWidth >= 768)` 같은 것을 쓰지 않는다(하이드레이션 불일치). 대신 **CSS 로만 가른다**: 접기 버튼은 `md:hidden`, 안내 박스는 `hidden md:block` + 모바일에서 열렸을 때만 `block`.

- [ ] **Step 4: 버튼을 44px 로**

`DialogFooter` 의 두 버튼에 `h-11 w-full md:h-9 md:w-auto`.

- [ ] **Step 5: 첨부 문구를 가른다**

`components/ImageDropzone.jsx:98` 의 문구를 둘로:
- 모바일(`md:hidden`): `사진·파일 선택`
- 데스크톱(`hidden md:inline`): `파일을 드래그하거나 클릭해서 선택 · 스크린샷은 Ctrl+V로 붙여넣기`

폰에는 드래그도 Ctrl+V도 없다. 지금 문구는 거짓말이다.

- [ ] **Step 6: 검증**

```bash
npm run lint && npx vitest run && npm run build
```

- [ ] **Step 7: 커밋**

```bash
git add components/RequirementFormDialog.jsx components/ImageDropzone.jsx
git commit -m "fix: 등록 폼 에러가 화면 밖에 뜨던 문제 + 모바일 폼 정리"
```

---

## Task 8: 상세 화면

**Files:**
- Modify: `components/RequirementDetail.jsx`

- [ ] **Step 1: 제목을 grid 밖으로 뺀다**

현재 제목과 수정 버튼이 본문 div(`md:col-span-2`) 첫 줄에 있다. 이것을 `grid` 위로 올린다. 그래야 모바일에서 메타를 본문 위로 올려도 제목이 맨 위에 남는다.

- [ ] **Step 2: 모바일에서 메타를 본문 위로**

`<aside>` 에 `order-first md:order-none` 을 준다.

모바일 순서: 제목 → 상태·담당자·예상일·(승인 버튼) → 본문 → 코멘트

폰으로 상세를 여는 이유가 "어디까지 왔나"인데 지금은 As-Is·To-Be·첨부를 다 지나야 나온다.

- [ ] **Step 3: 터치 타깃**

`aside` 안의 상태 Select, 담당자 Select, `승인하고 완료` 버튼에 `h-11 md:h-8`(버튼은 `md:h-9`).

`승인하고 완료` 는 되돌리기 어렵다. 작으면 오히려 잘못 누른다.

- [ ] **Step 4: 검증**

```bash
npm run lint && npx vitest run && npm run build
```

- [ ] **Step 5: 커밋**

```bash
git add components/RequirementDetail.jsx
git commit -m "fix: 모바일 상세에서 상태·담당자를 첫 화면으로"
```

---

## Task 9: 도움말 · 알림

**Files:**
- Modify: `components/StatusGuide.jsx`, `components/TierGuide.jsx`
- Modify: `components/NotificationBell.jsx`

- [ ] **Step 1: 가이드 표를 모바일 정의 목록으로**

두 컴포넌트 모두 표를 `hidden md:block` 으로 두고, 같은 데이터를 쓰는 `md:hidden` 정의 목록을 추가한다. 항목마다 `<dt>` 는 상태·등급 이름, `<dd>` 는 설명.

**데이터를 복제하지 않는다.** 각 파일 안의 배열 상수를 두 렌더가 함께 읽는다.

권한이 가장 낮은 요청자가 가장 자주 보는 화면인데 표라서 폰에서 밀린다.

- [ ] **Step 2: 알림 패널 폭**

`components/NotificationBell.jsx:92` 의 `w-80` 을 `w-[calc(100vw-2rem)] max-w-80` 으로. 320px 패널이 375px 화면에 겨우 들어가고 더 좁은 폰에서는 넘친다.

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run lint && npm run build
git add components/StatusGuide.jsx components/TierGuide.jsx components/NotificationBell.jsx
git commit -m "fix: 도움말 가이드 모바일 정의 목록 + 알림 패널 폭"
```

---

## Task 10: 관리 화면 표 + 보드 안내

**Files:**
- Modify: `components/BrandListSection.jsx`, `components/BrandTeamSection.jsx`, `components/PendingMembersSection.jsx`, `components/TeamMemberListSection.jsx`
- Modify: `app/projects/page.js`, `app/admin/dashboard/page.js`
- Modify: `app/requirements/board/page.js`

- [ ] **Step 1: 표를 가로 스크롤 래퍼로 감싼다**

각 `<table>` 을 `<div className="overflow-x-auto">` 로 감싼다. 표는 옆으로 스크롤되고 페이지 전체는 밀리지 않는다. **이것이 "깨진 화면"과 "좁은 화면"의 차이다.**

모바일 카드 뷰는 만들지 않는다 — 관리 화면은 데스크톱에서 쓴다.

`RoadmapView` 는 이미 `overflow-x-auto` 가 있으므로 손대지 않는다.

- [ ] **Step 2: 보드에 모바일 안내**

`app/requirements/board/page.js` 의 반환부 맨 위에 `md:hidden` 안내를 넣고 보드 본체를 `hidden md:block` 으로 감싼다.

```jsx
<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 md:hidden">
  <p className="font-medium text-slate-900">보드는 PC에서 사용해 주세요</p>
  <p className="mt-1 text-slate-500">
    컬럼이 일곱 개이고 카드를 끌어 옮기는 화면이라 폰에서는 다루기 어렵습니다.
  </p>
  <Link href="/requirements" className="mt-3 inline-block text-indigo-600 underline">
    목록으로 보기
  </Link>
</div>
```

모바일에서 뷰 토글을 숨겼으므로 여기 도달하는 것은 URL 을 직접 연 경우뿐이다. 모바일용 대체 보드는 만들지 않는다.

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run lint && npm run build
git add components/BrandListSection.jsx components/BrandTeamSection.jsx components/PendingMembersSection.jsx components/TeamMemberListSection.jsx app/projects/page.js app/admin/dashboard/page.js app/requirements/board/page.js
git commit -m "fix: 관리 화면 표 가로 스크롤 + 보드 모바일 안내"
```

---

## Task 11: 인증 화면 터치 타깃

**Files:**
- Modify: `app/login/page.js`, `app/signup/page.js`, `app/change-password/page.js`

- [ ] **Step 1: 입력·버튼을 44px 로**

세 화면의 `<Input>` 과 제출 `<Button>` 에 `h-11 md:h-9`. 구조(`w-full max-w-sm`)는 이미 모바일 친화적이라 손대지 않는다.

**첫 접속이 폰일 수 있으므로 여기가 깨지면 앱을 못 쓴다.**

- [ ] **Step 2: 검증 + 커밋**

```bash
npm run lint && npm run build
git add app/login/page.js app/signup/page.js app/change-password/page.js
git commit -m "fix: 로그인·가입·비밀번호 변경 모바일 터치 타깃"
```

---

## Task 12: 전체 검증 + 배포 ZIP

- [ ] **Step 1: 전체 검증**

```bash
npm run lint && npx vitest run && npm run build
```
Expected: 0 errors, 479 tests passed, build 성공

- [ ] **Step 2: 데스크톱 회귀 확인**

이 작업의 대부분이 `md:` 분기 추가다. **데스크톱 화면이 그대로여야 한다.** 특히:
- TopBar 링크 배치
- 등록 폼 2열 배치
- 목록 표(카드 아님)
- 필터바 접기/펼치기

- [ ] **Step 3: ZIP**

```bash
npm run package:src
```

- [ ] **Step 4: 배포 후 실기기 확인** (사용자가 수행)

스펙의 검증 절 8항목:
1. TopBar가 잘리지 않는가 (375px, 320px)
2. 어느 브랜드를 보고 있는지 보이는가
3. 플로팅 버튼이 마지막 카드를 가리지 않는가
4. 카드 높이가 균일한가
5. 필터 시트가 열리고 적용 개수가 버튼에 뜨는가
6. 채널을 비우고 제출했을 때 **에러가 화면 안에 뜨는가**
7. 상세에서 상태·담당자가 첫 화면에 보이는가
8. 관리 화면에서 페이지 전체가 아니라 표만 옆으로 스크롤되는가
