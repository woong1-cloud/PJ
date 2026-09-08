# 런칭 1단계 — 화면 상태를 주소로 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 런칭 보드의 화면 상태(탭·보기·역할·담당자·검색·묶기·워크스트림)를 URL 쿼리스트링에 두어, 주소를 그대로 보내면 상대가 같은 화면을 보게 한다. 「내 담당」 칩과 「N건 중 M건」을 더한다.

**Architecture:** 상태의 단일 출처를 `useState` 에서 URL 로 옮긴다. `lib/launchFilters.js`(순수 함수) → `components/useLaunchFilters.js`(URL 읽고 쓰는 훅) → `app/launch/[id]/page.js`(훅을 갖고 props 로 내림) → `LaunchBoard`(props 로 받음). `lib/requirementFilters.js` + `useRequirementFilters.js` 와 같은 모양이라 두 화면의 규칙이 하나가 된다.

**Tech Stack:** Next.js 16 App Router (JS, not TS) · React 19 · Tailwind v4 · Vitest (`environment: 'node'` — DOM 없음, 렌더 테스트 없음)

**스펙:** `docs/superpowers/specs/2026-09-08-launch-url-and-task-view-design.md` §1

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/launchFilters.js` (새로) | 주소 ↔ 화면 상태 변환. 순수 함수, 테스트 대상 |
| `lib/launchFilters.test.js` (새로) | 위의 테스트 |
| `components/useLaunchFilters.js` (새로) | `useSearchParams` 로 읽고 `router.replace` 로 쓴다. 검색어 디바운스 |
| `app/launch/[id]/page.js` (고침) | Suspense 경계 + 훅 소유 + props 로 내림 |
| `components/launch/LaunchBoard.jsx` (고침) | 다섯 상태를 props 로 받음 · 「내 담당」 칩 · 툴바 두 줄 · 건수 |
| `components/launch/WeeklyProgress.jsx` (고침) | ②③ 에 「보드에서 열기」 |

**`LaunchBoard` 에서 `useLaunchFilters` 를 또 부르지 않는다.** 훅이 둘이면
`router.replace` 를 둘이 쏘고, `useRequirementFilters` 가 주석으로 남긴 그 경쟁
상태(낡은 주소를 기준으로 병합해서 방금 쓴 변경이 되살아남)를 그대로 만난다.
**페이지가 하나만 갖고 props 로 내린다.**

**담당자 이름 드롭다운(`selectedAssignee`)은 이번에 안 건드린다.** `assignee_name`
이 471건 모두 비어 있어 `assigneeOptions.length > 0` 에 걸려 화면에 안 그려진다.
안 보이는 칸을 주소에 넣는 것은 앞질러 하는 일이다. URL 의 `assignee` 는
**uuid**(`launch_tasks.assignee`)이고 「내 담당」 칩만 쓴다. 2단계의
「나에게 맡기」가 uuid 를 채우기 시작하면 그때 둘을 합친다.

---

### Task 1: `lib/launchFilters.js` — 주소 ↔ 상태

**Files:**
- Create: `lib/launchFilters.js`
- Test: `lib/launchFilters.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/launchFilters.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GROUP,
  DEFAULT_TAB,
  DEFAULT_VIEW,
  mergeLaunchParams,
  parseLaunchParams,
} from './launchFilters';

const parse = (search) => parseLaunchParams(new URLSearchParams(search));

describe('parseLaunchParams', () => {
  it('빈 주소는 기본값이다', () => {
    expect(parse('')).toMatchObject({
      tab: DEFAULT_TAB, view: DEFAULT_VIEW, group: DEFAULT_GROUP,
      role: '', assignee: '', q: '', ws: '', task: '',
    });
  });

  it('모르는 값은 기본값으로 떨어진다 — 손으로 주소를 고친 사람에게 빈 화면을 주지 않는다', () => {
    expect(parse('tab=zzz&view=zzz&group=zzz')).toMatchObject({
      tab: DEFAULT_TAB, view: DEFAULT_VIEW, group: DEFAULT_GROUP,
    });
  });

  it('아는 값은 그대로 온다', () => {
    expect(parse('tab=weekly&view=blocked&group=assignee')).toMatchObject({
      tab: 'weekly', view: 'blocked', group: 'assignee',
    });
  });

  it('한글 역할이 왕복한다', () => {
    expect(parse('role=' + encodeURIComponent('물류팀')).role).toBe('물류팀');
  });

  it('roleInUrl 이 "키 없음"과 "빈 값"을 가른다 — localStorage 를 쓸지 정하는 값이다', () => {
    expect(parse('view=all').roleInUrl).toBe(false);
    expect(parse('role=').roleInUrl).toBe(true);
    expect(parse('role=물류팀').roleInUrl).toBe(true);
  });

  it('task 는 코드 그대로다', () => {
    expect(parse('task=18-22').task).toBe('18-22');
  });
});

describe('mergeLaunchParams', () => {
  it('빈 값은 키째 지운다 — 기본값이 주소에 남지 않는다', () => {
    expect(mergeLaunchParams('view=blocked&role=물류팀', { role: '' }))
      .toBe('view=blocked');
  });

  it('기본값을 넣으면 키가 빠진다', () => {
    expect(mergeLaunchParams('view=blocked', { view: DEFAULT_VIEW })).toBe('');
    expect(mergeLaunchParams('tab=weekly', { tab: DEFAULT_TAB })).toBe('');
    expect(mergeLaunchParams('group=assignee', { group: DEFAULT_GROUP })).toBe('');
  });

  it('모르는 값도 기본값과 같이 취급해 지운다', () => {
    expect(mergeLaunchParams('view=blocked', { view: 'zzz' })).toBe('');
  });

  it('건드리지 않은 키는 남는다', () => {
    expect(mergeLaunchParams('view=blocked&q=창고', { role: '물류팀' }))
      .toBe('view=blocked&q=%EC%B0%BD%EA%B3%A0&role=%EB%AC%BC%EB%A5%98%ED%8C%80');
  });

  it('여러 개를 한 번에 얹는다', () => {
    expect(mergeLaunchParams('', { view: 'blocked', tab: 'board', q: '' }))
      .toBe('view=blocked');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run lib/launchFilters.test.js`
Expected: FAIL — `Failed to resolve import "./launchFilters"`

- [ ] **Step 3: 구현한다**

`lib/launchFilters.js`:

```js
// 런칭 보드 화면 상태의 단일 출처.
//
// 지금까지 보기·역할·검색·묶기는 LaunchBoard 의 useState 였고 역할만
// localStorage 에 남았다. 그래서 주소를 그대로 보내도 상대는 자기 화면을 봤고,
// 주간 진척에서 "막힌 5건"을 보고 보드로 건너갈 길이 없었다.
//
// 요구사항 쪽 lib/requirementFilters.js 와 같은 모양이다. 두 화면이 다른
// 규칙을 쓰면 언젠가 한쪽만 고쳐진다.

export const LAUNCH_TABS = ['board', 'decisions', 'weekly', 'gantt'];
export const DEFAULT_TAB = 'board';

export const LAUNCH_VIEWS = ['week', 'late', 'blocked', 'ready', 'na', 'all'];
export const DEFAULT_VIEW = 'ready';

export const LAUNCH_GROUPS = ['workstream', 'assignee', 'week'];
export const DEFAULT_GROUP = 'workstream';

// 기본값과 그 후보. merge 가 "이 값은 기본이니 주소에서 뺀다"를 판정할 때 쓴다.
const ENUMS = {
  tab: { list: LAUNCH_TABS, fallback: DEFAULT_TAB },
  view: { list: LAUNCH_VIEWS, fallback: DEFAULT_VIEW },
  group: { list: LAUNCH_GROUPS, fallback: DEFAULT_GROUP },
};

// 주소 → 화면 상태.
//
// 모르는 값은 기본값으로 떨어뜨린다. 손으로 주소를 고쳤거나 링크가 잘려서 온
// 사람에게 빈 화면을 주는 대신 기본 화면을 준다.
export function parseLaunchParams(searchParams) {
  const get = (key) => searchParams?.get(key) ?? '';
  const pick = (key) => {
    const value = get(key);
    return ENUMS[key].list.includes(value) ? value : ENUMS[key].fallback;
  };
  return {
    tab: pick('tab'),
    view: pick('view'),
    group: pick('group'),
    role: get('role'),
    // team_members.id (uuid). 「내 담당」 칩이 쓴다. assignee_name 은 아직
    // 주소에 없다 — 471건 모두 비어 있어 그 드롭다운이 안 그려진다.
    assignee: get('assignee'),
    q: get('q'),
    // 간트에서 막대를 눌러 넘어온 워크스트림.
    ws: get('ws'),
    // 항목 코드. 2단계에서 보기 창을 연다.
    task: get('task'),
    // 주소에 role 키 자체가 있었나.
    //
    // 값이 빈 문자열인 것("역할 전체를 골랐다")과 키가 아예 없는 것("아직 안
    // 골랐으니 브라우저 기억을 쓴다")은 다르다. get() 은 둘 다 '' 로 주므로
    // 여기서 따로 알려 준다.
    roleInUrl: Boolean(searchParams?.has?.('role')),
  };
}

// 지금 주소에 변경분만 얹는다.
//
// 빈 문자열·null·undefined·false 는 "그 키를 지운다"는 뜻이다. 열거형은
// 기본값이거나 모르는 값이면 역시 지운다 — 기본값을 주소에 남기면 "?" 가
// 붙어 있는 것이 필터가 걸렸다는 신호가 되지 못한다.
//
// 필터와 무관한 파라미터는 안 건드린다.
export function mergeLaunchParams(currentSearch, patch) {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(patch)) {
    const enumDef = ENUMS[key];
    const isDefault =
      enumDef && (value === enumDef.fallback || !enumDef.list.includes(value));
    if (value === '' || value === null || value === undefined || value === false || isDefault) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run lib/launchFilters.test.js`
Expected: PASS — 11 tests (it 블록 기준. '기본값을 넣으면 키가 빠진다' 하나가 expect 셋을 품는다)

- [ ] **Step 5: 커밋**

```bash
git add -- lib/launchFilters.js lib/launchFilters.test.js
git commit -m "feat: 런칭 화면 상태의 주소 변환 함수"
```

---

### Task 2: `components/useLaunchFilters.js` — 훅

**Files:**
- Create: `components/useLaunchFilters.js`

렌더 테스트가 없다(vitest 가 node 환경이다). Task 1 의 순수 함수가 로직을 이미
덮고 있고, 이 훅은 그것을 `router.replace` 에 잇는 배선이다.

- [ ] **Step 1: 훅을 쓴다**

`components/useLaunchFilters.js`:

```js
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mergeLaunchParams, parseLaunchParams } from '@/lib/launchFilters';

// 타이핑마다 주소를 바꾸면 라우터가 계속 리렌더를 민다. 300ms 멈춘 뒤에만.
const SEARCH_DEBOUNCE_MS = 300;

// 런칭 보드의 화면 상태를 URL 에서 읽고 쓴다.
// useRequirementFilters 와 같은 모양이다. 왜 URL 인지는 lib/launchFilters.js 참조.
//
// 반환:
//   tab/view/group/role/assignee/ws/task/roleInUrl  주소에서 읽은 값
//   q          입력창에 그릴 값 — 주소가 아니라 로컬 상태다
//   setParams  { key: value } 를 주소에 얹는다
//   setQ       입력창 값만 바꾼다(디바운스 뒤 주소로 간다)
//   reset      전부 기본값으로
export function useLaunchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ReadonlyURLSearchParams 는 렌더마다 새 객체다. 문자열 하나로 눌러서
  // 그것만 비교 기준으로 삼는다 — 안 그러면 effect 가 매 렌더 돈다.
  const searchKey = searchParams.toString();

  const parsed = useMemo(
    () => parseLaunchParams(new URLSearchParams(searchKey)),
    [searchKey],
  );

  // 입력창은 즉시 반응해야 하므로 로컬 상태다.
  const [q, setQ] = useState(parsed.q);
  const [debouncedQ, setDebouncedQ] = useState(parsed.q);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // router.replace 는 비동기다. 호출한 직후 렌더에서도 useSearchParams 는 아직
  // 예전 쿼리스트링을 준다. 그 사이에 두 번째 쓰기가 일어나면 낡은 값을 기준으로
  // 병합해서 방금 쓴 변경이 되살아난다 — 요구사항 쪽에서 '필터 초기화'가
  // 실제로 이 때문에 깨졌다. 병합 기준은 "주소에 쓰기로 한 마지막 값"으로 잡는다.
  const pendingRef = useRef(null);

  // 주소가 우리가 쓴 값을 따라잡았을 때만 기준을 놓아준다. 변화마다 비우면
  // 연속으로 두 번 쓴 뒤 첫 번째만 반영된 시점에 두 번째를 잃는다.
  useEffect(() => {
    if (pendingRef.current === searchKey) pendingRef.current = null;
  }, [searchKey]);

  const setParams = useCallback(
    (patch) => {
      const base = pendingRef.current ?? searchKey;
      const next = mergeLaunchParams(base, patch);
      // 값이 그대로면 라우팅하지 않는다. 이 가드가 없으면 아래 q 동기화
      // effect 가 searchKey 변화마다 replace 를 다시 쏴 루프가 된다.
      if (next === base) return;
      pendingRef.current = next;
      // push 가 아니라 replace 다. 필터를 만질 때마다 히스토리가 쌓이면
      // 뒤로가기를 여러 번 눌러야 화면을 빠져나간다.
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchKey],
  );

  // 디바운스가 끝난 값만 주소로 옮긴다.
  useEffect(() => {
    setParams({ q: debouncedQ.trim() });
  }, [debouncedQ, setParams]);

  const reset = useCallback(() => {
    // 입력창·디바운스·주소를 한 번에 맞춘다. 입력창만 비우고 디바운스를
    // 기다리면 300ms 동안 지운 검색어로 걸러진 결과가 남는다.
    setQ('');
    setDebouncedQ('');
    // role 은 '' 로 보내 키를 지운다. task/ws 는 필터가 아니라 안 건드린다 —
    // '필터 초기화'가 열린 창을 닫으면 놀란다.
    setParams({ view: '', role: '', assignee: '', q: '', group: '' });
  }, [setParams]);

  // parsed.q 를 따로 안 내보낸다. 요구사항 쪽은 검색어가 서버 조회에 들어가서
  // "주소에 들어간 값"이 따로 필요했지만, 런칭은 471건을 브라우저에서 거르므로
  // 입력창 값을 그대로 쓰면 된다 — 안 쓰는 값을 내보내면 언젠가 잘못 쓰인다.
  return { ...parsed, q, setParams, setQ, reset };
}
```

- [ ] **Step 2: 문법과 임포트를 확인한다**

Run: `npm run lint`
Expected: 새 파일에 대한 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add -- components/useLaunchFilters.js
git commit -m "feat: 런칭 화면 상태 훅"
```

---

### Task 3: 페이지 — Suspense 경계와 훅 소유

**Files:**
- Modify: `app/launch/[id]/page.js`

**이 작업의 함정.** `useSearchParams` 는 Suspense 경계 안에 있어야 한다. 없으면
프로덕션 빌드가 `Missing Suspense boundary with useSearchParams` 로 실패하는데,
**개발 서버는 on-demand 렌더라 그냥 통과한다.** `app/requirements/page.js` 가
같은 이유로 경계를 두고 있다.

- [ ] **Step 1: 페이지를 껍데기와 알맹이로 가른다**

`app/launch/[id]/page.js` 맨 위 임포트에 더한다:

```js
import { Suspense } from 'react';
import { useLaunchFilters } from '@/components/useLaunchFilters';
```

기존 `export default function LaunchDetailPage({ params }) {` 를 아래로 바꾼다.
**본문은 그대로 두고 함수 이름만 `LaunchDetailView` 로 바꾼 뒤, 그것을 감싸는
껍데기를 새로 만든다.**

```js
// useSearchParams 를 쓰는 부분은 Suspense 경계 안에 있어야 한다. 없으면
// 프로덕션 빌드가 "Missing Suspense boundary with useSearchParams" 로 실패한다
// (개발 서버는 on-demand 렌더라 그냥 통과해서 눈치채기 어렵다).
export default function LaunchDetailPage({ params }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">불러오는 중...</p>}>
      <LaunchDetailView launchId={id} />
    </Suspense>
  );
}

function LaunchDetailView({ launchId }) {
  const id = launchId;
  // ...기존 본문 그대로...
}
```

기존 본문 첫 줄의 `const { id } = use(params);` 는 **지운다** — 위에서 이미
`launchId` 로 받는다.

- [ ] **Step 2: `tab` 과 `ws` 를 주소로 옮긴다**

`LaunchDetailView` 안에서:

```js
const {
  tab, view, group, role, assignee, ws, q, roleInUrl,
  setParams, setQ, reset,
} = useLaunchFilters();
```

그리고 아래 둘을 **지운다**:

```js
const [tab, setTab] = useState('board');
const [boardFocus, setBoardFocus] = useState('');
```

`setTab(t.key)` 를 쓰던 자리(탭 줄)를 바꾼다:

```js
onClick={() => setParams({ tab: t.key })}
```

`LaunchBoard` 에 넘기던 `focusWorkstream` / `onClearFocus` 를 바꾼다:

```js
focusWorkstream={ws}
onClearFocus={() => setParams({ ws: '' })}
```

`GanttView` 의 `onPick` 을 바꾼다:

```js
onPick={(workstream) => setParams({ ws: workstream, tab: 'board' })}
```

**`setBoardFocus` + `setTab` 두 번이 한 번이 된다.** 두 상태를 따로 바꾸면
중간 렌더에서 보드 탭인데 걸림이 아직 없는 한 프레임이 생긴다.

- [ ] **Step 3: 나머지를 `LaunchBoard` 에 내린다**

```jsx
<LaunchBoard
  launch={launch}
  tasks={tasks}
  today={today}
  decisions={decisions}
  members={members}
  canAdmin={admin}
  // 주소가 들고 있는 화면 상태
  view={view}
  group={group}
  role={role}
  roleInUrl={roleInUrl}
  assignee={assignee}
  query={q}
  myMemberId={identity?.memberId ?? ''}
  onParams={setParams}
  onQuery={setQ}
  onReset={reset}
  onChanged={/* 그대로 */}
  onReload={/* 그대로 */}
  onDecisionCreated={saveDecision}
  onBlockedChanged={refreshDecisions}
  focusWorkstream={ws}
  onClearFocus={() => setParams({ ws: '' })}
/>
```

- [ ] **Step 4: 빌드로 확인한다 — 개발 서버로는 못 잡는다**

Run: `npm run build`
Expected: 성공. `Missing Suspense boundary` 가 나오면 Step 1 이 덜 된 것이다.

- [ ] **Step 5: 커밋**

```bash
git add -- app/launch/\[id\]/page.js
git commit -m "feat: 런칭 페이지의 탭·워크스트림을 주소로"
```

---

### Task 4: `LaunchBoard` — props 로 받기

**Files:**
- Modify: `components/launch/LaunchBoard.jsx`

- [ ] **Step 1: 다섯 `useState` 를 props 로 바꾼다**

먼저 맨 위 임포트에 `useCallback` 을 더한다 — Task 5 의 `inCurrentView` 가 쓴다.

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
```

컴포넌트 시그니처에 더한다:

```js
export function LaunchBoard({
  launch, tasks, today, decisions, members, canAdmin,
  view, group, role, roleInUrl, assignee, query, myMemberId,
  onParams, onQuery, onReset,
  onChanged, onReload, onDecisionCreated, onBlockedChanged,
  focusWorkstream, onClearFocus,
}) {
```

**지운다:**

```js
const [view, setView] = useState('ready');
const [query, setQuery] = useState('');
const [groupMode, setGroupMode] = useState('workstream');
const [selectedRole, setSelectedRole] = useState(() => readStoredRole(launch?.id));
```

**남긴다** (주소에 갈 것이 아니다): `closedGroups` `picked` `touched` `busy`
`error` `naFor` `linksFor` `blockFor` `menuFor` `taskDialog` `roleAsked`
`bulkBusy` `selectedAssignee`(담당자 이름 드롭다운 — 파일 구조 절 참조).

`groupMode` 를 쓰던 자리를 전부 `group` 으로 바꾼다.
`selectedRole` 을 쓰던 자리를 전부 `role` 로 바꾼다.

- [ ] **Step 2: 역할의 출처 규칙을 넣는다**

**지운다** — `selectedRole` 을 `localStorage` 에 쓰는 `useEffect`:

```js
useEffect(() => {
  try {
    if (selectedRole) localStorage.setItem(roleStorageKey(launch.id), selectedRole);
    else localStorage.removeItem(roleStorageKey(launch.id));
  } catch { /* 무시 */ }
}, [launch?.id, selectedRole]);
```

**넣는다** — 주소에 `role` 키가 없을 때만 브라우저 기억을 주소로 올린다:

```js
// 역할의 출처는 하나다. 주소에 role 키가 있으면 주소가 이기고, 없으면
// 브라우저 기억을 읽어 곧바로 주소에 쓴다.
//
// 마운트 때 한 번 주소에 올리는 것이 요점이다. 안 그러면 역할을 안 건드리고
// 보기만 바꿔 링크를 보냈을 때, 받는 사람은 자기 역할로 본다 — 링크가
// 사람마다 다른 것을 가리키면 안 된다.
useEffect(() => {
  if (roleInUrl || !launch?.id) return;
  const stored = readStoredRole(launch.id);
  if (stored) onParams?.({ role: stored });
}, [roleInUrl, launch?.id, onParams]);
```

`pickRole`(역할 띠)과 역할 드롭다운 `onChange` **두 자리에서만** 기억에 쓴다:

```js
// 사람이 고른 것만 기억한다. 링크로 들어온 역할은 이 자리를 안 지나므로
// 남의 링크 한 번 열었다가 내 기본 역할이 바뀌는 일이 없다.
function chooseRole(next) {
  try {
    if (next) localStorage.setItem(roleStorageKey(launch.id), next);
    else localStorage.removeItem(roleStorageKey(launch.id));
  } catch { /* 사생활 보호 모드에서 던진다. 기억을 못 해도 화면은 돌아야 한다. */ }
  onParams?.({ role: next });
  setRoleTab('owner');
}
```

역할 드롭다운의 `onChange` 를 바꾼다:

```jsx
onChange={(e) => chooseRole(e.target.value)}
```

역할 띠의 `pickRole` 은 이렇게 된다 — 고르는 일은 `chooseRole` 이 하고,
띠를 접는 일만 남는다:

```js
function pickRole(next) {
  chooseRole(next);
  setRoleAsked(true);
}
```

`chooseRole` 이 `setRoleTab('owner')` 를 이미 하므로 `pickRole` 에서 또 하지
않는다 — 두 곳에 있으면 한쪽만 고쳐진다.

- [ ] **Step 3: 「내 담당」으로 거른다**

`shown` 의 `useMemo` 안, `focusWorkstream` 필터 바로 뒤에 넣는다:

```js
// 내 담당. 보기 칩과 겹쳐 걸리는 다른 축이라 여기서 따로 건다 —
// "내 담당 중 이번 주"가 되어야 한다.
if (assignee) list = list.filter((task) => task.assignee === assignee);
```

`useMemo` 의 deps 에 `assignee` 를 더한다. `query` 대신 `appliedQuery` 를 쓰던
곳이 있으면 그대로 두고, 거르기는 즉시 반응해야 하므로 **`query`** 를 쓴다.

- [ ] **Step 4: 커밋**

```bash
git add -- components/launch/LaunchBoard.jsx
git commit -m "feat: 런칭 보드가 화면 상태를 주소에서 받는다"
```

---

### Task 5: 툴바를 두 줄로 · 「내 담당」 칩 · 건수

**Files:**
- Modify: `components/launch/LaunchBoard.jsx`

- [ ] **Step 1: 「내 담당」 건수를 센다**

`views` `useMemo` 아래에 더한다:

```js
// 지금 보기 안에서 내 담당이 몇 건인가. 보기가 바뀌면 이 숫자도 바뀐다 —
// 겹쳐 걸리는 축이라 그래야 맞다.
const mineCount = useMemo(() => {
  if (!myMemberId) return 0;
  return tasks.filter((t) => t.assignee === myMemberId && inCurrentView(t)).length;
}, [tasks, myMemberId, view, openDate, today]);
```

`inCurrentView` 는 `shown` 이 쓰는 보기 판정과 같아야 한다. **`shown` 안에 있는
판정을 함수로 빼서 둘이 같이 쓴다** — 따로 쓰면 칩 숫자와 목록이 갈린다.

```js
// 보기 하나의 판정. shown 과 mineCount 가 같이 쓴다. 여기서만 정의한다 —
// 두 곳에 쓰면 칩에 7 이 뜨는데 목록에는 5 줄이 나오는 화면이 생긴다.
const inCurrentView = useCallback((task) => {
  if (view === 'week') return isThisWeek({ task, openDate, today });
  if (view === 'late') return isLate({ task, openDate, today });
  if (view === 'blocked') return isBlocked(task);
  if (view === 'ready') return isReady({ task, tasks });
  if (view === 'na') return isNotApplicable(task);
  return !isNotApplicable(task);
}, [view, openDate, today, tasks]);
```

- [ ] **Step 2: 툴바를 두 줄로 나눈다**

지금의 한 줄(`<div className="flex flex-wrap items-center gap-2">`)을 둘로 가른다.

**첫째 줄 — 무엇을 볼까:**

```jsx
<div className="flex flex-wrap items-center gap-2">
  {/* 역할 드롭다운 — 그대로, onChange 만 chooseRole 로 */}
  {/* 역할 고르기 링크 — 그대로 */}

  {/* 내 담당은 보기 칩이 아니라 그 왼쪽이다. 이번 주·지남·막힘은 서로
      배타적인 한 축(라디오)이고, 내 담당은 겹쳐 걸리는 다른 축이라
      같은 묶음에 섞으면 "내 담당 중 이번 주"를 못 본다. */}
  <span className="h-4 w-px shrink-0 bg-slate-300" />
  <button
    type="button"
    onClick={() => onParams?.({ assignee: assignee ? '' : myMemberId })}
    disabled={!myMemberId}
    aria-pressed={Boolean(assignee)}
    className={`shrink-0 rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 ${
      assignee
        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
    내 담당
    <span className={`ml-1.5 text-xs tabular-nums ${
      mineCount > 0 ? 'font-semibold text-emerald-600' : 'text-slate-400'
    }`}>
      {mineCount}
    </span>
  </button>
  <span className="h-4 w-px shrink-0 bg-slate-300" />

  {/* 보기 칩 여섯 — 그대로, setView 를 onParams 로 */}
</div>
```

보기 칩의 `onClick` 을 바꾼다:

```js
onClick={() => {
  onParams?.({ view: v.key });
  setTouched(new Set());
  setPicked(new Set());
}}
```

**둘째 줄 — 뭐가 보이나 · 뭘 할까:**

```jsx
<div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
  <input
    type="search"
    value={query}
    onChange={(e) => { onQuery?.(e.target.value); setPicked(new Set()); }}
    placeholder="항목·역할로 찾기"
    className="h-9 w-56 min-w-0 shrink-0 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
  />

  {/* 묶는 기준 — 그대로, setGroupMode 를 onParams 로 */}
  <select
    aria-label="묶는 기준"
    value={group}
    onChange={(e) => changeGroupMode(e.target.value)}
    className="h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-600 focus:border-indigo-400 focus:outline-none"
  >
    {GROUP_MODES.map((m) => (
      <option key={m.key} value={m.key}>묶기 · {m.label}</option>
    ))}
  </select>

  {/* 지금 몇 건을 보고 있나. 참여자 넣기 창의 "19명 중 4명"과 같은 규칙이다.
      분모는 해당없음을 뺀 수 — 진척률 분모와 같다. */}
  <span className="shrink-0 text-xs tabular-nums text-slate-500">
    <b className="font-medium text-slate-700">{stat.total}건</b> 중{' '}
    <b className="font-medium text-slate-700">{shown.length}건</b>
  </span>

  {hasFilter && (
    <button type="button" onClick={onReset}
      className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700">
      필터 초기화
    </button>
  )}

  <button
    type="button"
    onClick={() => setTaskDialog({ mode: 'create' })}
    className="ml-auto shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
  >
    ＋ 항목
  </button>
</div>
```

`hasFilter` 를 `views` 아래에 더한다:

```js
const hasFilter = Boolean(role || assignee || query.trim()) || view !== 'ready';
```

`changeGroupMode` 를 바꾼다:

```js
function changeGroupMode(mode) {
  setClosedGroups(new Set());
  setPicked(new Set());
  // '이번 주만 보기'와 '주별로 묶어 보기'는 서로 상쇄된다 — 한 주만 남겨놓고
  // 주별로 묶으면 묶음이 하나거나 빈 화면이다.
  onParams?.(mode === 'week' && view === 'week' ? { group: mode, view: 'all' } : { group: mode });
}
```

- [ ] **Step 3: 「내 담당」이 0일 때 안내한다**

보기 칩 줄 아래, 목록 위에 넣는다:

```jsx
{/* 0 을 감추지 않는다. 담당자가 0/471 인 지금 이 칸을 숨기면 담당자를 붙일
    이유가 영영 안 보인다. 빈 목록 대신 무엇을 하면 되는지 말한다. */}
{assignee && mineCount === 0 && (
  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    아직 <b>내 담당이 없습니다.</b> 항목을 열어 담당자에 자기 이름을 붙이면 여기 모입니다.
  </p>
)}
```

- [ ] **Step 4: 빌드하고 눈으로 확인한다**

Run: `npm run build && npm run test`
Expected: 빌드 성공, 기존 테스트 전부 통과

`npm run dev` 로 띄워 확인한다:
1. 보기 칩을 누르면 주소에 `?view=` 가 붙는다
2. 역할을 고르면 `?role=` 이 붙고, 새로고침해도 그대로다
3. 「내 담당」을 누르면 `?assignee=<uuid>` 가 붙고 안내가 뜬다(0건이므로)
4. 주소를 다른 브라우저에 붙여넣으면 같은 화면이다
5. **1240px 폭에서 두 줄이 각각 한 줄인지** — 목업 실측과 같아야 한다

- [ ] **Step 5: 커밋**

```bash
git add -- components/launch/LaunchBoard.jsx
git commit -m "feat: 런칭 툴바 두 줄 · 내 담당 칩 · 보이는 건수"
```

---

### Task 6: 주간 진척 → 보드

**Files:**
- Modify: `components/launch/WeeklyProgress.jsx`

- [ ] **Step 1: `Section` 이 링크를 받게 한다**

`Section` 시그니처에 `href` 를 더하고, 머리 오른쪽에 그린다:

```jsx
{href && (
  <Link
    href={href}
    className="ml-auto shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700 hover:bg-indigo-100"
  >
    보드에서 열기 ↗
  </Link>
)}
```

맨 위에 `import Link from 'next/link';` 를 더한다.

- [ ] **Step 2: ②③ 에만 단다**

```jsx
<Section step="②" title="막힘" href={`/launch/${launch.id}?view=blocked`} ... >
<Section step="③" title="기한 지남" href={`/launch/${launch.id}?view=late`} ... >
```

**①결정 대기·⑤이번 주 완료에는 안 단다.** ①은 항목이 아니라 결정이라 보드에
대응하는 줄이 없고, ⑤는 확인 자리라 건너갈 이유가 약하다.

`href` 에 `tab` 을 안 쓴다 — 키가 없으면 기본값인 보드다.

- [ ] **Step 3: 확인한다**

Run: `npm run build`

`npm run dev` 로 주간 진척 탭에서 「보드에서 열기」를 누른다.
Expected: **보드 탭으로 넘어가면서** 막힘 보기가 걸린다. 주간 진척 탭에
머물면 Task 3 의 `tab` 배선이 덜 된 것이다.

- [ ] **Step 4: 커밋**

```bash
git add -- components/launch/WeeklyProgress.jsx
git commit -m "feat: 주간 진척에서 보드로 건너가기"
```

---

### Task 7: 배포 전 점검

- [ ] **Step 1: 전체 테스트**

Run: `npm run test`
Expected: 전부 통과. `launchRouteGuard.test.js` 도 포함(라우트를 안 건드렸으니
그대로 통과해야 한다).

- [ ] **Step 2: 린트와 빌드**

Run: `npm run lint && npm run build`

- [ ] **Step 3: 되돌아보기 — 주소를 손으로 고쳐 본다**

`npm run dev` 에서 아래를 직접 주소창에 친다.

| 주소 | 기대 |
|---|---|
| `/launch/<id>` | 보드 · 착수 가능 · 워크스트림 묶기 |
| `/launch/<id>?view=zzz` | 착수 가능으로 떨어진다(빈 화면이 아니다) |
| `/launch/<id>?tab=weekly` | 주간 진척 탭 |
| `/launch/<id>?view=blocked&role=물류팀` | 막힘 + 물류팀, 「N건 중 M건」이 맞다 |
| `/launch/<id>?role=` | 역할 전체. 브라우저에 기억된 역할이 있어도 전체다 |

**마지막 줄이 이 작업의 핵심이다.** `role=` (빈 값)이 기억을 이겨야 한다.

- [ ] **Step 4: 배포**

```bash
npm run package:src
```

`npm run package` 가 아니다.

---

## 안 하는 것 (1단계)

| | 언제 |
|---|---|
| `?task=` 와 항목 보기 창 | 2단계 |
| 「나에게 맡기」 | 2단계 |
| 댓글·멘션 | 3단계 |
| 담당자 이름 드롭다운을 주소로 | 2단계 — 지금 안 그려진다 |
| 「이 화면 링크」 단추 | 안 만든다 (스펙 §4) |

## 알려진 것

**「내 담당」은 배포 직후 계속 0이다.** `launch_tasks.assignee` 가 471건 모두
비어 있다. 2단계의 「나에게 맡기」가 그것을 채우기 시작한다. 그래서 0일 때
안내를 띄우는 것이 이 단계에서 중요하다 — 그 문구가 다음 단계를 가리킨다.
