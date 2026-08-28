# 목록 세 뷰와 상세 중복처리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 데이터를 목록·표·보드 셋 중 골라 보게 하고, 목록에 "무엇이 멈췄나"를 드러내고, 상세에서 중복 병합을 할 수 있게 한다.

**Architecture:** 행이 무엇을 보여줄지는 `lib/listRow.js` 순수 함수 하나가 정하고 목록과 보드가 그것을 함께 본다. 정체는 목록 API 가 계산해 실어 보낸다 — `/api/meeting` 이 이미 쓰는 방식이다. 표와 보드의 컬럼·드래그는 손대지 않는다.

**Tech Stack:** Next.js 16 App Router (JS), React 19, Tailwind v4, Supabase, Vitest

설계 문서: `docs/superpowers/specs/2026-08-28-list-views-design.md`
프로토타입: https://claude.ai/code/artifact/45354768-2bcb-4609-a9b7-3d7c8afb227d

---

## 이 계획이 지키는 경계

**서버는 목록 API 하나만 바꾼다.** 권한·알림·마이그레이션·병합 라우트는 그대로다.

**표는 손대지 않는다.** `RequirementList.jsx` 를 열지 않는다.

**보드의 컬럼과 드래그도 손대지 않는다.** 카드가 쓰는 언어만 맞춘다.

**렌더 테스트는 만들지 않는다.** 테스트 환경이 `node` 라 DOM 이 없고, 이 프로젝트에 선례가 없다. 순수 함수에만 테스트를 건다.

---

## 파일 구조

**새로 만드는 것**

| 파일 | 책임 |
|---|---|
| `lib/listRow.js` | 행 하나가 보여줄 것을 정한다. 순수 함수 |
| `lib/listRow.test.js` | 위 테스트 |
| `components/RequirementRows.jsx` | 목록(행) 뷰 |

**고치는 것**

| 파일 | 무엇을 |
|---|---|
| `app/api/requirements/route.js` | `created_at` 추가, 정체 계산, `stalled` 필터 |
| `lib/quickFilters.js` | `멈춘 것` 칩 추가 |
| `lib/quickFilters.test.js` | 위 테스트 |
| `components/RequirementViewToggle.jsx` | 셋으로 늘린다 |
| `app/requirements/page.js` | 뷰 분기 · `stalled` 전달 · 뷰 기억 |
| `lib/filterMemory.js` | 뷰를 기억 대상에 넣는다 |
| `components/KanbanBoard.jsx` | 카드가 `listRow` 를 쓰게 |
| `components/RequirementDetail.jsx` | 중복 병합 창 |

---

## Task 1: `lib/listRow.js` — 행이 보여줄 것

**Files:**
- Create: `lib/listRow.js`
- Create: `lib/listRow.test.js`

목록의 행과 보드의 카드가 이 하나를 함께 본다. 뷰가 셋이 되면서 같은 판정이
세 곳에 흩어지는 것을 막는 것이 이 파일의 존재 이유다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/listRow.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { listRow } from './listRow';

const req = (over = {}) => ({
  id: 'r1',
  title: '타임세일',
  status: '검토대기',
  channel: '자사몰',
  requirement_type: '개선',
  priority: '중',
  category: { id: 'c1', category_name: '프로모션' },
  assignee: null,
  requester: { id: 'p1', name: '박천주' },
  created_at: '2026-07-30T00:00:00Z',
  completed_at: null,
  ...over,
});

describe('listRow — 채널 뱃지', () => {
  it('자사몰은 그리지 않는다 — 47건 중 44건이라 뱃지가 소음이 된다', () => {
    expect(listRow({ requirement: req() }).channelBadge).toBeNull();
  });

  it('외부몰은 그린다', () => {
    expect(listRow({ requirement: req({ channel: '외부몰' }) }).channelBadge).toBe('외부몰');
  });

  it('채널이 비어 있으면 그리지 않는다', () => {
    expect(listRow({ requirement: req({ channel: null }) }).channelBadge).toBeNull();
  });
});

describe('listRow — 손이 필요한 줄', () => {
  it('정체 14일 이상이면 stall', () => {
    expect(listRow({ requirement: req(), stalledDays: 20 }).flag).toBe('stall');
  });

  it('담당자가 없고 미종결이면 unassigned', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).flag).toBe('unassigned');
  });

  it('정체와 담당 없음이 겹치면 stall 이 이긴다 — 더 급한 쪽이다', () => {
    expect(listRow({ requirement: req({ assignee: null }), stalledDays: 20 }).flag).toBe('stall');
  });

  it('담당자가 있고 정체가 아니면 표시가 없다', () => {
    const got = listRow({
      requirement: req({ assignee: { id: 'm1', name: '장재혁' } }),
      stalledDays: 3,
    });
    expect(got.flag).toBeNull();
  });

  it('종결 건은 표시가 없다 — 끝난 일에 경고를 달면 안 된다', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(listRow({ requirement: req({ status }), stalledDays: null }).flag, status).toBeNull();
    }
  });
});

describe('listRow — 경과', () => {
  it('정체는 며칠째 멈췄는지', () => {
    expect(listRow({ requirement: req(), stalledDays: 29 }).elapsed).toBe('29일째 멈춤');
  });

  it('오늘 들어온 건', () => {
    expect(listRow({ requirement: req(), stalledDays: 0 }).elapsed).toBe('오늘');
  });

  it('며칠 안 된 건', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).elapsed).toBe('3일째');
  });

  it('완료는 경과가 아니라 소요를 말한다', () => {
    const got = listRow({
      requirement: req({
        status: '완료',
        created_at: '2026-08-18T00:00:00Z',
        completed_at: '2026-08-26T00:00:00Z',
      }),
      stalledDays: null,
    });
    expect(got.elapsed).toBe('8일 걸림');
  });

  it('반려는 상태 이름을 말한다', () => {
    expect(listRow({ requirement: req({ status: '반려' }), stalledDays: null }).elapsed).toBe('반려');
  });
});

describe('listRow — 종결 사유', () => {
  it('사유 첫머리가 tail 에 들어간다', () => {
    const got = listRow({
      requirement: req({ status: '반려' }),
      closure: { reason: '위치정보 사업자 신고 선행 필요' },
    });
    expect(got.tail).toBe('위치정보 사업자 신고 선행 필요');
  });

  it('28자에서 자른다 — 행은 한 줄이라 넘치면 제목을 밀어낸다', () => {
    const got = listRow({
      requirement: req({ status: '반려' }),
      closure: { reason: '가'.repeat(50) },
    });
    expect(got.tail.length).toBe(29);
    expect(got.tail.endsWith('…')).toBe(true);
  });

  it('사유가 없으면 null', () => {
    expect(listRow({ requirement: req({ status: '반려' }) }).tail).toBeNull();
  });
});

describe('listRow — 메타와 담당자', () => {
  it('메타는 카테고리·유형·우선·요청자 순이다', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).meta).toEqual([
      '프로모션',
      '개선',
      '중',
      '박천주',
    ]);
  });

  it('빈 값은 메타에서 빠진다', () => {
    const got = listRow({
      requirement: req({ category: null, priority: null }),
      stalledDays: 3,
    });
    expect(got.meta).toEqual(['개선', '박천주']);
  });

  it('담당자가 있으면 이름과 머리글자', () => {
    const got = listRow({
      requirement: req({ assignee: { id: 'm1', name: '장재혁' } }),
      stalledDays: 3,
    });
    expect(got.assignee).toEqual({ name: '장재혁', initial: '장' });
  });

  it('담당자가 없으면 null', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).assignee).toBeNull();
  });
});

describe('listRow — 어조', () => {
  it('정체는 stall', () => {
    expect(listRow({ requirement: req(), stalledDays: 20 }).tone).toBe('stall');
  });

  it('검토대기는 wait', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).tone).toBe('wait');
  });

  it('완료는 done', () => {
    expect(listRow({ requirement: req({ status: '완료' }), stalledDays: null }).tone).toBe('done');
  });
});

describe('listRow — 빈 입력', () => {
  it('요구사항이 없어도 죽지 않는다', () => {
    const got = listRow({ requirement: null });
    expect(got.flag).toBeNull();
    expect(got.meta).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/listRow.test.js
```

Expected: FAIL — `Failed to resolve import "./listRow"`

- [ ] **Step 3: 구현한다**

`lib/listRow.js`:

```js
import { CLOSED_STATUSES, DONE_STATUS } from './statuses';
import { STALL_DAYS } from './stalled';
import { DEFAULT_CHANNEL } from './channels';

const MS_PER_DAY = 86400000;

// 종결 사유를 행에 붙일 때의 길이 상한. 행은 한 줄이라 넘치면 제목을 밀어낸다.
const MAX_TAIL = 28;

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 행 하나가 보여줄 것을 정한다.
//
// 목록의 행과 보드의 카드가 이 하나를 함께 본다. 뷰가 셋이 되면서 같은 판정이
// 세 곳에 흩어지면, 다음 개선 때 세 번 고쳐야 하고 그중 한 곳은 반드시 빠진다.
//
// requirement: 목록 API 가 내려주는 행 하나
// stalledDays: 같은 API 가 실어 보낸 값. 종결 건은 null
// closure: lib/closureReason.js 결과 또는 null
//
// 반환: { tone, flag, channelBadge, elapsed, meta, tail, assignee }
export function listRow({ requirement, stalledDays = null, closure = null } = {}) {
  if (!requirement) {
    return { tone: 'flat', flag: null, channelBadge: null, elapsed: null, meta: [], tail: null, assignee: null };
  }

  const status = requirement.status;
  const closed = CLOSED_STATUSES.includes(status);
  const assigneeId = idOf(requirement.assignee);
  const stalled = stalledDays !== null && stalledDays >= STALL_DAYS;

  return {
    tone: resolveTone({ status, closed, stalled }),
    // 정체가 담당 없음을 이긴다. 둘 다 손이 필요하지만, 20일 멈춘 건이
    // 어제 들어온 미배정 건보다 급하다.
    flag: closed ? null : stalled ? 'stall' : assigneeId ? null : 'unassigned',
    // 기본 채널은 그리지 않는다. 47건 중 44건이 자사몰이라 그 뱃지를 마흔네 번
    // 그리면 그것이 소음이 된다. 외부몰 셋만 붙으면 그 셋이 튄다.
    //
    // 비율이 바뀌면 다시 볼 자리다 — 외부몰이 늘면 "안 그린 것이 자사몰"이라는
    // 규칙을 아무도 기억하지 못한다.
    channelBadge:
      requirement.channel && requirement.channel !== DEFAULT_CHANNEL ? requirement.channel : null,
    elapsed: resolveElapsed({ requirement, status, closed, stalled, stalledDays }),
    meta: [
      requirement.category?.category_name,
      requirement.requirement_type,
      requirement.priority,
      requirement.requester?.name,
    ].filter(Boolean),
    tail: resolveTail(closure),
    assignee: assigneeId
      ? { name: requirement.assignee?.name ?? '', initial: (requirement.assignee?.name ?? '').slice(0, 1) }
      : null,
  };
}

function resolveTone({ status, closed, stalled }) {
  if (status === DONE_STATUS) return 'done';
  if (status === '반려') return 'stall';
  if (closed || status === '작성중') return 'flat';
  if (stalled) return 'stall';
  if (status === '검토대기' || status === '승인대기') return 'wait';
  return 'go';
}

// 상세의 머리 줄과 같은 규칙이다. 완료 건은 "며칠 지났나"가 아니라 "며칠
// 걸렸나"를 말한다 — 끝난 일에 경과를 붙이면 시간이 갈수록 숫자가 커져서
// 나쁜 소식처럼 읽힌다.
function resolveElapsed({ requirement, status, closed, stalled, stalledDays }) {
  if (status === DONE_STATUS) {
    const from = Date.parse(requirement.created_at ?? '');
    const to = Date.parse(requirement.completed_at ?? '');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return `${Math.floor((to - from) / MS_PER_DAY)}일 걸림`;
  }
  if (closed) return status;
  if (stalledDays === null) return null;
  if (stalled) return `${stalledDays}일째 멈춤`;
  if (stalledDays === 0) return '오늘';
  return `${stalledDays}일째`;
}

function resolveTail(closure) {
  const reason = closure?.reason?.trim();
  if (!reason) return null;
  return reason.length <= MAX_TAIL ? reason : `${reason.slice(0, MAX_TAIL)}…`;
}
```

- [ ] **Step 4: `DEFAULT_CHANNEL` 이 있는지 확인한다**

```bash
grep -n "DEFAULT_CHANNEL" lib/channels.js
```

Expected: `export const DEFAULT_CHANNEL = '자사몰';` 같은 줄. 없으면 그 파일이
export 하는 이름으로 위 import 를 맞춘다.

- [ ] **Step 5: 통과를 확인한다**

```bash
npx vitest run lib/listRow.test.js
```

Expected: `Tests 20 passed`

- [ ] **Step 6: 커밋**

```bash
git add lib/listRow.js lib/listRow.test.js
git commit -m "feat: 행 하나가 보여줄 것을 정하는 순수 함수"
```

---

## Task 2: 목록 API 가 정체를 실어 보낸다

**Files:**
- Modify: `app/api/requirements/route.js`

**서버를 바꾸는 유일한 자리다.**

정체는 `change_logs` 와 `requirement_comments` 를 봐야 나오는데 목록 API 는 그
둘을 안 읽는다. `created_at` 조차 내려보내지 않는다.

`updated_at` 으로 때우지 않는 이유: 그 값은 아홉 라우트가 갱신하는데 **코멘트가
그중에 없다.** 그러면 목록이 "15일째"라고 말하는 건을 회의 화면과 상세는
"20일째"라고 말한다. 숫자가 갈리면 둘 다 못 믿게 된다.

- [ ] **Step 1: `created_at` 을 select 에 넣는다**

`BASE_COLUMNS` 첫 줄을 바꾼다.

```js
const BASE_COLUMNS =
  'id, priority, urgency, request_date, created_at, status, title, is_confidential, sprint_tag, duplicate_count, ' +
```

`request_date` 가 아니라 `created_at` 이 필요한 이유: `stalledDays` 가 그 값을
쓰고(`lib/stalled.js`), 회의 화면도 같은 값을 본다. 둘이 갈리면 안 된다.

- [ ] **Step 2: import 와 파라미터를 더한다**

파일 상단 import 에 두 줄을 더한다.

```js
import { STALL_DAYS, groupByRequirement, stalledDays } from '@/lib/stalled';
import { closureReason } from '@/lib/closureReason';
```

`overdue` 를 읽는 줄 아래에 더한다.

```js
    const stalled = searchParams.get('stalled') === 'true';
```

- [ ] **Step 3: 정체를 계산해 실어 보낸다**

`const requirements = (data ?? []).map(...)` 부터 `return Response.json(...)` 까지를
바꾼다.

```js
    const rows = (data ?? []).map((row) => {
      const { requirement_images, ...rest } = row;
      return { ...rest, image_count: requirement_images?.[0]?.count ?? 0 };
    });

    // 정체를 여기서 계산해 실어 보낸다.
    //
    // /api/meeting 이 이미 정확히 이 모양이다. 새 방식이 아니라 같은 방식을
    // 한 곳 더 쓰는 것이다.
    //
    // .in() 에 빈 배열을 넘기면 PostgREST 가 400 을 낸다. 필터 결과가 0건인
    // 흔한 경우에 목록이 통째로 깨지는 자리다.
    const ids = rows.map((r) => r.id);
    let changeLogs = [];
    let comments = [];
    if (ids.length > 0) {
      // created_at 만 있으면 정체는 재지만 종결 사유는 못 만든다. 같은
      // 쿼리에 컬럼 셋을 더하는 것은 행이 늘지 않으므로 거의 공짜다.
      const { data: logs, error: logError } = await supabase
        .from('change_logs')
        .select('requirement_id, created_at, field_name, new_value, comment')
        .in('requirement_id', ids);
      if (logError) throw logError;
      changeLogs = logs ?? [];

      const { data: cmts, error: cmtError } = await supabase
        .from('requirement_comments')
        .select('requirement_id, created_at')
        .in('requirement_id', ids);
      if (cmtError) throw cmtError;
      comments = cmts ?? [];
    }

    const logsBy = groupByRequirement(changeLogs);
    const commentsBy = groupByRequirement(comments);
    const now = new Date().toISOString();
    const withStall = rows.map((row) => {
      const rowLogs = logsBy.get(row.id) ?? [];
      return {
        ...row,
        stalledDays: stalledDays({
          requirement: row,
          changeLogs: rowLogs,
          comments: commentsBy.get(row.id) ?? [],
          now,
        }),
        // 종결 사유. 목록을 훑는 요청자가 "반려" 세 글자만 보는 것을 막는다.
        // 상세 배너와 같은 함수를 쓰므로 문구가 갈리지 않는다.
        closure: closureReason({ requirement: row, changeLogs: rowLogs }),
      };
    });

    // '멈춘 것' 칩의 필터도 여기서 건다. 다른 칩이 전부 서버에서 걸리므로
    // (missing·overdue 는 SQL 로) 이것만 화면에서 거르면 동작이 갈린다 —
    // 칩을 눌렀는데 주소는 바뀌고 목록은 안 바뀌는 식이다.
    const requirements = stalled
      ? withStall.filter((r) => r.stalledDays !== null && r.stalledDays >= STALL_DAYS)
      : withStall;

    return Response.json({ requirements });
```

- [ ] **Step 4: 42703 폴백에도 `created_at` 이 살아 있는지 확인한다**

`BASE_COLUMNS` 를 고쳤으므로 폴백 경로도 함께 바뀐다. 폴백은 채널만 빼는
분기이므로 `created_at` 은 그대로 남는다. 확인만 한다.

```bash
grep -n "created_at" app/api/requirements/route.js
```

Expected: `BASE_COLUMNS` 안에 한 번 (폴백은 같은 상수를 쓴다)

- [ ] **Step 5: 빌드와 전체 테스트**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: 전부 통과

- [ ] **Step 6: 커밋**

```bash
git add app/api/requirements/route.js
git commit -m "feat: 목록 API 가 정체를 계산해 내려보낸다"
```

---

## Task 3: `멈춘 것` 칩

**Files:**
- Modify: `lib/quickFilters.js`
- Modify: `lib/quickFilters.test.js`

`지연`은 예상일이 지난 것이라 다른 축이고, 예상일이 있는 건이 47건 중 8건뿐이라
대부분의 정체를 못 잡는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/quickFilters.test.js` 끝에 붙인다. 파일 상단 import 는 그대로 둔다.

```js
describe('멈춘 것 칩', () => {
  const processor = { memberId: 'm1', tier: '3차' };

  it('실무자 칩 목록에 있다', () => {
    const keys = quickFilterChips(processor).map((c) => c.key);
    expect(keys).toContain('stalled');
  });

  it('요청자에게는 없다 — 남의 건이 왜 멈췄는지는 요청자가 할 일이 아니다', () => {
    const keys = quickFilterChips({ memberId: 'm2', tier: '4차' }).map((c) => c.key);
    expect(keys).not.toContain('stalled');
  });

  it('서버가 실어 보낸 stalledDays 로 센다', () => {
    const reqs = [
      { id: 'a', stalledDays: 20 },
      { id: 'b', stalledDays: 3 },
      { id: 'c', stalledDays: null },
      { id: 'd', stalledDays: 14 },
    ];
    const counts = quickFilterCounts(processor, reqs, '2026-08-28');
    expect(counts.stalled).toBe(2);
  });

  it('칩을 누르면 stalled 파라미터가 켜진다', () => {
    expect(chipParams(processor, 'stalled', null).stalled).toBe('true');
  });

  it('다시 누르면 꺼진다', () => {
    expect(chipParams(processor, 'stalled', 'stalled').stalled).toBe('');
  });

  it('다른 칩을 누르면 stalled 가 꺼진다 — 칩은 라디오다', () => {
    expect(chipParams(processor, 'unassigned', 'stalled').stalled).toBe('');
  });

  it('주소에 stalled 가 있으면 그 칩이 켜진 것으로 읽는다', () => {
    expect(activeChipKey(processor, { filters: {}, stalled: true })).toBe('stalled');
  });

  it('stalled 가 없으면 다른 칩 판정이 흔들리지 않는다', () => {
    expect(activeChipKey(processor, { filters: { missing: 'assignee' } })).toBe('unassigned');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/quickFilters.test.js
```

Expected: FAIL — `stalled` 칩이 없다

- [ ] **Step 3: 구현한다**

`lib/quickFilters.js` 를 네 군데 고친다.

첫째, 파라미터 키에 더한다.

```js
const CHIP_PARAM_KEYS = ['missing', 'assignee', 'mine', 'status', 'overdue', 'stalled'];
```

둘째, 상단 import 에 더한다.

```js
import { STALL_DAYS } from './stalled';
```

셋째, `processorChips` 의 `overdue` 칩 뒤에 더한다.

```js
    {
      // '지연'과 다른 축이다. 지연은 예상일이 지난 것인데 예상일이 있는 건이
      // 47건 중 8건뿐이라 대부분의 정체를 못 잡는다. 이 칩은 "아무도 손대지
      // 않은 채 2주가 지난 것"을 잡는다 — 회의 안건과 같은 기준이다.
      key: 'stalled',
      label: '멈춘 것',
      params: { ...EMPTY_CHIP_PARAMS, stalled: 'true' },
      // 서버가 실어 보낸 값을 그대로 센다. 화면이 다시 계산하면 change_logs 를
      // 또 받아와야 하고, 그러면 두 숫자가 갈릴 자리가 하나 더 생긴다.
      count: (reqs) =>
        reqs.filter((r) => r.stalledDays !== null && r.stalledDays !== undefined && r.stalledDays >= STALL_DAYS)
          .length,
    },
```

넷째, `activeChipKey` 가 `stalled` 를 보게 한다.

```js
export function activeChipKey(
  identity,
  { filters = {}, mine = false, overdue = false, stalled = false } = {}
) {
  for (const chip of quickFilterChips(identity)) {
    const p = chip.params;
    const matches =
      (p.missing ? filters.missing === p.missing : !filters.missing) &&
      (p.assignee ? filters.assignee === p.assignee : !filters.assignee) &&
      (p.status ? filters.status === p.status : !filters.status) &&
      Boolean(p.mine) === Boolean(mine) &&
      Boolean(p.overdue) === Boolean(overdue) &&
      Boolean(p.stalled) === Boolean(stalled);
    if (matches) return chip.key;
  }
  return null;
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run lib/quickFilters.test.js
```

Expected: 기존 것 포함 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add lib/quickFilters.js lib/quickFilters.test.js
git commit -m "feat: 멈춘 것 빠른 필터 칩"
```

---

## Task 4: `RequirementRows` — 목록(행) 뷰

**Files:**
- Create: `components/RequirementRows.jsx`

- [ ] **Step 1: 만든다**

```jsx
'use client';

import Link from 'next/link';
import { StatusDot } from '@/components/ui/StatusDot';
import { listRow } from '@/lib/listRow';
import { closureReason } from '@/lib/closureReason';

// 목록(행) 뷰.
//
// 표를 대신하는 것이 아니라 나란히 두는 것이다. 표는 비교하려는 사람의 것이고
// 이쪽은 훑으려는 사람의 것이다.
//
// 한 줄 40px 을 지킨다. 두 줄이 되면 세로 리듬이 깨져 훑기가 느려지고, 47건이
// 한 화면에 안 들어온다.
//
// props: requirements, emptyState
export function RequirementRows({ requirements = [], emptyState }) {
  if (requirements.length === 0) return emptyState ?? null;

  return (
    <ul className="flex flex-col rounded-lg border border-slate-200 bg-white">
      {requirements.map((r) => {
        // 정체와 종결 사유는 목록 API 가 계산해 실어 보낸다(Task 2).
        // 화면이 다시 계산하면 두 숫자가 갈릴 자리가 하나 더 생긴다.
        const row = listRow({ requirement: r, stalledDays: r.stalledDays, closure: r.closure });
        const bar =
          row.flag === 'stall'
            ? 'border-l-rose-400'
            : row.flag === 'unassigned'
              ? 'border-l-amber-400'
              : 'border-l-transparent';
        return (
          <li key={r.id} className={`border-b border-l-2 border-slate-100 ${bar} last:border-b-0`}>
            <Link
              href={`/requirements/${r.id}`}
              className="flex min-h-10 items-center gap-3 px-3 py-1.5 hover:bg-slate-50"
            >
              <span className="w-20 shrink-0">
                <StatusDot status={r.status} tone={row.tone} />
              </span>
              {row.channelBadge && (
                <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">
                  {row.channelBadge}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{r.title}</span>
              <span className="hidden shrink-0 text-[11.5px] text-slate-400 md:block">
                {row.meta.join(' · ')}
                {row.elapsed && (
                  <span className={row.flag === 'stall' ? 'text-rose-600' : ''}>
                    {row.meta.length > 0 ? ' · ' : ''}
                    {row.elapsed}
                  </span>
                )}
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] ${
                  row.assignee
                    ? 'bg-slate-200 text-slate-600'
                    : 'border border-dashed border-slate-300 text-slate-300'
                }`}
                title={row.assignee?.name ?? '담당자 없음'}
              >
                {row.assignee?.initial ?? '＋'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

`closureReason` import 는 지운다 — 사유는 서버가 계산해 `r.closure` 로 실어
보내므로 화면에서 다시 만들 필요가 없다.

메타 오른쪽에 사유를 잇는다.

```jsx
                {row.tail && <span className="text-slate-500"> · {row.tail}</span>}
```

- [ ] **Step 2: 빌드**

```bash
npm run lint && npm run build
```

Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add components/RequirementRows.jsx
git commit -m "feat: 목록(행) 뷰"
```

---

## Task 5: 뷰 토글을 셋으로

**Files:**
- Modify: `components/RequirementViewToggle.jsx`

지금 "목록"이 표를 가리킨다. 이름을 다시 짠다 — 목록(행) · 표 · 보드.

- [ ] **Step 1: 고친다**

```jsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// 목록 ↔ 표 ↔ 보드 전환. 세 화면 모두에 같은 모양으로 놓는다.
//
// 이름을 다시 짰다. 예전에는 표를 '목록'이라 불렀는데, 행 기반이 들어오면서
// 둘이 무엇이 다른지 알 수 없게 됐다. 지금 표를 '표'라고 부르는 것이 정직하다.
//
// 표를 별도 주소가 아니라 쿼리로 두는 이유: 목록과 표는 같은 페이지의 다른
// 렌더다. 필터·검색·정렬·기억이 전부 같고 데이터도 같다. 주소를 나누면 그
// 전부를 두 벌로 들고 다녀야 한다.
//
// 현재 쿼리스트링을 그대로 들고 넘어간다. 이게 없으면 목록에서 걸어 둔 필터가
// 넘어가는 순간 사라져서, 뷰 전환처럼 생긴 버튼이 실제로는 초기화 버튼이 된다.
export function RequirementViewToggle({ current }) {
  const params = new URLSearchParams(useSearchParams().toString());
  params.delete('view');
  const rest = params.toString();
  const join = (extra) => {
    const merged = [rest, extra].filter(Boolean).join('&');
    return merged ? `?${merged}` : '';
  };
  return (
    <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
      <ToggleLink href={`/requirements${join('')}`} active={current === 'list'}>
        목록
      </ToggleLink>
      <ToggleLink href={`/requirements${join('view=table')}`} active={current === 'table'}>
        표
      </ToggleLink>
      <ToggleLink href={`/requirements/board${join('')}`} active={current === 'board'}>
        보드
      </ToggleLink>
    </div>
  );
}

function ToggleLink({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1 text-sm transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: 보드가 `current` 를 무엇으로 넘기는지 확인한다**

```bash
grep -n "RequirementViewToggle" app/requirements/board/page.js app/requirements/page.js
```

보드는 `current="board"` 여야 하고, 목록 페이지는 `view` 값에 따라 `"list"`
또는 `"table"` 을 넘겨야 한다. 목록 페이지 쪽은 Task 6 에서 고친다.

- [ ] **Step 3: 빌드**

```bash
npm run build
```

Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add components/RequirementViewToggle.jsx
git commit -m "feat: 뷰 토글을 목록·표·보드 셋으로"
```

---

## Task 6: 목록 페이지가 뷰를 가른다

**Files:**
- Modify: `app/requirements/page.js`
- Modify: `lib/filterMemory.js`

- [ ] **Step 1: 뷰를 기억 대상에 넣는다**

`lib/filterMemory.js` 의 `packFilterMemory` 를 고친다.

```js
export function packFilterMemory({ filters = {}, mine = false, includeDone = false, sort, view } = {}) {
  const packed = { filters: {}, mine: Boolean(mine), includeDone: Boolean(includeDone) };
  for (const key of FILTER_KEYS) {
    if (filters[key]) packed.filters[key] = String(filters[key]);
  }
  if (sort?.key) packed.sort = { key: sort.key, dir: sort.dir === 'asc' ? 'asc' : 'desc' };
  // 뷰도 기억한다. 표를 쓰던 사람이 매번 다시 누르게 하면 그건 선택권이 아니다.
  if (view === 'table') packed.view = 'table';
  return packed;
}
```

`unpackFilterMemory` 의 화이트리스트에도 `view` 를 더한다. 그 함수가 어떤
모양으로 거르는지 보고 같은 방식으로 넣는다.

```bash
grep -n "export function unpackFilterMemory" -A 20 lib/filterMemory.js
```

값은 `'table'` 하나만 통과시킨다 — 목록이 기본이므로 저장할 필요가 없고,
모르는 값이 주소에 실리면 안 된다.

- [ ] **Step 2: 페이지가 `view` 를 읽고 가른다**

`app/requirements/page.js` 에 더한다. `useSearchParams` 는 이미 쓰고 있다.

```js
  // 'table' 하나만 받는다. 목록이 기본이라 주소에 아무것도 없는 상태가
  // 곧 목록이다.
  const view = searchParams.get('view') === 'table' ? 'table' : 'list';
```

`RequirementViewToggle` 호출을 고친다.

```jsx
        <RequirementViewToggle current={view} />
```

`RequirementList` 자리를 가른다.

```jsx
        {view === 'table' ? (
          <RequirementList
            /* 지금 넘기던 props 를 그대로 둔다 */
          />
        ) : (
          <RequirementRows
            requirements={requirements}
            emptyState={/* RequirementList 가 쓰던 빈 화면과 같은 것 */}
          />
        )}
```

빈 화면은 `RequirementList` 안에 있으므로(`아직 등록된 요구사항이 없습니다`),
그대로 쓰려면 그 JSX 를 페이지로 올리거나 두 컴포넌트가 함께 쓰는 작은
컴포넌트로 뺀다. **뺀다** — 두 뷰가 다른 빈 화면을 보여주면 안 된다.

`components/RequirementEmpty.jsx` 를 만들고 `RequirementList` 의 그 블록을
그대로 옮긴 뒤, 두 곳에서 부른다.

- [ ] **Step 3: `stalled` 를 API 로 넘긴다**

목록을 부르는 fetch 의 쿼리스트링에 `stalled` 를 더한다. `overdue` 를 넘기는
줄 옆에 같은 모양으로 넣는다.

```bash
grep -n "overdue" app/requirements/page.js
```

그 자리들을 보고 `stalled` 도 같은 흐름에 태운다 — `useRequirementFilters` 가
주소를 들고 있으므로 그쪽에서도 `stalled` 를 읽어야 한다.

```bash
grep -n "overdue" components/useRequirementFilters.js lib/requirementFilters.js
```

`overdue` 가 지나가는 모든 자리에 `stalled` 를 같은 방식으로 더한다.

- [ ] **Step 4: `activeChipKey` 에 `stalled` 를 넘긴다**

```jsx
  const activeKey = activeChipKey(identity, {
    filters: { ...filters, missing },
    mine,
    overdue,
    stalled,
  });
```

- [ ] **Step 5: 전체 검사**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: 전부 통과

- [ ] **Step 6: 손으로 확인한다**

개발 서버를 띄우고 `/requirements` 를 연다.

1. 기본이 목록(행)인가
2. `표` 를 누르면 지금의 11칸이 나오고 주소에 `?view=table` 이 붙는가
3. 필터를 걸고 뷰를 바꿨을 때 필터가 유지되는가
4. 새로고침했을 때 마지막에 고른 뷰로 열리는가
5. `멈춘 것` 칩을 누르면 목록이 줄고 건수가 맞는가
6. 정체 14일 넘은 줄에 붉은 막대가 있는가

- [ ] **Step 7: 커밋**

```bash
git add app/requirements/page.js lib/filterMemory.js components/RequirementEmpty.jsx components/RequirementList.jsx
git commit -m "feat: 목록 페이지가 목록·표를 가른다"
```

---

## Task 7: 보드 카드가 같은 언어를 쓴다

**Files:**
- Modify: `components/KanbanBoard.jsx`

지금 보드 카드에는 정체 표시도, 담당자 아바타도, 채널 뱃지도 없다.

**컬럼과 드래그는 손대지 않는다.**

- [ ] **Step 1: 카드가 무엇을 그리는지 본다**

```bash
grep -n "title\|assignee\|priority\|className" components/KanbanBoard.jsx | head -30
```

- [ ] **Step 2: `listRow` 를 쓰게 한다**

카드 컴포넌트 안에서 부른다.

```jsx
import { listRow } from '@/lib/listRow';

// 카드 안
const row = listRow({ requirement: r, stalledDays: r.stalledDays });
```

카드에 더할 것은 셋이다.

```jsx
{/* 왼쪽 막대 — 손이 필요한 카드. 목록의 행과 같은 규칙이다. */}
className={`... border-l-2 ${
  row.flag === 'stall' ? 'border-l-rose-400'
  : row.flag === 'unassigned' ? 'border-l-amber-400'
  : 'border-l-transparent'
}`}

{/* 채널 뱃지 — 자사몰이 아닐 때만 */}
{row.channelBadge && (
  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
    {row.channelBadge}
  </span>
)}

{/* 경과와 담당자 */}
<div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
  <span className={row.flag === 'stall' ? 'text-rose-600' : ''}>{row.elapsed}</span>
  <span
    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9.5px] ${
      row.assignee ? 'bg-slate-200 text-slate-600' : 'border border-dashed border-slate-300 text-slate-300'
    }`}
    title={row.assignee?.name ?? '담당자 없음'}
  >
    {row.assignee?.initial ?? '＋'}
  </span>
</div>
```

메타 전체는 넣지 않는다 — 카드가 좁아 들어가지 않는다.

- [ ] **Step 3: 보드가 `stalledDays` 를 받는지 확인한다**

보드도 `GET /api/requirements` 를 쓰므로 Task 2 이후 자동으로 실린다.

```bash
grep -n "api/requirements" app/requirements/board/page.js
```

다른 라우트를 쓴다면 그쪽에도 같은 계산을 넣어야 한다. 그 경우 Task 2 의
코드를 그대로 옮긴다.

- [ ] **Step 4: 빌드와 확인**

```bash
npm run lint && npm run build
```

개발 서버에서 `/requirements/board` 를 열어 카드에 막대·경과·아바타가 있는지 본다.

- [ ] **Step 5: 커밋**

```bash
git add components/KanbanBoard.jsx
git commit -m "feat: 보드 카드가 목록과 같은 언어를 쓴다"
```

---

## Task 8: 상세 중복처리

**Files:**
- Modify: `components/RequirementDetail.jsx`

`RequirementStatusActions` 에 `onMerge` 슬롯이 이미 있다. 상세에 병합 기능이
없어 넘기지 않고 비워 뒀던 자리다.

- [ ] **Step 1: import 와 상태를 더한다**

```js
import { MergeDialog } from '@/components/MergeDialog';
```

다른 `useState` 옆에:

```js
  // 병합은 목록·보드·프로젝트에만 있었다. 상세를 열어 읽다가 "이거 아까
  // 그거네" 하고 처리할 길이 없었다.
  const [mergeOpen, setMergeOpen] = useState(false);
```

- [ ] **Step 2: `actionProps` 에 넘긴다**

```js
    onEdit: canEdit && !showEditForm ? () => setEditing(true) : null,
    // 3차 이상만. RequirementStatusActions 가 종결 상태에서는 메뉴 자체를
    // 감추므로 여기서 또 걸지 않는다.
    onMerge: processAllowed ? () => setMergeOpen(true) : null,
```

- [ ] **Step 3: 창을 붙인다**

다른 다이얼로그들 옆에:

```jsx
      {/* 병합하면 이 건이 '중복'이 되고 mergedInto 배너가 뜬다. 목록·보드가
          쓰는 것을 그대로 쓴다 — 병합 규칙이 두 곳으로 갈리면 한쪽만 고쳐진다. */}
      {mergeOpen && (
        <MergeDialog
          source={r}
          onClose={() => setMergeOpen(false)}
          onMerged={() => {
            setMergeOpen(false);
            load();
          }}
        />
      )}
```

- [ ] **Step 4: `r` 이 `brand_id` 를 갖는지 확인한다**

`MergeDialog` 는 `source.brand_id ?? identity.brandId` 를 쓴다. 상세 API 가
`brand_id` 를 내려주는지 본다.

```bash
grep -n "brand_id" app/api/requirements/\[id\]/route.js | head -3
```

없으면 `source={{ ...r, brand_id: requirementBrandId }}` 로 넘긴다 —
`requirementBrandId` 는 이 파일이 이미 갖고 있다.

- [ ] **Step 5: 빌드와 확인**

```bash
npx vitest run && npm run lint && npm run build
```

개발 서버에서 요구사항 하나를 열고 `▾` 메뉴에 `중복 병합` 이 있는지, 눌러서
창이 뜨는지 본다. 병합 후 배너가 뜨는지도 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add components/RequirementDetail.jsx
git commit -m "feat: 상세에서 중복 병합"
```

---

## Task 9: 손으로 확인하고 배포한다

**Files:** 없음

- [ ] **Step 1: 세 뷰를 돌아본다**

개발 서버에서 확인한다.

| 화면 | 볼 것 |
|---|---|
| 목록 | 제목이 안 잘리는가 · 붉은/노란 막대가 맞는 줄에 있는가 · 외부몰 3건에만 뱃지가 있는가 |
| 표 | 지금과 똑같은가 (손대지 않았으므로) |
| 보드 | 카드에 막대·경과·아바타가 있는가 · 드래그가 그대로 되는가 |

- [ ] **Step 2: 뷰 기억을 확인한다**

`표` 를 고르고 다른 화면에 갔다가 `/requirements` 로 돌아온다. 표로 열려야 한다.

- [ ] **Step 3: `멈춘 것` 칩을 확인한다**

칩 건수와 걸린 뒤의 목록 건수가 같아야 한다. 그리고 **회의 화면(`/meeting`)의
`14일+ 멈춤` 숫자와 같아야 한다** — 다르면 둘 중 하나가 틀린 것이다.

- [ ] **Step 4: 4차 계정으로 확인한다**

요청자에게는 `멈춘 것` 칩이 안 보여야 하고, 상세 `▾` 메뉴에 `중복 병합` 이
없어야 한다.

- [ ] **Step 5: 배포 ZIP**

```bash
npm run package:src
```

`package:src` 여야 한다. `npm run package` 는 빌드 완료본이라 플랫폼이 소스에서
다시 빌드하는 지금 방식에서는 실패한다.

- [ ] **Step 6: 배포**

마이그레이션은 없다. ZIP 만 올린다.

- [ ] **Step 7: 사용자에게 보고할 것**

배포 후 반드시 전한다.

1. **기본 뷰가 바뀐다.** 목록(행)이 기본이고, 표를 쓰던 사람은 한 번 눌러야
   한다. 실사용자가 넷이라 금방 끝나지만 놀랄 수 있는 변화다.
2. **목록에도 반려 사유가 뜬다.** 반려·취소된 건의 사유 첫머리가 메타 끝에
   붙는다. 목록을 훑는 요청자가 "반려" 세 글자만 보던 것이 바뀐다.

---

## 자체 점검

**스펙 대응**

| 스펙 절 | 태스크 |
|---|---|
| 1. 뷰 이름 | 5 |
| 2. 목록(행) 뷰 | 1 · 4 |
| 3. 세 뷰가 같은 조각 | 1 · 4 · 7 |
| 4. 보드 | 7 |
| 5. 표 (손대지 않음) | — |
| 6. 기본 뷰와 기억 | 6 |
| 7. `멈춘 것` 칩 | 3 |
| 8. 상세 중복처리 | 8 |
| 9. 서버 | 2 |
| 테스트 | 1 · 3 |

**점검하며 고친 것 하나**

처음 쓸 때는 "목록에 반려 사유가 안 뜬다"고 적고 제약으로 남겼다. 정체 계산에
쓰는 `change_logs` select 가 `requirement_id, created_at` 뿐이라 사유가 없었다.

다시 보니 **같은 쿼리에 컬럼 셋(`field_name`·`new_value`·`comment`)을 더하면
된다.** 행이 늘지 않으므로 거의 공짜다. 스펙과 어긋난 채로 배포하는 것보다 이쪽이
맞아서 Task 2 를 고쳤다.

**남는 위험**

Task 6 이 가장 크다. `stalled` 파라미터가 `useRequirementFilters` ·
`requirementFilters` · `filterMemory` 를 지나가야 하는데, 이 계획은 `overdue`
가 지나가는 자리를 `grep` 으로 찾아 같은 방식으로 넣으라고만 적었다. 그 파일들의
실제 코드를 확인하지 못했으므로, 구현할 때 `overdue` 를 따라가며 한 곳도
빠뜨리지 않는지 확인해야 한다. 한 곳이라도 빠지면 **칩을 눌렀는데 주소만 바뀌고
목록은 그대로인** 증상이 난다.
