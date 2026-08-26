# 회의 중심 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 목요일 주간회의를 MOA 의 중심에 놓아, 검토대기에 고인 건들이 회의에서 배정되고 그 결과가 요청자에게 돌아가게 한다.

**Architecture:** 판정 로직은 전부 `lib/` 의 순수 함수로 두고 DB 접근과 분리한다(`stalled` → `meetingDigest` → `meetingSession` 순으로 쌓인다). 화면과 메일은 그 함수들의 결과를 그리기만 한다. 담당자·예상일 저장은 기존 라우트를 그대로 부르고 새 엔드포인트를 만들지 않는다.

**Tech Stack:** Next.js 16 App Router (JS), React 19, Tailwind v4, shadcn/ui on base-ui, Supabase Postgres, Vitest, nodemailer

설계 문서: `docs/superpowers/specs/2026-08-26-meeting-centric-design.md`

---

## 스펙에서 바로잡은 것

계획을 세우며 코드를 확인한 결과 스펙의 두 문장이 틀렸다. 여기서 고친다.

**1. 담당자 변경은 `PATCH /api/requirements/[id]` 가 아니다.** 전용 라우트
`PATCH /api/requirements/[id]/assignee` 가 따로 있고, **그 라우트는 change_logs 에
아무것도 남기지 않는다.** 스펙은 "`change_type='내용수정'` 으로 뭉뚱그려 남는다"고
적었는데 그보다 나쁘다 — 기록 자체가 없다. 운영 로그 72건에 담당자 변경이 한 줄도
없는 이유가 이것이다.

이것은 `stalled` 계산에도 영향을 준다. 어제 담당자를 배정한 건이 로그가 없어서
"20일째 아무도 안 건드린 건"으로 잡힌다. Task 1 이 첫 번째인 이유다.

**2. 알 수 없는 `change_type` 은 활동 피드에서 깨져 보인다.**
`components/ActivityFeed.jsx:209` 의 분기는 `'내용수정'`·`'중복병합'`·`'예상일변경'`
만 알고, 나머지는 전부 `상태를 {old}→{new}로 변경` 으로 그린다. `'담당자지정'` 을
추가하면서 그 분기도 같이 고쳐야 한다. 안 고치면 "상태를 null→장재혁로 변경"이
뜬다.

그래서 `old_value`/`new_value` 에는 **id 가 아니라 이름**을 넣는다. 예상일변경이
날짜 문자열을, 상태변경이 상태 이름을 그대로 넣는 것과 같은 규칙이다.

---

## 파일 구조

**새로 만드는 것**

| 파일 | 책임 |
|---|---|
| `lib/stalled.js` | 요구사항 하나가 며칠 멈췄는지. 순수 함수 |
| `lib/stalled.test.js` | 위 테스트 |
| `lib/meetingDigest.js` | 회의 메일 세 블록을 만든다. 순수 함수 |
| `lib/meetingDigest.test.js` | 위 테스트 |
| `lib/meetingSession.js` | 배정 로그를 요청자별로 묶는다. 순수 함수 |
| `lib/meetingSession.test.js` | 위 테스트 |
| `supabase/migrations/0024_meeting_sessions.sql` | 회의 세션 테이블 |
| `app/api/meeting/route.js` | 회의 화면 데이터 (GET) |
| `app/api/meeting/end/route.js` | 회의 마치기 (POST) |
| `app/api/cron/meeting-digest/route.js` | 수요일 메일 크론 (POST) |
| `app/meeting/page.js` | 회의 화면 (게이팅만) |
| `components/MeetingBoard.jsx` | 회의 화면 본체 |

**고치는 것**

| 파일 | 무엇을 |
|---|---|
| `app/api/requirements/[id]/assignee/route.js` | 담당자 변경 change_log 추가 |
| `components/ActivityFeed.jsx` | `'담당자지정'` 렌더 분기 추가 |
| `lib/emailContent.js` | `meetingDigestEmail`, `assignedBatchEmail` 추가 |
| `lib/notify.js` | `sendMeetingDigest`, `notifyMeetingAssignments` 추가 |
| `components/TopBar.jsx` | `/meeting` 링크 (3차 이상) |

---

## Task 1: 담당자 변경을 change_log 에 남긴다

**Files:**
- Modify: `app/api/requirements/[id]/assignee/route.js`
- Modify: `components/ActivityFeed.jsx:202-217`

이 태스크에는 순수 함수가 없어 단위 테스트를 붙이지 않는다. 검증은 빌드와 수동
확인이다 — 라우트 전체를 목킹하는 테스트는 이 프로젝트에 선례가 없고, 목킹
비용이 얻는 것보다 크다.

- [ ] **Step 1: 라우트에 로그를 추가한다**

`app/api/requirements/[id]/assignee/route.js` 의 `update` 직후, `notifyAssigneeChange`
호출 앞에 아래를 넣는다. 파일 상단 import 는 그대로 둔다.

```js
    // 담당자 변경을 감사 기록에 남긴다.
    //
    // 지금까지 이 라우트는 아무 로그도 남기지 않았다. 그래서 change_logs 만
    // 봐서는 담당자가 언제 누구로 정해졌는지 알 수 없고, '마지막 활동'
    // 계산에서도 배정이 통째로 빠진다 — 어제 배정한 건이 20일 멈춘 것으로
    // 잡힌다.
    //
    // change_type 을 '내용수정'과 나누는 이유: 회의 마치기가 "이 회의에서
    // 배정된 건"을 찾아야 하는데 '내용수정'은 field_name 없이 여러 필드를
    // 뭉뚱그린다.
    //
    // old/new 에 id 가 아니라 이름을 넣는다. 상태변경이 상태 이름을,
    // 예상일변경이 날짜 문자열을 그대로 넣는 것과 같은 규칙이고, 활동 피드가
    // 그 값을 그대로 그린다.
    if ((assignee || null) !== (current.assignee || null)) {
      const ids = [current.assignee, assignee].filter(Boolean);
      const names = new Map();
      if (ids.length > 0) {
        const { data: people } = await supabase
          .from('team_members')
          .select('id, name')
          .in('id', ids);
        for (const p of people ?? []) names.set(p.id, p.name);
      }
      const { error: logError } = await supabase.from('change_logs').insert({
        requirement_id: id,
        brand_id: brandId,
        changed_by: memberId,
        change_type: '담당자지정',
        field_name: 'assignee',
        old_value: current.assignee ? (names.get(current.assignee) ?? null) : null,
        new_value: assignee ? (names.get(assignee) ?? null) : null,
      });
      if (logError) throw logError;
    }
```

- [ ] **Step 2: 활동 피드가 이 종류를 그리게 한다**

`components/ActivityFeed.jsx` 의 `ChangeEntry` 안에서 `'예상일변경'` 삼항을 아래로
바꾼다.

```jsx
            {h.change_type === '예상일변경'
              ? `배포예상일을 ${h.old_value ?? '미정'}→${h.new_value ?? '미정'}(으)로 변경`
              : h.change_type === '담당자지정'
                ? `담당자를 ${h.old_value ?? '없음'}→${h.new_value ?? '없음'}(으)로 변경`
                : `상태를 ${h.old_value}→${h.new_value}로 변경`}
```

이 분기를 빼먹으면 "상태를 null→장재혁로 변경"이 뜬다. 마지막 `else` 가 상태변경을
가정하고 있기 때문이다.

- [ ] **Step 3: 기존 테스트가 깨지지 않는지 확인**

```bash
npx vitest run
```

Expected: `Test Files 43 passed`, `Tests 591 passed`

- [ ] **Step 4: 빌드 확인**

```bash
npm run lint && npm run build
```

Expected: lint 오류 0 (기존 `<img>` 경고 2건은 그대로), 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add app/api/requirements/[id]/assignee/route.js components/ActivityFeed.jsx
git commit -m "fix: 담당자 변경을 change_logs 에 남긴다"
```

---

## Task 2: `lib/stalled.js` — 정체 판정

**Files:**
- Create: `lib/stalled.js`
- Create: `lib/stalled.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/stalled.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { STALL_DAYS, groupByRequirement, lastActivityAt, stalledDays } from './stalled';

const NOW = '2026-08-26T00:00:00Z';
const req = (over = {}) => ({
  id: 'r1',
  status: '검토대기',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
});

describe('lastActivityAt', () => {
  it('로그도 코멘트도 없으면 생성 시각', () => {
    expect(lastActivityAt({ requirement: req() })).toBe('2026-08-01T00:00:00Z');
  });

  it('변경 로그가 있으면 그중 가장 나중', () => {
    const got = lastActivityAt({
      requirement: req(),
      changeLogs: [{ created_at: '2026-08-05T00:00:00Z' }, { created_at: '2026-08-10T00:00:00Z' }],
    });
    expect(got).toBe('2026-08-10T00:00:00Z');
  });

  it('코멘트가 로그보다 나중이면 코멘트 시각', () => {
    const got = lastActivityAt({
      requirement: req(),
      changeLogs: [{ created_at: '2026-08-10T00:00:00Z' }],
      comments: [{ created_at: '2026-08-20T00:00:00Z' }],
    });
    expect(got).toBe('2026-08-20T00:00:00Z');
  });

  it('읽을 수 없는 시각은 무시한다', () => {
    const got = lastActivityAt({
      requirement: req(),
      changeLogs: [{ created_at: null }, { created_at: '깨진값' }],
    });
    expect(got).toBe('2026-08-01T00:00:00Z');
  });
});

describe('stalledDays', () => {
  it('마지막 활동 이후 경과일', () => {
    expect(stalledDays({ requirement: req(), now: NOW })).toBe(25);
  });

  it('종결 상태는 정체가 아니다', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(stalledDays({ requirement: req({ status }), now: NOW })).toBeNull();
    }
  });

  it('경계: 정확히 STALL_DAYS 는 안건에 든다', () => {
    const created = '2026-08-12T00:00:00Z';
    expect(stalledDays({ requirement: req({ created_at: created }), now: NOW })).toBe(STALL_DAYS);
  });

  it('요구사항이 없으면 null', () => {
    expect(stalledDays({ requirement: null, now: NOW })).toBeNull();
  });
});

describe('groupByRequirement', () => {
  it('requirement_id 로 묶는다', () => {
    const got = groupByRequirement([
      { requirement_id: 'a', created_at: '1' },
      { requirement_id: 'b', created_at: '2' },
      { requirement_id: 'a', created_at: '3' },
    ]);
    expect(got.get('a')).toHaveLength(2);
    expect(got.get('b')).toHaveLength(1);
  });

  it('id 없는 행은 버린다', () => {
    expect(groupByRequirement([{ created_at: '1' }]).size).toBe(0);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(groupByRequirement(null).size).toBe(0);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/stalled.test.js
```

Expected: FAIL — `Failed to resolve import "./stalled"`

- [ ] **Step 3: 구현한다**

`lib/stalled.js`:

```js
import { CLOSED_STATUSES } from './statuses';

// 안건이 되는 기준일.
//
// 7일로 잡으면 미완료 38건 중 27건이 걸려 안건이 아니라 목록이 된다. 14일은
// "회의를 이미 한 번 그냥 지나쳤다"는 뜻이라 안건 자격이 있고, 실데이터에서
// 13건이 나온다 — 한 시간짜리 회의가 다룰 수 있는 크기다.
export const STALL_DAYS = 14;

const MS_PER_DAY = 86400000;

// requirement_id 로 묶는다. 변경 로그와 코멘트를 한 번에 읽어 와서 건마다
// 나눠 주는 용도라, 부르는 쪽마다 같은 루프를 다시 쓰지 않게 여기 둔다.
export function groupByRequirement(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = row?.requirement_id;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

// 마지막으로 무언가 일어난 시각(ISO 문자열).
//
// 세 곳을 본다: 생성 시각, 마지막 변경 로그, 마지막 코멘트.
//
// 코멘트를 빼면 안 된다. 운영 데이터에 코멘트가 42건 달려 있고, 논의가 활발한
// 건이 "아무도 안 건드린 건"으로 잡히면 안건이 오염된다. 회의에서 이미 얘기가
// 오가는 중인 건을 "20일째 방치"라고 들이미는 셈이다.
export function lastActivityAt({ requirement, changeLogs = [], comments = [] } = {}) {
  const raw = [
    requirement?.created_at,
    ...(changeLogs ?? []).map((l) => l?.created_at),
    ...(comments ?? []).map((c) => c?.created_at),
  ];
  let best = null;
  let bestMs = -Infinity;
  for (const value of raw) {
    const ms = Date.parse(value ?? '');
    // 읽을 수 없는 시각은 버린다. NaN 을 비교에 넣으면 전부 false 가 되어
    // 조용히 첫 값이 남는다 — 한 행이 망가졌을 뿐인데 결과가 통째로 틀린다.
    if (!Number.isFinite(ms) || ms <= bestMs) continue;
    best = value;
    bestMs = ms;
  }
  return best;
}

// 마지막 활동 이후 며칠 지났나. 종결 건은 null.
//
// null 은 "정체가 아니다"라는 뜻이지 "모른다"가 아니다. 완료·반려·취소·중복은
// 멈춘 게 아니라 끝난 것이라 회의 안건이 될 수 없다. 실제로 20일 넘은 16건 중
// 3건이 반려·중복이고, 이 규칙 하나로 안건이 13건으로 줄어든다.
export function stalledDays({ requirement, changeLogs = [], comments = [], now } = {}) {
  if (!requirement || CLOSED_STATUSES.includes(requirement.status)) return null;
  const from = Date.parse(lastActivityAt({ requirement, changeLogs, comments }) ?? '');
  const to = Date.parse(now ?? '');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.floor((to - from) / MS_PER_DAY);
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run lib/stalled.test.js
```

Expected: `Tests 11 passed`

- [ ] **Step 5: 커밋**

```bash
git add lib/stalled.js lib/stalled.test.js
git commit -m "feat: 정체 판정 순수 함수"
```

---

## Task 3: `lib/meetingDigest.js` — 회의 메일 세 블록

**Files:**
- Create: `lib/meetingDigest.js`
- Create: `lib/meetingDigest.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/meetingDigest.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { TOP_N, buildMeetingDigest } from './meetingDigest';

const NOW = '2026-08-26T00:00:00Z';
// 26일 전. 손대지 않으면 정체 건이 된다.
const OLD = '2026-07-31T00:00:00Z';
const req = (over = {}) => ({
  id: 'r1',
  title: '제목',
  status: '검토대기',
  created_at: OLD,
  assignee: null,
  ...over,
});

describe('buildMeetingDigest — 멈춘 것', () => {
  it('담당 없는 건이 담당 있는 건보다 앞에 온다 — 덜 멈쳤더라도', () => {
    const digest = buildMeetingDigest({
      requirements: [
        req({ id: 'old', title: '오래됨', created_at: '2026-07-01T00:00:00Z', assignee: 'm1' }),
        req({ id: 'fresh', title: '덜오래됨', created_at: OLD, assignee: null }),
      ],
      now: NOW,
    });
    expect(digest.stalled.items.map((i) => i.id)).toEqual(['fresh', 'old']);
  });

  it('담당 유무가 같으면 오래 멈춘 순', () => {
    const digest = buildMeetingDigest({
      requirements: [
        req({ id: 'b', created_at: OLD }),
        req({ id: 'a', created_at: '2026-07-01T00:00:00Z' }),
      ],
      now: NOW,
    });
    expect(digest.stalled.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('14일 미만은 안건이 아니다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ created_at: '2026-08-20T00:00:00Z' })],
      now: NOW,
    });
    expect(digest.stalled.count).toBe(0);
  });

  it('종결 건은 안건이 아니다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ status: '반려' }), req({ id: 'r2', status: '중복' })],
      now: NOW,
    });
    expect(digest.stalled.count).toBe(0);
  });

  it('코멘트가 최근이면 안건이 아니다', () => {
    const digest = buildMeetingDigest({
      requirements: [req()],
      comments: [{ requirement_id: 'r1', created_at: '2026-08-25T00:00:00Z' }],
      now: NOW,
    });
    expect(digest.stalled.count).toBe(0);
  });

  it('상위 다섯만 펴고 나머지는 센다', () => {
    const requirements = Array.from({ length: 8 }, (_, i) => req({ id: `r${i}` }));
    const digest = buildMeetingDigest({ requirements, now: NOW });
    expect(digest.stalled.count).toBe(8);
    expect(digest.stalled.items).toHaveLength(TOP_N);
    expect(digest.stalled.more).toBe(3);
  });

  it('담당 없는 건수를 따로 센다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ id: 'a' }), req({ id: 'b', assignee: 'm1' })],
      now: NOW,
    });
    expect(digest.stalled.unassigned).toBe(1);
  });
});

describe('buildMeetingDigest — 신규와 움직인 것', () => {
  it('지난 7일 안에 생긴 건이 신규', () => {
    const digest = buildMeetingDigest({
      requirements: [
        req({ id: 'new', created_at: '2026-08-24T00:00:00Z' }),
        req({ id: 'old', created_at: OLD }),
      ],
      now: NOW,
    });
    expect(digest.incoming.items.map((i) => i.id)).toEqual(['new']);
  });

  it("움직인 것은 field_name='status' 로만 거른다 — 중복병합도 잡힌다", () => {
    const digest = buildMeetingDigest({
      requirements: [req({ id: 'a' }), req({ id: 'b' }), req({ id: 'c' })],
      changeLogs: [
        { requirement_id: 'a', field_name: 'status', created_at: '2026-08-25T00:00:00Z' },
        {
          requirement_id: 'b',
          field_name: 'status',
          change_type: '중복병합',
          created_at: '2026-08-25T00:00:00Z',
        },
        {
          requirement_id: 'c',
          field_name: 'expected_release_date',
          created_at: '2026-08-25T00:00:00Z',
        },
      ],
      now: NOW,
    });
    expect(digest.moved.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('지난 7일 밖의 상태 변경은 안 센다', () => {
    const digest = buildMeetingDigest({
      requirements: [req()],
      changeLogs: [
        { requirement_id: 'r1', field_name: 'status', created_at: '2026-08-01T00:00:00Z' },
      ],
      now: NOW,
    });
    expect(digest.moved.count).toBe(0);
  });
});

describe('buildMeetingDigest — 보낼 값어치', () => {
  it('안건도 신규도 없으면 안 보낸다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ status: '완료' })],
      now: NOW,
    });
    expect(digest.hasContent).toBe(false);
  });

  it('움직인 것만 있으면 안 보낸다 — 잘 굴러간 주다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ id: 'a', status: '완료' })],
      changeLogs: [
        { requirement_id: 'a', field_name: 'status', created_at: '2026-08-25T00:00:00Z' },
      ],
      now: NOW,
    });
    expect(digest.moved.count).toBe(1);
    expect(digest.hasContent).toBe(false);
  });

  it('안건이 있으면 보낸다', () => {
    expect(buildMeetingDigest({ requirements: [req()], now: NOW }).hasContent).toBe(true);
  });

  it('빈 입력에서 죽지 않는다', () => {
    const digest = buildMeetingDigest();
    expect(digest.hasContent).toBe(false);
    expect(digest.stalled.count).toBe(0);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/meetingDigest.test.js
```

Expected: FAIL — `Failed to resolve import "./meetingDigest"`

- [ ] **Step 3: 구현한다**

`lib/meetingDigest.js`:

```js
import { STALL_DAYS, groupByRequirement, stalledDays } from './stalled';

// 한 블록에 제목으로 펼칠 건수. 나머지는 '외 N건'으로 접는다.
// weeklyDigest 와 같은 값이고 같은 이유다 — 25건을 전부 펴면 그건 목록이지
// 안건이 아니다.
export const TOP_N = 5;

// '이번 주'의 길이. 회의가 주 1회라 지난 한 주다.
const PERIOD_DAYS = 7;

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

function block(rows, mapper) {
  return {
    count: rows.length,
    items: rows.slice(0, TOP_N).map(mapper),
    // 부르는 쪽이 매번 빼기를 하면 한 곳에서 틀린다.
    more: Math.max(0, rows.length - TOP_N),
  };
}

// 회의 안건 하나를 만든다.
//
// requirements: 그 브랜드의 요구사항 전부(종결 포함). 종결 여부는 stalledDays 가
//   본다 — 여기서 미리 거르면 '이번 주 움직인 것'에서 완료 건이 사라진다.
// changeLogs / comments: 그 브랜드 전체 것. 건별로 나누는 일은 이 함수가 한다.
// now: ISO 문자열.
//
// 블록 간 중복 제거를 하지 않는 이유: weeklyDigest 에서는 세 섹션의 상위 5건이
// 글자까지 같아지는 문제가 있어 seen 으로 걸렀다. 여기서는 세 블록이 성격상
// 겹치지 않는다 — 이번 주 들어온 건이 14일 멈춰 있을 수 없다.
export function buildMeetingDigest({
  requirements = [],
  changeLogs = [],
  comments = [],
  now,
} = {}) {
  const reqs = Array.isArray(requirements) ? requirements : [];
  const logsBy = groupByRequirement(changeLogs);
  const commentsBy = groupByRequirement(comments);

  const nowMs = Date.parse(now ?? '');
  const sinceMs = Number.isFinite(nowMs) ? nowMs - PERIOD_DAYS * 86400000 : null;

  // ① 멈춘 것.
  //
  // 담당 없는 것을 앞에 두는 이유: 담당이 없으면 예상일도 티켓도 나올 수 없다.
  // 회의가 먼저 손대야 할 것이 그쪽이고, 나머지는 담당자가 정해진 뒤에야
  // 누군가의 할 일이 된다.
  const stalledRows = reqs
    .map((r) => ({
      r,
      days: stalledDays({
        requirement: r,
        changeLogs: logsBy.get(r.id) ?? [],
        comments: commentsBy.get(r.id) ?? [],
        now,
      }),
    }))
    .filter((x) => x.days !== null && x.days >= STALL_DAYS)
    .sort((a, b) => {
      const av = idOf(a.r.assignee) ? 1 : 0;
      const bv = idOf(b.r.assignee) ? 1 : 0;
      if (av !== bv) return av - bv;
      return b.days - a.days;
    });

  const stalled = block(stalledRows, (x) => ({
    id: x.r.id,
    title: x.r.title,
    status: x.r.status,
    stalledDays: x.days,
    hasAssignee: Boolean(idOf(x.r.assignee)),
  }));
  stalled.unassigned = stalledRows.filter((x) => !idOf(x.r.assignee)).length;

  // ② 이번 주 새로 들어온 것.
  const incomingRows =
    sinceMs === null
      ? []
      : reqs.filter((r) => {
          const ms = Date.parse(r.created_at ?? '');
          return Number.isFinite(ms) && ms >= sinceMs;
        });
  const incoming = block(incomingRows, (r) => ({ id: r.id, title: r.title, status: r.status }));

  // ③ 이번 주 움직인 것.
  //
  // field_name 으로 거른다. change_type 으로 거르면 안 된다 — 상태 변경은
  // '상태변경'과 '중복병합' 두 종류를 쓴다(lib/statusDurations.js 의 같은 주석).
  const movedIds = new Set();
  if (sinceMs !== null) {
    for (const log of changeLogs ?? []) {
      if (log?.field_name !== 'status') continue;
      const ms = Date.parse(log.created_at ?? '');
      if (Number.isFinite(ms) && ms >= sinceMs) movedIds.add(log.requirement_id);
    }
  }
  const movedRows = reqs.filter((r) => movedIds.has(r.id));
  const moved = block(movedRows, (r) => ({ id: r.id, title: r.title, status: r.status }));

  // 보낼 값어치가 있는가.
  //
  // ③만 있는 주는 잘 굴러간 주라서 안건이 없다. 안건 없는 메일이 오기
  // 시작하면 정작 밀린 주에도 안 열린다.
  const hasContent = stalled.count > 0 || incoming.count > 0;

  return { hasContent, stalled, incoming, moved };
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run lib/meetingDigest.test.js
```

Expected: `Tests 14 passed`

- [ ] **Step 5: 커밋**

```bash
git add lib/meetingDigest.js lib/meetingDigest.test.js
git commit -m "feat: 회의 안건 세 블록을 만드는 순수 함수"
```

---

## Task 4: 회의 메일 발송

**Files:**
- Modify: `lib/emailContent.js` (끝에 추가)
- Modify: `lib/notify.js` (끝에 추가)

- [ ] **Step 1: 메일 본문을 만든다**

`lib/emailContent.js` 끝에 추가한다. 파일 상단의 `absoluteUrl` 을 쓴다.

```js
// 회의 안건 메일.
//
// 개인화하지 않는다. 주간 요약은 맨 위에 '회원님 담당 중 지연'을 두었지만,
// 이건 같은 자료를 같이 보고 논의하는 것이라 사람마다 다르면 회의에서
// "제 메일에는 그게 없는데요"가 나온다.
export function meetingDigestEmail({ brandName, meetingDate, digest, baseUrl }) {
  const line = (item) =>
    `  · ${item.title}${item.stalledDays != null ? ` — ${item.stalledDays}일 멈춤` : ''}`;

  const parts = [`${meetingDate} 회의 전에 한 번 봐 주세요.`, ''];

  if (digest.stalled.count > 0) {
    const suffix = digest.stalled.unassigned > 0 ? ` (담당 없음 ${digest.stalled.unassigned}건)` : '';
    parts.push(`■ ${STALL_LABEL} ${digest.stalled.count}건${suffix}`);
    parts.push(...digest.stalled.items.map(line));
    if (digest.stalled.more > 0) parts.push(`  외 ${digest.stalled.more}건`);
    parts.push('');
  }
  if (digest.incoming.count > 0) {
    parts.push(`■ 이번 주 새로 들어온 것 ${digest.incoming.count}건`);
    parts.push(...digest.incoming.items.map(line));
    if (digest.incoming.more > 0) parts.push(`  외 ${digest.incoming.more}건`);
    parts.push('');
  }
  if (digest.moved.count > 0) {
    parts.push(`■ 이번 주 움직인 것 ${digest.moved.count}건`);
    parts.push(...digest.moved.items.map((i) => `  · ${i.title} — ${i.status}`));
    if (digest.moved.more > 0) parts.push(`  외 ${digest.moved.more}건`);
    parts.push('');
  }

  parts.push(absoluteUrl(baseUrl, '/meeting'));

  return {
    subject: `[MOA] ${meetingDate} 주간회의 · ${brandName} 안건 ${digest.stalled.count + digest.incoming.count}건`,
    text: parts.join('\n'),
  };
}

// 회의에서 배정된 건을 요청자에게 알리는 메일.
//
// 건별이 아니라 묶어 보낸다. 한 사람이 10건을 올린 적이 있고, 그 사람이 회의
// 한 번에 10통을 받으면 그때부터 이 메일은 규칙으로 걸러진다.
export function assignedBatchEmail({ items, baseUrl }) {
  const lines = items.map((i) => {
    const tail = [i.assigneeName ? `담당 ${i.assigneeName}` : null, i.expectedDate ? `예상 ${i.expectedDate}` : null]
      .filter(Boolean)
      .join(', ');
    return `  · ${i.title}${tail ? ` — ${tail}` : ''}`;
  });
  return {
    subject: `[MOA] 올리신 요구사항 ${items.length}건에 담당자가 정해졌습니다`,
    text: [...lines, '', absoluteUrl(baseUrl, '/requirements')].join('\n'),
  };
}
```

`STALL_LABEL` 은 `lib/emailContent.js` 상단 import 아래에 둔다.

```js
import { STALL_DAYS } from './stalled';

const STALL_LABEL = `${STALL_DAYS}일 넘게 멈춘 것`;
```

- [ ] **Step 2: 발송 함수를 쓴다**

`lib/notify.js` 끝에 추가한다. 상단 import 두 줄을 먼저 더한다.

```js
import { buildMeetingDigest } from './meetingDigest';
import { assignedBatchEmail, meetingDigestEmail } from './emailContent';
```

`emailContent` 는 이미 import 되어 있으므로 그 중괄호 안에 이름 둘만 추가한다.

```js
// 회의 안건 메일. 수요일 오후에 한 번 불린다.
//
// sendWeeklyDigest 와 뼈대가 같지만 개인화가 없어서 브랜드당 한 번만
// 만들고 여럿에게 보낸다.
export async function sendMeetingDigest({ now = new Date().toISOString(), meetingDate } = {}) {
  const result = { brands: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const supabase = getSupabaseAdmin();
    const { data: brands, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('is_active', true);
    if (brandError) throw brandError;

    for (const brand of brands ?? []) {
      // 종결 건까지 전부 읽는다. '이번 주 움직인 것'에 완료 건이 들어가야
      // 하고, 정체 판정이 각자 종결 여부를 보므로 여기서 거르면 어긋난다.
      const { data: requirements, error: reqError } = await supabase
        .from('requirements')
        .select('id, title, status, assignee, requester, created_at')
        .eq('brand_id', brand.id);
      if (reqError) throw reqError;
      if ((requirements ?? []).length === 0) continue;

      const ids = requirements.map((r) => r.id);
      const { data: changeLogs, error: logError } = await supabase
        .from('change_logs')
        .select('requirement_id, field_name, change_type, created_at')
        .in('requirement_id', ids);
      if (logError) throw logError;
      const { data: comments, error: cmtError } = await supabase
        .from('requirement_comments')
        .select('requirement_id, created_at')
        .in('requirement_id', ids);
      if (cmtError) throw cmtError;

      const digest = buildMeetingDigest({
        requirements,
        changeLogs: changeLogs ?? [],
        comments: comments ?? [],
        now,
      });
      if (!digest.hasContent) {
        result.skipped += 1;
        continue;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_brand_roles')
        .select('team_member_id, tier')
        .eq('brand_id', brand.id);
      if (rolesError) throw rolesError;

      // 접수 알림과 같은 범위(3차 이상). 회의 참석자가 곧 그 범위다.
      const memberIds = submitRecipients(roles ?? [], null);
      if (memberIds.length === 0) continue;
      result.brands += 1;

      const emails = await loadEmails(supabase, memberIds);
      const to = memberIds.map((id) => emails.get(id)).filter(Boolean);
      if (to.length === 0) {
        result.skipped += 1;
        continue;
      }

      await runQuietly('회의 안건 메일', async () => {
        await sendMailToMany({
          to,
          ...meetingDigestEmail({
            brandName: brand.name,
            meetingDate: meetingDate ?? nextThursday(now),
            digest,
            baseUrl: appBaseUrl(),
          }),
        });
        result.sent += to.length;
      });
    }
  } catch (error) {
    result.failed += 1;
    logFailure('회의 안건', error);
  }
  return result;
}

// 회의에서 배정된 것을 요청자에게 알린다.
//
// groups: [{ requesterId, items }] — lib/meetingSession.js 가 만든다.
export async function notifyMeetingAssignments(groups) {
  const result = { sent: 0, skipped: 0 };
  if (!groups || groups.length === 0) return result;
  try {
    const supabase = getSupabaseAdmin();
    const emails = await loadEmails(
      supabase,
      groups.map((g) => g.requesterId)
    );
    for (const group of groups) {
      const message = `회의에서 올리신 요구사항 ${group.items.length}건에 담당자가 정해졌습니다.`;
      await runQuietly('회의 배정 인앱', () =>
        insertNotificationRows(
          supabase,
          group.items.map((item) => ({
            team_member_id: group.requesterId,
            requirement_id: item.id,
            message,
          }))
        )
      );
      const to = emails.get(group.requesterId);
      if (!to) {
        result.skipped += 1;
        continue;
      }
      await runQuietly('회의 배정 메일', async () => {
        await sendMail({
          to,
          ...assignedBatchEmail({ items: group.items, baseUrl: appBaseUrl() }),
        });
        result.sent += 1;
      });
    }
  } catch (error) {
    logFailure('회의 배정', error);
  }
  return result;
}

// 메일 제목에 쓸 다음 목요일(YYYY-MM-DD).
//
// 수요일에 보내므로 대개 '내일'이다. 크론이 하루 밀려 목요일에 돌면 그날이
// 나온다 — 지난 목요일을 적어 두면 받는 사람이 지난주 메일로 착각한다.
function nextThursday(nowIso) {
  const d = new Date(nowIso);
  if (Number.isNaN(d.getTime())) return '';
  const THURSDAY = 4;
  const delta = (THURSDAY - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 3: 테스트와 빌드를 확인한다**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: 기존 테스트 전부 통과, lint 오류 0, 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add lib/emailContent.js lib/notify.js
git commit -m "feat: 회의 안건 메일과 배정 알림 발송"
```

---

## Task 5: 크론 라우트

**Files:**
- Create: `app/api/cron/meeting-digest/route.js`

- [ ] **Step 1: 라우트를 만든다**

```js
import { sendMeetingDigest } from '@/lib/notify';
import { errorResponse, ApiError } from '@/lib/apiError';

// 회의 안건 메일을 쏘는 입구. 수요일 오후에 한 번 불린다.
//
// 인증은 weekly-digest 와 같다. 헤더 이름이 둘인 이유도 같다 — noa-vibe
// 배포 플랫폼의 스케줄러는 토큰 칸이 'x-noa-token' 하나로 고정이라
// Authorization 을 보낼 방법이 없고, 그렇다고 Authorization 을 버리면 curl 로
// 직접 부르는 길이 사라진다.
//
// GET 이 아니라 POST 인 이유: 메일 발송은 부작용이다. GET 이면 링크 미리보기
// 봇이 긁기만 해도 메일이 나간다.
export async function POST(request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new ApiError(503, 'CRON_SECRET 이 설정되지 않았습니다. 환경변수에 넣어 주세요.');
    }
    const auth = request.headers.get('authorization') ?? '';
    const noaToken = request.headers.get('x-noa-token') ?? '';
    if (auth !== `Bearer ${secret}` && noaToken !== secret) {
      throw new ApiError(401, '인증에 실패했습니다.');
    }
    const result = await sendMeetingDigest();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 빌드로 라우트가 잡히는지 확인한다**

```bash
npm run build
```

Expected: 라우트 목록에 `ƒ /api/cron/meeting-digest` 가 나온다

- [ ] **Step 3: 커밋**

```bash
git add app/api/cron/meeting-digest/route.js
git commit -m "feat: 회의 안건 메일 크론 라우트"
```

---

## Task 6: 회의 세션 테이블과 묶음 함수

**Files:**
- Create: `supabase/migrations/0024_meeting_sessions.sql`
- Create: `lib/meetingSession.js`
- Create: `lib/meetingSession.test.js`

- [ ] **Step 1: 마이그레이션을 쓴다**

```sql
-- 회의 세션. '직전 회의가 끝난 뒤부터 지금까지'를 알기 위한 표시 하나다.
--
-- 시작 시각을 두지 않는 이유: 회의 화면을 여는 것이 곧 회의 시작이라고
-- 정해야 하는데, 그 화면은 회의 밖에서도 열린다.
create table meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  ended_at timestamptz not null default now(),
  ended_by uuid references team_members(id)
);

create index idx_meeting_sessions_brand on meeting_sessions (brand_id, ended_at desc);
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/meetingSession.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { groupAssignmentsByRequester } from './meetingSession';

const reqs = [
  { id: 'a', title: '타임세일', requester: 'p1', expected_release_date: '2026-09-15' },
  { id: 'b', title: '사은품', requester: 'p1', expected_release_date: null },
  { id: 'c', title: '배너', requester: 'p2', expected_release_date: null },
  { id: 'd', title: '주인없음', requester: null, expected_release_date: null },
];

const log = (requirementId, newValue = '장재혁') => ({
  requirement_id: requirementId,
  new_value: newValue,
});

describe('groupAssignmentsByRequester', () => {
  it('요청자별로 묶는다', () => {
    const got = groupAssignmentsByRequester({
      assignmentLogs: [log('a'), log('b'), log('c')],
      requirements: reqs,
    });
    expect(got).toHaveLength(2);
    const p1 = got.find((g) => g.requesterId === 'p1');
    expect(p1.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('담당 이름과 예상일을 함께 담는다', () => {
    const [group] = groupAssignmentsByRequester({
      assignmentLogs: [log('a')],
      requirements: reqs,
    });
    expect(group.items[0]).toEqual({
      id: 'a',
      title: '타임세일',
      assigneeName: '장재혁',
      expectedDate: '2026-09-15',
    });
  });

  it('요청자가 없는 건은 뺀다', () => {
    expect(
      groupAssignmentsByRequester({ assignmentLogs: [log('d')], requirements: reqs })
    ).toEqual([]);
  });

  it('담당자 해제(new_value 없음)는 세지 않는다', () => {
    expect(
      groupAssignmentsByRequester({ assignmentLogs: [log('a', null)], requirements: reqs })
    ).toEqual([]);
  });

  it('같은 건이 두 번 배정되면 마지막 담당자로 한 번만', () => {
    const [group] = groupAssignmentsByRequester({
      assignmentLogs: [log('a', '장재혁'), log('a', '안수아')],
      requirements: reqs,
    });
    expect(group.items).toHaveLength(1);
    expect(group.items[0].assigneeName).toBe('안수아');
  });

  it('목록에 없는 요구사항 로그는 무시한다', () => {
    expect(
      groupAssignmentsByRequester({ assignmentLogs: [log('zzz')], requirements: reqs })
    ).toEqual([]);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(groupAssignmentsByRequester()).toEqual([]);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

```bash
npx vitest run lib/meetingSession.test.js
```

Expected: FAIL — `Failed to resolve import "./meetingSession"`

- [ ] **Step 4: 구현한다**

`lib/meetingSession.js`:

```js
function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 회의에서 배정된 건들을 요청자별로 묶는다.
//
// 건별 즉시 발송이면 10건을 올린 사람이 회의 한 번에 10통을 받는다. 실제로
// 한 사람이 10건, 다른 한 사람이 5건을 올렸다.
//
// assignmentLogs: change_type='담당자지정' 로그. new_value 는 담당자 이름.
//   순서는 오래된 것부터여야 한다 — 같은 건이 회의 중 두 번 배정되면 나중
//   값이 이겨야 하고, 여기서는 뒤에 온 것으로 덮어쓴다.
// requirements: 그 브랜드의 요구사항. requester 와 제목을 여기서 가져온다.
//
// 반환: [{ requesterId, items: [{ id, title, assigneeName, expectedDate }] }]
export function groupAssignmentsByRequester({ assignmentLogs = [], requirements = [] } = {}) {
  const byId = new Map((requirements ?? []).map((r) => [r.id, r]));

  // 건별로 마지막 배정만 남긴다. Map 은 넣은 순서를 지키므로 아래 묶음에서도
  // 회의 중 배정된 순서가 그대로 나온다.
  const latest = new Map();
  for (const log of assignmentLogs ?? []) {
    // 담당자 해제는 배정이 아니다. 요청자에게 "담당자가 정해졌습니다"라고
    // 보낼 수 없다.
    if (!log?.requirement_id || !log.new_value) continue;
    if (!byId.has(log.requirement_id)) continue;
    latest.set(log.requirement_id, log.new_value);
  }

  const groups = new Map();
  for (const [requirementId, assigneeName] of latest) {
    const requirement = byId.get(requirementId);
    const requesterId = idOf(requirement.requester);
    // 요청자가 없는 건은 보낼 곳이 없다. 운영 데이터에 실제로 1건 있다.
    if (!requesterId) continue;
    if (!groups.has(requesterId)) groups.set(requesterId, []);
    groups.get(requesterId).push({
      id: requirementId,
      title: requirement.title,
      assigneeName,
      expectedDate: requirement.expected_release_date ?? null,
    });
  }

  return [...groups].map(([requesterId, items]) => ({ requesterId, items }));
}
```

- [ ] **Step 5: 통과를 확인한다**

```bash
npx vitest run lib/meetingSession.test.js
```

Expected: `Tests 7 passed`

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0024_meeting_sessions.sql lib/meetingSession.js lib/meetingSession.test.js
git commit -m "feat: 회의 세션 테이블과 요청자별 묶음 함수"
```

- [ ] **Step 7: 마이그레이션을 운영 DB 에 적용한다**

Supabase SQL Editor 에 `supabase/migrations/0024_meeting_sessions.sql` 내용을
붙여넣어 실행한다. 화면 코드가 이 테이블을 읽기 전에 해야 한다.

---

## Task 7: `GET /api/meeting` — 회의 화면 데이터

**Files:**
- Create: `app/api/meeting/route.js`

- [ ] **Step 1: 라우트를 만든다**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { CLOSED_STATUSES } from '@/lib/statuses';
import { STALL_DAYS, groupByRequirement, stalledDays } from '@/lib/stalled';

// 회의 화면이 필요한 것을 한 번에 준다.
//
// 미종결 건 전부를 정체 순으로 내려보내고, 필터 세 개는 화면에서 건다. 회의
// 중에 왔다 갔다 하는 조작이라 왕복이 없어야 한다.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    // 담당자 지정과 같은 문턱이다. 4차는 배정할 수 없으므로 이 화면에 들어올
    // 이유가 없다.
    await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from('requirements')
      .select(
        'id, title, status, created_at, expected_release_date, ' +
          'assignee:team_members!requirements_assignee_fkey(id, name), ' +
          'requester:team_members!requirements_requester_fkey(id, name)'
      )
      .eq('brand_id', brandId)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);
    if (error) throw error;

    const ids = (rows ?? []).map((r) => r.id);
    let changeLogs = [];
    let comments = [];
    if (ids.length > 0) {
      const { data: logs, error: logError } = await supabase
        .from('change_logs')
        .select('requirement_id, created_at')
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
    const since = new Date(Date.parse(now) - 7 * 86400000).toISOString();

    const items = (rows ?? [])
      .map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        createdAt: r.created_at,
        expectedDate: r.expected_release_date,
        assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name } : null,
        requester: r.requester ? { id: r.requester.id, name: r.requester.name } : null,
        stalledDays: stalledDays({
          requirement: r,
          changeLogs: logsBy.get(r.id) ?? [],
          comments: commentsBy.get(r.id) ?? [],
          now,
        }),
        isNew: (r.created_at ?? '') >= since,
      }))
      .sort((a, b) => (b.stalledDays ?? 0) - (a.stalledDays ?? 0));

    return Response.json({
      summary: {
        stalled: items.filter((i) => (i.stalledDays ?? 0) >= STALL_DAYS).length,
        unassigned: items.filter((i) => !i.assignee).length,
        incoming: items.filter((i) => i.isNew).length,
      },
      stallDays: STALL_DAYS,
      items,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

`requirements_assignee_fkey` / `requirements_requester_fkey` 는 `lib/comments.js` 가
설명하는 이유로 이름을 못 박는다 — `team_members(id, name)` 처럼 짧게 쓰면
PostgREST 가 어느 관계를 탈지 못 골라 `PGRST201` 로 죽는다.

- [ ] **Step 2: 빌드와 실제 응답을 확인한다**

```bash
npm run build
```

Expected: 라우트 목록에 `ƒ /api/meeting`

FK 이름은 `app/api/requirements/route.js:16-17` 이 이미 쓰는 것과 같다. 개발 서버를
띄워 `/api/meeting?brandId=<스파오 id>` 응답에 `items` 가 실제로 차는지 한 번
확인한다.

- [ ] **Step 3: 커밋**

```bash
git add app/api/meeting/route.js
git commit -m "feat: 회의 화면 데이터 API"
```

---

## Task 8: `/meeting` 화면

**Files:**
- Create: `app/meeting/page.js`
- Create: `components/MeetingBoard.jsx`
- Modify: `components/TopBar.jsx:84-88`

- [ ] **Step 1: 페이지 껍데기를 만든다**

`app/meeting/page.js`:

```jsx
'use client';

import { useIdentity } from '@/components/IdentityProvider';
import { canProcess } from '@/lib/tiers';
import { MeetingBoard } from '@/components/MeetingBoard';

// 주간회의 화면.
//
// 목록 페이지에 '회의 모드' 버튼을 다는 안도 있었지만 새 주소로 뺐다. 목적이
// 분명한 주소여야 메일 링크가 바로 꽂히고, 처음 보는 사람도 이 화면이 무슨
// 자리인지 안다.
//
// 화면 게이팅은 편의일 뿐이고 관문은 API 다(requireBrandAccess '3차').
export default function MeetingPage() {
  const { identity } = useIdentity();
  if (!canProcess(identity)) {
    return <p className="text-sm text-slate-500">실무자 이상만 볼 수 있는 화면입니다.</p>;
  }
  return <MeetingBoard identity={identity} />;
}
```

- [ ] **Step 2: 본체를 만든다**

`components/MeetingBoard.jsx`:

```jsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const FILTERS = [
  { key: 'stalled', label: '오래 멈춘 순' },
  { key: 'unassigned', label: '담당 없는 것만' },
  { key: 'incoming', label: '이번 주 신규' },
];

export function MeetingBoard({ identity }) {
  const brandId = identity?.brandId ?? null;
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('stalled');
  const [people, setPeople] = useState([]);
  const [rowError, setRowError] = useState({});
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!brandId) return;
    try {
      const res = await fetch(`/api/meeting?brandId=${brandId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '불러오지 못했습니다.');
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  // 담당자 후보. 배치된 사람만 고를 수 있다 — assignee 라우트가 같은 규칙으로
  // 막고 있어서, 여기서 아무나 보여 주면 고른 뒤에 400 이 뜬다.
  useEffect(() => {
    if (!brandId) return;
    fetch(`/api/brand-team?brandId=${brandId}`)
      .then((res) => res.json())
      .then((d) => setPeople((d.members ?? []).filter((m) => m.isActive)))
      .catch(() => setPeople([]));
  }, [brandId]);

  // 저장은 고르는 즉시. 회의 중이라 저장 버튼을 따로 누르게 하면 안 누른 채
  // 넘어간다. 실패하면 그 행에만 문구를 띄우고 값을 되돌린다.
  async function save(id, url, body, patch) {
    const before = data;
    setData((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, ...body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '저장 실패');
    } catch (err) {
      setData(before);
      setRowError((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  async function endMeeting() {
    setEnding(true);
    setError('');
    try {
      const res = await fetch('/api/meeting/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '회의를 마치지 못했습니다.');
      setEnded(d);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  }

  if (!brandId) return <p className="text-sm text-slate-500">브랜드를 먼저 선택해 주세요.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  const stallDays = data.stallDays;
  const rows = data.items.filter((i) => {
    if (filter === 'unassigned') return !i.assignee;
    if (filter === 'incoming') return i.isNew;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">주간회의</h1>
        <p className="mt-1 text-sm text-slate-500">
          오래 멈춘 것부터 봅니다. 담당자와 예상일은 이 목록에서 바로 정할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={`${stallDays}일+ 멈춤`} value={data.summary.stalled} tone="rose" />
        <Stat label="담당 없음" value={data.summary.unassigned} tone="amber" />
        <Stat label="이번 주 신규" value={data.summary.incoming} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">보기</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded px-2.5 py-1 text-xs ${
              filter === f.key
                ? 'bg-indigo-50 text-indigo-700'
                : 'border border-slate-200 text-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {ended && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          회의를 마쳤습니다. {ended.notified}명에게 배정 결과를 보냈습니다.
        </p>
      )}

      <ul className="flex flex-col">
        {rows.length === 0 && (
          <li className="py-6 text-sm text-slate-500">이 조건에 해당하는 건이 없습니다.</li>
        )}
        {rows.map((item) => (
          <li
            key={item.id}
            className={`flex flex-wrap items-start gap-3 border-b border-slate-100 py-3 pl-3 ${
              item.assignee ? 'border-l-2 border-l-slate-200' : 'border-l-2 border-l-rose-400'
            }`}
          >
            <div className="min-w-0 flex-1">
              <Link href={`/requirements/${item.id}`} className="text-sm hover:underline">
                {item.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {item.stalledDays >= stallDays ? (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">
                    {item.stalledDays}일 멈춤
                  </span>
                ) : item.isNew ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">신규</span>
                ) : null}
                <span className="text-slate-500">
                  {item.status} · {item.requester?.name ?? '요청자 없음'} 요청
                </span>
              </div>
              {rowError[item.id] && (
                <p className="mt-1 text-xs text-red-600">{rowError[item.id]}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={item.assignee?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const person = people.find((p) => p.id === id);
                  save(
                    item.id,
                    `/api/requirements/${item.id}/assignee`,
                    { assignee: id },
                    { assignee: id ? { id, name: person?.name ?? '' } : null }
                  );
                }}
                className="h-8 rounded border border-slate-200 px-2 text-xs"
              >
                <option value="">담당 지정</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={item.expectedDate ?? ''}
                onChange={(e) => {
                  const value = e.target.value || null;
                  save(
                    item.id,
                    `/api/requirements/${item.id}/expected-date`,
                    { expectedReleaseDate: value },
                    { expectedDate: value }
                  );
                }}
                className="h-8 rounded border border-slate-200 px-2 text-xs"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end border-t border-slate-200 pt-3">
        <Button
          type="button"
          onClick={endMeeting}
          disabled={ending}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {ending ? '마치는 중...' : '회의 마치기'}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-800',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className={`rounded px-3 py-2 ${tones[tone]}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: 네비게이션에 링크를 넣는다**

`components/TopBar.jsx` 에서 `/requirements` NavLink 바로 뒤, 구분선 앞에 넣는다.
`canProcess` 를 파일 상단에서 import 한다(`import { canProcess } from '@/lib/tiers';`).

```jsx
          {canProcess(identity) && (
            <NavLink href="/meeting" active={pathname.startsWith('/meeting')}>
              주간회의
            </NavLink>
          )}
```

`identity` 변수 이름은 그 파일이 이미 쓰는 것을 따른다. `globalAdmin` 을 만드는
줄 근처를 보고 맞춘다.

- [ ] **Step 4: 빌드와 화면을 확인한다**

```bash
npm run build
```

Expected: 라우트 목록에 `○ /meeting`

개발 서버를 띄워 `/meeting` 을 연다. 확인할 것: 목록이 정체 순으로 나오는가,
담당 없는 행에 왼쪽 붉은 선이 있는가, 담당자를 고르면 새로고침 없이 반영되는가,
필터 세 개가 도는가.

- [ ] **Step 5: 커밋**

```bash
git add app/meeting components/MeetingBoard.jsx components/TopBar.jsx
git commit -m "feat: 주간회의 화면"
```

---

## Task 9: `POST /api/meeting/end` — 회의 마치기

**Files:**
- Create: `app/api/meeting/end/route.js`

- [ ] **Step 1: 라우트를 만든다**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { groupAssignmentsByRequester } from '@/lib/meetingSession';
import { notifyMeetingAssignments } from '@/lib/notify';

// 첫 회의에는 직전 세션이 없다. 그때는 지난 한 주를 본다 — 회의가 주 1회라
// 그보다 앞의 배정은 지난 회의에서 이미 알린 것으로 친다.
const FIRST_MEETING_LOOKBACK_DAYS = 7;

export async function POST(request) {
  try {
    const { brandId } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const { memberId } = await requireBrandAccess(brandId, '3차');
    const supabase = getSupabaseAdmin();

    const { data: last, error: lastError } = await supabase
      .from('meeting_sessions')
      .select('ended_at')
      .eq('brand_id', brandId)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;

    const since =
      last?.ended_at ??
      new Date(Date.now() - FIRST_MEETING_LOOKBACK_DAYS * 86400000).toISOString();

    const { data: logs, error: logError } = await supabase
      .from('change_logs')
      .select('requirement_id, new_value, created_at')
      .eq('brand_id', brandId)
      .eq('change_type', '담당자지정')
      .gt('created_at', since)
      .order('created_at', { ascending: true });
    if (logError) throw logError;

    const ids = [...new Set((logs ?? []).map((l) => l.requirement_id))];
    let requirements = [];
    if (ids.length > 0) {
      const { data: rows, error: reqError } = await supabase
        .from('requirements')
        .select('id, title, requester, expected_release_date')
        .in('id', ids);
      if (reqError) throw reqError;
      requirements = rows ?? [];
    }

    const groups = groupAssignmentsByRequester({ assignmentLogs: logs ?? [], requirements });

    // 세션을 먼저 닫는다. 메일이 실패해도 세션은 닫힌 것으로 둔다 — 다시
    // 누르면 아무것도 안 나가는 것이 맞다. 같은 메일을 두 번 받는 쪽이 더
    // 나쁘고, 배정 사실은 화면에 남아 있다.
    const { error: insError } = await supabase
      .from('meeting_sessions')
      .insert({ brand_id: brandId, ended_by: memberId });
    if (insError) throw insError;

    // 보낼 것이 없으면 그냥 닫는다. "0건이 배정되었습니다" 메일이 나가면 안 된다.
    const result = await notifyMeetingAssignments(groups);

    return Response.json({
      ok: true,
      assigned: groups.reduce((sum, g) => sum + g.items.length, 0),
      notified: result.sent,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 빌드를 확인한다**

```bash
npm run build
```

Expected: 라우트 목록에 `ƒ /api/meeting/end`

- [ ] **Step 3: 전체 테스트를 돌린다**

```bash
npx vitest run && npm run lint
```

Expected: 전부 통과, lint 오류 0

- [ ] **Step 4: 손으로 한 바퀴 돌린다**

개발 서버에서 `/meeting` 을 열고:
1. 담당자 없는 건 하나에 담당자를 지정한다
2. "회의 마치기"를 누른다
3. 초록 문구에 "1명에게 배정 결과를 보냈습니다"가 뜨는지 본다
4. 그 요구사항의 상세 화면 활동 피드에 "담당자를 없음→OOO(으)로 변경"이 뜨는지 본다
5. "회의 마치기"를 한 번 더 누른다 — `notified: 0` 이어야 한다(직전 세션 이후
   새 배정이 없으므로)

- [ ] **Step 5: 커밋**

```bash
git add app/api/meeting/end/route.js
git commit -m "feat: 회의 마치기 - 배정 결과를 요청자에게"
```

---

## Task 10: 배포와 스케줄 전환

**Files:** 없음 (운영 작업)

- [ ] **Step 1: 배포 ZIP 을 만든다**

```bash
npm run package:src
```

`package:src` 여야 한다. `npm run package` 는 빌드 완료본이라 플랫폼이 소스에서
다시 빌드하는 지금 방식에서는 실패한다.

- [ ] **Step 2: 배포하고 마이그레이션 적용을 확인한다**

Task 6 Step 7 에서 `0024` 를 이미 적용했어야 한다. 안 했으면 지금 한다 — 안 하면
"회의 마치기"가 500 으로 죽는다.

- [ ] **Step 3: 수요일 크론을 등록한다**

배포 플랫폼의 배치/스케줄 화면에서:
- 경로: `/api/cron/meeting-digest`
- 메서드: POST
- 주기: 매주 수요일 오후
- 내부 토큰: 환경변수 `CRON_SECRET` 과 같은 값

- [ ] **Step 4: 월요일 주간 요약 스케줄을 지운다**

같은 화면에서 `/api/cron/weekly-digest` 스케줄을 삭제한다. **코드는 지우지
않는다** — 되돌리고 싶으면 스케줄만 다시 걸면 된다.

- [ ] **Step 5: 첫 메일을 손으로 한 번 쏴 본다**

수요일까지 기다리지 않고 확인한다. PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri "https://moa.noavibe.app/api/cron/meeting-digest" -Headers @{ "x-noa-token" = "<CRON_SECRET 값>" }
```

Expected: `ok: True`, `brands`/`sent` 에 0 이 아닌 수. 메일함에서 안건 건수가
화면의 `{stallDays}일+ 멈춤` 숫자와 맞는지 본다.

---

## 자체 점검

**스펙 대응**

| 스펙 항목 | 태스크 |
|---|---|
| 담당자 변경 로그 분리 | 1 |
| 정체 판정 (14일, 코멘트 포함, 종결 제외) | 2 |
| 회의 메일 세 블록 | 3 |
| 수신자 3차 이상, 개인화 없음 | 4 |
| 크론 (수요일, 두 헤더, 503/401) | 5 |
| `meeting_sessions` 테이블 | 6 |
| 요청자별 묶음 | 6 |
| `/meeting` 화면, 인라인 저장, 권한 | 7·8 |
| 회의 마치기 → 요청자 알림 | 9 |
| 월요일 주간 요약 중지 | 10 |

**스펙에 있었으나 계획에서 뺀 것**

- `lib/notify.js` 의 `notifyAssigneeChange` 는 손대지 않는다. 회의 배정도 그
  경로를 타므로 새 담당자에게 개별 메일이 그대로 나간다. 요청자에게 가는 것은
  회의 마치기 쪽 한 통뿐이라 겹치지 않는다.
- 회의록 내보내기는 만들지 않는다(스펙 "범위 밖").

**확인한 것**

`/api/meeting` 이 쓰는 FK 이름(`requirements_assignee_fkey`,
`requirements_requester_fkey`)은 `app/api/requirements/route.js:16-17` 이 이미 쓰고
있는 것과 같다. 추측이 아니다.
