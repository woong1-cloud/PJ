# 요구사항 상세 화면 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세 화면이 이 건의 상태와 다음 한 걸음을 한눈에 말하게 하고, 그 과정에서 나온 조각을 디자인 시스템의 첫 컴포넌트로 올린다.

**Architecture:** 판정은 전부 `lib/` 의 순수 함수로 뺀다(`statusMeta.primary` → `statusActions` → `headline`). 화면은 그 결과를 그리기만 한다. 922줄짜리 `RequirementDetail.jsx` 를 조립 역할만 남기고 넷으로 쪼개되, 데이터 로딩과 핸들러는 옮기지 않는다.

**Tech Stack:** Next.js 16 App Router (JS), React 19, Tailwind v4, shadcn/ui on base-ui, Vitest

설계 문서: `docs/superpowers/specs/2026-08-26-requirement-detail-redesign-design.md`
목업: https://claude.ai/code/artifact/f1506e44-bd35-47ef-8dd7-97408e358c29

---

## 이 계획이 지키는 경계

**서버는 한 줄도 바꾸지 않는다.** 라우트·권한·알림·마이그레이션이 전부 그대로다.
화면이 하는 판정은 모두 서버가 다시 한다.

**핸들러를 옮기지 않는다.** `changeStatus`·`closeRequirement`·`changeAssignee`·
`changeExpectedDate`·`changeType`·`changeProject`·`submitForReview`·`uploadNew`·
`deleteImage` 는 `RequirementDetail.jsx` 에 그대로 두고 props 로 내려보낸다.
상태(`data`)가 거기 있고, 옮기면 각 컴포넌트가 자기 fetch 를 갖게 되어 화면이
부분적으로 낡는다.

**렌더 테스트는 만들지 않는다.** 이 프로젝트에 선례가 없고(테스트 43개 전부
순수 함수), 테스트 환경이 `node` 라 DOM 이 없다. 컴포넌트는 빌드와 브라우저
확인으로 검증한다.

---

## 파일 구조

**새로 만드는 것**

| 파일 | 책임 |
|---|---|
| `lib/statusActions.js` | `⋯` 메뉴에 들어갈 상태 전이 목록. 순수 함수 |
| `lib/statusActions.test.js` | 위 테스트 |
| `lib/headline.js` | 머리 줄이 말할 것(어조·경과·담당·행동·알약). 순수 함수 |
| `lib/headline.test.js` | 위 테스트 |
| `components/ui/StatusDot.jsx` | 상태 점 + 이름 |
| `components/ui/PropertyRow.jsx` | 아이콘 · 라벨 · 값 한 줄 |
| `components/ui/Lightbox.jsx` | 이미지 확대 |
| `components/StatusStrip.jsx` | 진행 스트립 |
| `components/RequirementHeader.jsx` | 제목 · 뱃지 · 머리 줄 · 스트립 |
| `components/RequirementStatusActions.jsx` | 주 버튼 + `⋯` 메뉴 + 종결 |
| `components/RequirementSidebar.jsx` | 지정 넷 + 접힌 요청 내용 |
| `components/RequirementAttachments.jsx` | 첨부 + 업로드 |

**고치는 것**

| 파일 | 무엇을 |
|---|---|
| `lib/statusMeta.js` | 상태마다 `primary` 추가 |
| `lib/statusMeta.test.js` | `primary` 검사 추가 |
| `components/RequirementDetail.jsx` | 조립만 남기고 넷을 들어낸다 |

---

## Task 1: `STATUS_META` 에 주 버튼을 붙인다

**Files:**
- Modify: `lib/statusMeta.js:8-67`
- Modify: `lib/statusMeta.test.js`

`next` 가 이미 다음 행동을 말하고 있다(`IT — 검토 시작` 등). 그 값을 화면이
쓸 수 있는 모양으로 옆에 둔다. 새 상수 파일을 만들지 않는 이유다 — 상태에
딸린 표현은 이 파일이 단일 출처이고, 나누면 한쪽만 고쳐지는 날이 온다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/statusMeta.test.js` 의 `describe('STATUS_META', ...)` 블록 안, 기존 `it`
두 개 뒤에 붙인다. 파일 맨 위 import 에 `DIRECT_STATUSES` 를 더한다.

```js
import { REQUIREMENT_STATUSES, DIRECT_STATUSES, MERGED_STATUS } from './statuses';
```

```js
  // 주 버튼이 조용히 사라지는 것을 막는다. 상태를 추가하고 primary 를 빼먹으면
  // 화면에서는 "버튼이 안 뜨네" 정도로만 보인다.
  it('모든 상태에 primary 가 정의되어 있다', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(STATUS_META[status], `${status}`).toHaveProperty('primary');
    }
  });

  it('중복만 primary 가 null 이다 — 서버가 상태 변경을 막는다', () => {
    for (const status of REQUIREMENT_STATUSES) {
      const primary = STATUS_META[status].primary;
      if (status === MERGED_STATUS) expect(primary).toBeNull();
      else expect(primary, `${status}`).not.toBeNull();
    }
  });

  it('primary 에 label 과 via 가 있다', () => {
    for (const status of REQUIREMENT_STATUSES) {
      const primary = STATUS_META[status].primary;
      if (!primary) continue;
      expect(primary.label, `${status}.label`).toBeTruthy();
      expect(['direct', 'start', 'approve', 'submit', 'resume']).toContain(primary.via);
    }
  });

  // 이 검사가 이 파일에서 가장 중요하다. 화면이 서버가 거부할 상태를 버튼으로
  // 내밀면, 사용자는 눌렀는데 400 을 받는다.
  it("via='direct' 인 상태의 목적지는 DIRECT_STATUSES 안에 있다", () => {
    for (const status of REQUIREMENT_STATUSES) {
      const primary = STATUS_META[status].primary;
      if (primary?.via !== 'direct') continue;
      expect(DIRECT_STATUSES, `${status} → ${primary.to}`).toContain(primary.to);
    }
  });
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/statusMeta.test.js
```

Expected: FAIL — `작성중` 에 `primary` 속성이 없다

- [ ] **Step 3: `STATUS_META` 에 `primary` 를 넣는다**

`lib/statusMeta.js` 의 각 항목에 한 줄씩 더한다. `next` 바로 아래에 둔다 —
같은 것을 말하는 두 값이라 붙어 있어야 한다.

```js
  작성중: {
    style: 'border border-slate-300 bg-transparent text-slate-500',
    meaning: '브랜드가 초안을 쓰는 중, 아직 제출하지 않음',
    next: '브랜드 — 제출',
    // 요청자가 누르는 유일한 제출 수단이다. 3차 이상도 같은 버튼을 쓴다.
    primary: { label: '검토 요청', to: '검토대기', via: 'submit' },
  },
  검토대기: {
    style: 'bg-amber-50 text-amber-700',
    meaning: '제출 완료, IT가 아직 보지 않음',
    next: 'IT — 검토 시작',
    // 착수 창이 담당자·예상일·유형을 함께 받는다. 이 앱에서 담당 지정은
    // 독립된 행동이 아니라 착수의 일부다.
    primary: { label: '검토 시작', to: '검토중', via: 'start' },
  },
  검토중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: 'IT가 검토하고 정책을 정하는 중',
    next: 'IT — 개발 착수',
    primary: { label: '개발 시작', to: '개발중', via: 'direct' },
  },
  개발중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 진행 중',
    next: 'IT — QA 시작',
    primary: { label: 'QA 시작', to: 'QA중', via: 'direct' },
  },
  QA중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 끝나고 테스트가 진행 중',
    next: 'IT — 승인 요청',
    primary: { label: '승인 요청', to: '승인대기', via: 'direct' },
  },
  승인대기: {
    style: 'bg-amber-50 text-amber-700',
    meaning: 'QA까지 끝남, 브랜드·본부의 최종 확인을 기다리는 중',
    next: '브랜드·본부 — 승인',
    // to 가 없다. 완료는 POST /approve 로만 도달하고, 그 라우트가 상태를 정한다.
    primary: { label: '승인하고 완료', to: null, via: 'approve' },
  },
  완료: {
    style: 'bg-emerald-50 text-emerald-700',
    meaning: '배포까지 끝남',
    next: '—',
    // 종결 건에는 다음 걸음이 없다. 되돌릴 길만 남는다.
    primary: { label: '재개', to: null, via: 'resume' },
  },
  반려: {
    style: 'bg-rose-50 text-rose-700',
    meaning: 'IT가 진행하지 않기로 결정함',
    next: '— (사유 확인 후 재요청 가능)',
    primary: { label: '재개', to: null, via: 'resume' },
  },
  취소: {
    style: 'bg-slate-100 text-slate-500',
    meaning: '요청한 브랜드가 철회함',
    next: '—',
    primary: { label: '재개', to: null, via: 'resume' },
  },
  중복: {
    style: 'bg-slate-100 text-slate-400 line-through',
    meaning: '다른 요구사항에 병합됨',
    next: '—',
    // 서버가 병합된 건의 상태 변경을 막는다(status/route.js). 버튼을 주면
    // 눌렀을 때 400 이 난다.
    primary: null,
  },
```

기존 주석은 그대로 둔다.

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run lib/statusMeta.test.js
```

Expected: `Tests 6 passed` (기존 2 + 새 4)

- [ ] **Step 5: 커밋**

```bash
git add lib/statusMeta.js lib/statusMeta.test.js
git commit -m "feat: 상태마다 주 버튼을 STATUS_META 에 둔다"
```

---

## Task 2: `lib/statusActions.js` — `⋯` 메뉴에 무엇이 들어가나

**Files:**
- Create: `lib/statusActions.js`
- Create: `lib/statusActions.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/statusActions.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { menuTransitions } from './statusActions';

const it3 = { tier: '3차', memberId: 'm1' };
const it2 = { tier: '2차', memberId: 'm2' };
const req = { tier: '4차', memberId: 'm3' };
const admin = { tier: '4차', memberId: 'm4', isGlobalAdmin: true };

describe('menuTransitions', () => {
  it('주 버튼의 목적지는 메뉴에 없다 — 같은 것이 두 곳에 있으면 안 된다', () => {
    const got = menuTransitions({ status: '검토대기', identity: it3 });
    expect(got).not.toContain('검토중');
    expect(got).toContain('개발중');
  });

  it('지금 상태는 메뉴에 없다', () => {
    expect(menuTransitions({ status: '검토중', identity: it3 })).not.toContain('검토중');
  });

  it('완료는 어떤 상태에서도 메뉴에 없다 — 서버가 거부한다', () => {
    for (const status of ['작성중', '검토대기', '검토중', '개발중', 'QA중', '승인대기']) {
      expect(menuTransitions({ status, identity: it3 }), status).not.toContain('완료');
    }
  });

  it('건너뛰기가 열려 있다 — 검토대기에서 QA중으로 갈 수 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: it3 })).toContain('QA중');
  });

  it('되돌리기가 열려 있다 — 검토중에서 검토대기로', () => {
    expect(menuTransitions({ status: '검토중', identity: it3 })).toContain('검토대기');
  });

  it('종결 상태에서는 비어 있다 — 재개 창이 그 일을 한다', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(menuTransitions({ status, identity: it3 }), status).toEqual([]);
    }
  });

  it('4차에게는 비어 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: req })).toEqual([]);
  });

  it('전체 관리자는 등급과 무관하게 볼 수 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: admin }).length).toBeGreaterThan(0);
  });

  it('2차도 볼 수 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: it2 }).length).toBeGreaterThan(0);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(menuTransitions()).toEqual([]);
    expect(menuTransitions({ status: null, identity: it3 })).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/statusActions.test.js
```

Expected: FAIL — `Failed to resolve import "./statusActions"`

- [ ] **Step 3: 구현한다**

`lib/statusActions.js`:

```js
import { BOARD_STATUSES, CLOSED_STATUSES, DONE_STATUS } from './statuses';
import { STATUS_META } from './statusMeta';
import { canProcess } from './tiers';

// '⋯' 메뉴에 들어갈 상태 전이 목록.
//
// 여기에는 '상태를 바로 옮기는 것'만 담는다. 반려(사유 필수)와 중복 병합(창)과
// 삭제(전체 관리자)는 성격이 다른 행동이라 부르는 쪽이 따로 붙인다 — 각자
// 권한과 절차가 다르고, 목록에 섞으면 "고르면 바로 바뀌는 것"과 "창이 뜨는
// 것"이 다시 한 덩어리가 된다. 그게 지금 셀렉트의 문제다.
//
// 메뉴가 필요한 이유: 실제 전이 26건에서 검토대기를 떠난 길이 여덟 가지였고
// 다음 단계(검토중)는 33%였다. 다음 걸음만 버튼으로 꺼내고 나머지를 잠그면
// 절반 이상의 경우에 길이 없어진다.
export function menuTransitions({ status, identity } = {}) {
  if (!status) return [];
  // 종결 상태(완료·반려·취소·중복)에서는 비어 있다. 주 버튼 '재개'가 어디로
  // 되돌릴지 묻는 창을 띄우므로, 같은 목록을 메뉴에도 두면 두 벌이 된다.
  // 중복은 서버가 상태 변경 자체를 막는다.
  if (CLOSED_STATUSES.includes(status)) return [];
  // 4차는 상태를 바꿀 수 없다(서버도 3차 이상만 받는다). 열어 두면 눌렀을 때
  // 403 이 난다.
  if (!canProcess(identity)) return [];

  const primaryTo = STATUS_META[status]?.primary?.to ?? null;
  return BOARD_STATUSES.filter(
    // 완료는 승인 절차로만 도달한다. BOARD_STATUSES 에는 들어 있으므로
    // 여기서 명시적으로 뺀다.
    (s) => s !== DONE_STATUS && s !== status && s !== primaryTo
  );
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run lib/statusActions.test.js
```

Expected: `Tests 10 passed`

- [ ] **Step 5: 커밋**

```bash
git add lib/statusActions.js lib/statusActions.test.js
git commit -m "feat: 메뉴에 들어갈 상태 전이를 정하는 순수 함수"
```

---

## Task 3: `lib/headline.js` — 머리 줄이 말할 것

**Files:**
- Create: `lib/headline.js`
- Create: `lib/headline.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/headline.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { headline } from './headline';

const TODAY = '2026-08-26';
const it3 = { tier: '3차', memberId: 'staff' };
const requester = { tier: '4차', memberId: 'owner' };

const req = (over = {}) => ({
  status: '검토대기',
  assignee: null,
  requester: { id: 'owner' },
  is_confidential: false,
  expected_release_date: null,
  created_at: '2026-08-24T00:00:00Z',
  completed_at: null,
  ...over,
});

describe('headline — 경과', () => {
  it('정체는 며칠째 멈췄는지 말한다', () => {
    const got = headline({ requirement: req(), stalledDays: 20, viewer: it3, today: TODAY });
    expect(got.elapsed).toBe('20일째 멈춤');
    expect(got.tone).toBe('stall');
  });

  it('오늘 들어온 건', () => {
    const got = headline({ requirement: req(), stalledDays: 0, viewer: it3, today: TODAY });
    expect(got.elapsed).toBe('오늘 접수');
  });

  it('며칠 안 된 건', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.elapsed).toBe('3일째');
    expect(got.tone).toBe('wait');
  });

  it('완료는 경과가 아니라 소요를 말한다', () => {
    const got = headline({
      requirement: req({ status: '완료', created_at: '2026-08-18T00:00:00Z', completed_at: '2026-08-26T00:00:00Z' }),
      stalledDays: null,
      viewer: it3,
      today: TODAY,
    });
    expect(got.elapsed).toBe('8일 걸림');
    expect(got.tone).toBe('done');
  });

  it('완료일이 없으면 소요를 말하지 않는다', () => {
    const got = headline({
      requirement: req({ status: '완료', completed_at: null }),
      stalledDays: null, viewer: it3, today: TODAY,
    });
    expect(got.elapsed).toBeNull();
  });
});

describe('headline — 담당', () => {
  it('담당자가 있으면 이름을 말한다', () => {
    const got = headline({
      requirement: req({ assignee: { id: 'staff', name: '장재혁' } }),
      stalledDays: 3, viewer: it3, today: TODAY,
    });
    expect(got.assigneeText).toBe('담당 장재혁');
  });

  it('실무자에게는 담당자 없음', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.assigneeText).toBe('담당자 없음');
  });

  it('요청자에게는 기다리는 중이라고 말한다', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: requester, today: TODAY });
    expect(got.assigneeText).toBe('담당자를 기다리고 있습니다');
  });

  it('승인대기에서 담당자 본인이면 다른 사람을 기다린다고 말한다', () => {
    const got = headline({
      requirement: req({ status: '승인대기', assignee: { id: 'staff', name: '장재혁' } }),
      stalledDays: 3, viewer: it3, today: TODAY,
    });
    expect(got.assigneeText).toBe('다른 사람의 승인을 기다립니다');
    expect(got.action).toBeNull();
  });
});

describe('headline — 행동', () => {
  it('실무자는 주 버튼을 본다', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.action).toEqual({ kind: 'primary' });
  });

  it('요청자는 자기 건을 거둘 수 있다', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: requester, today: TODAY });
    expect(got.action).toEqual({ kind: 'cancel' });
  });

  it('남의 건은 거둘 수 없다', () => {
    const got = headline({
      requirement: req({ requester: { id: 'someone-else' } }),
      stalledDays: 3, viewer: requester, today: TODAY,
    });
    expect(got.action).toBeNull();
  });

  it('작성중이면 요청자가 검토 요청을 본다', () => {
    const got = headline({
      requirement: req({ status: '작성중' }),
      stalledDays: 1, viewer: requester, today: TODAY,
    });
    expect(got.action).toEqual({ kind: 'primary' });
  });

  it('승인대기면 요청자도 승인 버튼을 본다', () => {
    const got = headline({
      requirement: req({ status: '승인대기', assignee: { id: 'staff', name: '장재혁' } }),
      stalledDays: 2, viewer: requester, today: TODAY,
    });
    expect(got.action).toEqual({ kind: 'primary' });
  });

  it('병합된 건에는 행동이 없다', () => {
    const got = headline({
      requirement: req({ status: '중복' }),
      stalledDays: null, viewer: it3, today: TODAY,
    });
    expect(got.action).toBeNull();
  });

  it('종결 건은 요청자가 거둘 수 없다', () => {
    const got = headline({
      requirement: req({ status: '반려' }),
      stalledDays: null, viewer: requester, today: TODAY,
    });
    expect(got.action).toBeNull();
  });
});

describe('headline — 알약', () => {
  it('기밀', () => {
    const got = headline({
      requirement: req({ is_confidential: true }),
      stalledDays: 3, viewer: it3, today: TODAY,
    });
    expect(got.badges).toContain('비공개');
  });

  it('예상일이 지나면 지연', () => {
    const got = headline({
      requirement: req({ status: '개발중', expected_release_date: '2026-08-20' }),
      stalledDays: 3, viewer: it3, today: TODAY,
    });
    expect(got.badges).toContain('⚠ 예상일 2026-08-20 지남');
  });

  it('종결 건은 예상일이 지나도 지연이 아니다', () => {
    const got = headline({
      requirement: req({ status: '완료', expected_release_date: '2026-08-20', completed_at: '2026-08-26T00:00:00Z' }),
      stalledDays: null, viewer: it3, today: TODAY,
    });
    expect(got.badges).toEqual([]);
  });

  it('알약이 없으면 빈 배열', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.badges).toEqual([]);
  });
});

describe('headline — 빈 입력', () => {
  it('요구사항이 없으면 죽지 않는다', () => {
    const got = headline({ requirement: null, viewer: it3, today: TODAY });
    expect(got.action).toBeNull();
    expect(got.badges).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run lib/headline.test.js
```

Expected: FAIL — `Failed to resolve import "./headline"`

- [ ] **Step 3: 구현한다**

`lib/headline.js`:

```js
import { CLOSED_STATUSES, DONE_STATUS, MERGED_STATUS } from './statuses';
import { STATUS_META } from './statusMeta';
import { STALL_DAYS } from './stalled';
import { canProcess } from './tiers';
import { canApprove } from './approval';
import { canSubmitForReview } from './submitRequirement';
import { isOverdue } from './overdue';

const MS_PER_DAY = 86400000;

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 머리 줄이 말할 것을 정한다.
//
// 화면을 등급별로 나누지 않기 위해 존재하는 함수다. 같은 자리에서 문구와
// 행동만 갈리므로, 그 판정을 한곳에 모아 두면 손볼 곳이 하나다.
//
// requirement: { status, assignee, requester, is_confidential,
//                expected_release_date, created_at, completed_at }
// stalledDays: lib/stalled.js 의 값. 종결 건은 null 이다.
// viewer: { memberId, tier, isGlobalAdmin }
// today: 'YYYY-MM-DD' (지연 판정용)
//
// 반환: { tone, elapsed, assigneeText, action, badges }
export function headline({ requirement, stalledDays = null, viewer, today } = {}) {
  if (!requirement) {
    return { tone: 'flat', elapsed: null, assigneeText: null, action: null, badges: [] };
  }

  const status = requirement.status;
  const assigneeId = idOf(requirement.assignee);
  const requesterId = idOf(requirement.requester);
  const closed = CLOSED_STATUSES.includes(status);

  // --- 어조 ---
  //
  // 종결을 먼저 본다. 완료 건에 정체 일수가 붙어 오면(호출하는 쪽 실수) 붉게
  // 칠해질 텐데, 끝난 일에 경고를 다는 것이 가장 나쁜 오답이다.
  let tone;
  if (status === DONE_STATUS) tone = 'done';
  else if (status === '반려') tone = 'stall';
  else if (closed || status === '작성중') tone = 'flat';
  else if (stalledDays !== null && stalledDays >= STALL_DAYS) tone = 'stall';
  else if (status === '검토대기' || status === '승인대기') tone = 'wait';
  else tone = 'go';

  // --- 경과 ---
  //
  // 완료 건은 "며칠 지났나"가 아니라 "며칠 걸렸나"를 말한다. 끝난 일에
  // 경과를 붙이면 시간이 갈수록 숫자가 커져서 나쁜 소식처럼 읽힌다.
  let elapsed = null;
  if (status === DONE_STATUS) {
    const from = Date.parse(requirement.created_at ?? '');
    const to = Date.parse(requirement.completed_at ?? '');
    if (Number.isFinite(from) && Number.isFinite(to)) {
      elapsed = `${Math.floor((to - from) / MS_PER_DAY)}일 걸림`;
    }
  } else if (!closed && stalledDays !== null) {
    if (stalledDays >= STALL_DAYS) elapsed = `${stalledDays}일째 멈춤`;
    else if (stalledDays === 0) elapsed = '오늘 접수';
    else elapsed = `${stalledDays}일째`;
  }

  // --- 담당 ---
  //
  // 승인대기에서 담당자 본인이 보는 문구가 따로 있다. 그 사람은 승인할 수
  // 없는데(canApprove), 담당자 이름만 떠 있으면 왜 버튼이 없는지 알 수 없다.
  let assigneeText;
  if (status === '승인대기' && assigneeId && assigneeId === viewer?.memberId) {
    assigneeText = '다른 사람의 승인을 기다립니다';
  } else if (assigneeId) {
    assigneeText = `담당 ${requirement.assignee?.name ?? ''}`.trim();
  } else if (canProcess(viewer)) {
    assigneeText = '담당자 없음';
  } else {
    assigneeText = '담당자를 기다리고 있습니다';
  }

  // --- 행동 ---
  const action = resolveAction({ requirement, status, assigneeId, requesterId, viewer });

  // --- 알약 ---
  //
  // 상태와 다른 축이라 따로 붙는다. isOverdue 가 종결 건을 걸러 내므로
  // 여기서 또 걸지 않는다.
  const badges = [];
  if (requirement.is_confidential) badges.push('비공개');
  if (isOverdue(requirement.expected_release_date, status, today)) {
    badges.push(`⚠ 예상일 ${requirement.expected_release_date} 지남`);
  }

  return { tone, elapsed, assigneeText, action, badges };
}

function resolveAction({ requirement, status, assigneeId, requesterId, viewer }) {
  // 병합된 건은 서버가 상태 변경을 막는다.
  if (status === MERGED_STATUS) return null;
  const primary = STATUS_META[status]?.primary ?? null;
  if (!primary) return null;

  // 승인은 4차도 한다. 담당자 본인은 못 한다 — 개발한 사람이 자기 것을
  // 승인하면 점검 단계를 만든 목적과 정면으로 충돌한다.
  if (primary.via === 'approve') {
    const verdict = canApprove({
      requirement: { status, assignee: assigneeId },
      actor: { memberId: viewer?.memberId, isGlobalAdmin: viewer?.isGlobalAdmin === true },
    });
    return verdict.allowed ? { kind: 'primary' } : null;
  }

  // 검토 요청은 본인의 작성중 건만(3차 이상은 언제나).
  if (primary.via === 'submit') {
    return canSubmitForReview({ status, requester: requesterId }, viewer)
      ? { kind: 'primary' }
      : null;
  }

  if (canProcess(viewer)) return { kind: 'primary' };

  // 4차에게 남는 길은 자기 요청을 거두는 것 하나다. 종결된 건에는 그것도 없다.
  if (!CLOSED_STATUSES.includes(status) && requesterId && requesterId === viewer?.memberId) {
    return { kind: 'cancel' };
  }
  return null;
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run lib/headline.test.js
```

Expected: `Tests 21 passed`

- [ ] **Step 5: 전체 테스트를 돌린다**

```bash
npx vitest run
```

Expected: 기존 것 포함 전부 통과

- [ ] **Step 6: 커밋**

```bash
git add lib/headline.js lib/headline.test.js
git commit -m "feat: 머리 줄이 말할 것을 정하는 순수 함수"
```

---

## Task 4: 프리미티브 둘 — `StatusDot` 과 `PropertyRow`

**Files:**
- Create: `components/ui/StatusDot.jsx`
- Create: `components/ui/PropertyRow.jsx`

디자인 시스템의 첫 승격이다. 이 둘은 상세 화면 밖(목록·보드·회의)에서도
그대로 쓸 것이라 `ui/` 에 둔다.

- [ ] **Step 1: `StatusDot` 을 만든다**

```jsx
'use client';

// 상태 점 + 이름.
//
// 뱃지(Badge + statusStyle)와 나란히 존재하는 이유: 뱃지는 목록에서 한 칸을
// 채우는 물건이고, 이것은 문장 안에 놓이는 물건이다. 머리 줄에서 뱃지를 쓰면
// 뒤에 오는 '20일째 멈춤'과 무게가 같아져서 어느 쪽을 먼저 읽어야 할지가
// 사라진다.
//
// tone: lib/headline.js 가 정한다. 상태 이름으로 색을 다시 고르지 않는다 —
// 정체 여부처럼 상태만으로는 알 수 없는 것이 색을 바꾸기 때문이다.
const TONES = {
  stall: { text: 'text-rose-700', dot: 'bg-rose-500' },
  wait: { text: 'text-amber-700', dot: 'bg-amber-500' },
  go: { text: 'text-indigo-700', dot: 'bg-indigo-500' },
  done: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  flat: { text: 'text-slate-500', dot: 'bg-slate-300' },
};

export function StatusDot({ status, tone = 'flat' }) {
  const t = TONES[tone] ?? TONES.flat;
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${t.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}
```

- [ ] **Step 2: `PropertyRow` 를 만든다**

```jsx
'use client';

// 오른쪽 열의 한 줄. 아이콘 · 라벨 · 값.
//
// alert 는 "지금 잘못된 상태"에만 쓴다. 이 화면에서 색을 가진 행이 하나뿐이라야
// 그 한 줄이 눈에 박힌다 — 대개 담당자 미지정이다.
//
// value 가 비었을 때 회색 '—' 대신 유도 문구를 받는 이유: 배포예상일은 44건 중
// 7건, 레드마인은 1건만 채워져 있다. 네 줄 중 절반이 늘 '—' 면 그 영역이
// 죽은 것처럼 보인다.
export function PropertyRow({ icon, label, value, empty, alert = false, children }) {
  const filled = value !== null && value !== undefined && value !== '';
  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
        alert ? 'bg-amber-50' : ''
      }`}
    >
      <span
        className={`w-4 shrink-0 text-center ${alert ? 'text-amber-600' : 'text-slate-400'}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className={`flex-1 ${alert ? 'text-amber-700' : 'text-slate-500'}`}>{label}</span>
      {children ?? (
        <span
          className={
            filled ? (alert ? 'text-amber-700' : 'text-slate-900') : 'text-indigo-600'
          }
        >
          {filled ? value : (empty ?? '—')}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 빌드를 확인한다**

```bash
npm run lint && npm run build
```

Expected: lint 오류 0 (기존 `<img>` 경고 2건은 그대로), 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add components/ui/StatusDot.jsx components/ui/PropertyRow.jsx
git commit -m "feat: 디자인 시스템 프리미티브 - StatusDot, PropertyRow"
```

---

## Task 5: `StatusStrip` — 진행 스트립

**Files:**
- Create: `components/StatusStrip.jsx`

- [ ] **Step 1: 만든다**

```jsx
'use client';

import { BOARD_STATUSES } from '@/lib/statuses';

// 진행 스트립. 지난 구간은 소요일과 함께, 현재는 강조, 앞으로는 흐리게.
//
// durations 는 상세 API 가 내려주는 statusDurations 다(computeStatusDurations).
// 새로 계산하지 않는다 — 같은 값을 두 곳에서 만들면 언젠가 갈린다.
//
// 이 정보는 지금도 화면에 있다. 다만 세로 목록으로 페이지 한참 아래에 있어서,
// "이 건이 어디서 얼마나 멎었나"를 보려면 스크롤을 내려야 했다.
//
// props:
//   durations — [{ status, days, ongoing }]. status 가 null 이면 구간 불명.
//   current — 지금 상태
export function StatusStrip({ durations = [], current }) {
  // 구간을 상태별 소요일로 접는다. 같은 상태를 여러 번 오간 건은 합쳐서
  // 보여준다 — 스트립은 흐름을 말하는 자리이지 이력을 말하는 자리가 아니다.
  const spent = new Map();
  let unknown = 0;
  for (const d of durations ?? []) {
    if (!d?.status) {
      unknown += d?.days ?? 0;
      continue;
    }
    spent.set(d.status, (spent.get(d.status) ?? 0) + (d.days ?? 0));
  }

  // 보드 밖 상태(반려·취소·중복)는 스트립에 자리가 없다. 그 건은 흐름에서
  // 벗어난 것이라 머리 줄이 이미 말한다.
  const onBoard = BOARD_STATUSES.includes(current);

  return (
    <div className="flex flex-wrap items-center gap-1 overflow-x-auto text-xs">
      {BOARD_STATUSES.map((status, i) => {
        const days = spent.get(status);
        const isCurrent = onBoard && status === current;
        const isPast = days !== undefined && !isCurrent;
        return (
          <span key={status} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-slate-300" aria-hidden="true">
                ›
              </span>
            )}
            <span
              className={`rounded px-2 py-0.5 ${
                isCurrent
                  ? 'bg-amber-100 font-medium text-amber-700'
                  : isPast
                    ? 'bg-slate-100 text-slate-600'
                    : 'text-slate-400'
              }`}
            >
              {status}
              {days !== undefined && (
                <span className="ml-1">{days === 0 ? '오늘' : `${days}일`}</span>
              )}
            </span>
          </span>
        );
      })}
      {/* 구간 불명을 지우지 않는다. computeStatusDurations 가 status:null 을
          돌려주는 것은 "이 시간에 무슨 상태였는지 믿을 수 없다"는 뜻이고,
          화면이 임의로 메우면 그 정직함이 사라진다. */}
      {unknown > 0 && <span className="ml-2 text-slate-400">구간 불명 {unknown}일</span>}
    </div>
  );
}
```

- [ ] **Step 2: 빌드를 확인한다**

```bash
npm run build
```

Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add components/StatusStrip.jsx
git commit -m "feat: 진행 스트립 - 있는 값을 가로로 펴서 머리로"
```

---

## Task 6: `RequirementStatusActions` — 주 버튼과 메뉴

**Files:**
- Create: `components/RequirementStatusActions.jsx`

지금 `RequirementDetail.jsx:462-568` 의 상태 Select · 승인 버튼 · 제출 버튼 ·
`CloseActions` 가 하던 일을 한곳으로 모은다.

- [ ] **Step 1: 만든다**

```jsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { STATUS_META } from '@/lib/statusMeta';
import { menuTransitions } from '@/lib/statusActions';
import { MERGED_STATUS, REJECTED_STATUS, CANCELLED_STATUS } from '@/lib/statuses';
import { canProcess } from '@/lib/tiers';

// 주 버튼 + '⋯' 메뉴 + 종결 창.
//
// 셀렉트를 없앤 이유: 그 목록에 성격이 다른 셋이 섞여 있었다. 즉시 반영되는
// 것, 창이 뜨는 것(착수·승인), 서버가 거부하는 것(완료). 고를 수 있어 보이는데
// 다른 일이 일어난다.
//
// props:
//   status, identity
//   action — lib/headline.js 가 정한 { kind } | null
//   onPrimary() — via 에 따라 부르는 쪽이 분기한다
//   onTransition(status) — 메뉴에서 고른 상태로
//   onClose(status, reason) => Promise<boolean>
//   onMerge() — 중복 병합 창
//   compact — 모바일. 주 버튼을 가로 전체로
export function RequirementStatusActions({
  status,
  identity,
  action,
  onPrimary,
  onTransition,
  onClose,
  onMerge,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(null); // null | '반려' | '취소'
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const primary = STATUS_META[status]?.primary ?? null;
  const transitions = menuTransitions({ status, identity });
  const process = canProcess(identity);
  const merged = status === MERGED_STATUS;
  // 취소는 요청한 쪽이 거두는 것이라 4차도 한다. 반려는 IT 의 결정이라 3차 이상.
  // 그래서 취소는 메뉴 밖에 남기고 반려만 안으로 넣는다 — 요청자에게는 취소가
  // 이 화면에서 할 수 있는 유일한 행동이고, 메뉴에 숨기면 길이 사라진다.
  const canReject = process && !merged;
  const showMenu = !merged && (transitions.length > 0 || canReject || onMerge);

  async function submitClose(event) {
    event.preventDefault();
    if (!reason.trim()) {
      setError('사유를 입력해 주세요.');
      return;
    }
    setSaving(true);
    const ok = await onClose(closing, reason.trim());
    setSaving(false);
    if (ok) {
      setClosing(null);
      setReason('');
      setError('');
    } else {
      setError('종결하지 못했습니다.');
    }
  }

  if (closing) {
    return (
      <form onSubmit={submitClose} className="flex flex-col gap-2">
        <label htmlFor="close-reason" className="text-xs text-slate-500">
          {closing} 사유
        </label>
        <textarea
          id="close-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="한 달 뒤에 읽어도 알 수 있게 적어 주세요."
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            {saving ? '처리 중...' : `${closing} 확정`}
          </Button>
          <Button type="button" variant="outline" onClick={() => setClosing(null)}>
            그만두기
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={`relative flex gap-1.5 ${compact ? 'w-full' : ''}`}>
      {action?.kind === 'primary' && primary && (
        <Button
          type="button"
          onClick={onPrimary}
          className={`${compact ? 'h-10 w-full' : 'h-8'} ${
            primary.via === 'approve'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {primary.label}
        </Button>
      )}

      {action?.kind === 'cancel' && (
        <button
          type="button"
          onClick={() => setClosing(CANCELLED_STATUS)}
          className="h-8 rounded px-2 text-xs text-rose-600 hover:bg-rose-50"
        >
          요청 취소
        </button>
      )}

      {showMenu && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="다른 상태로"
            aria-expanded={open}
            className={`${compact ? 'h-10' : 'h-8'} rounded border border-slate-300 px-2 text-sm text-slate-500 hover:bg-slate-50`}
          >
            ···
          </button>
          {open && (
            <>
              {/* 바깥을 눌러 닫는다. 메뉴 안의 항목이 전부 되돌릴 수 있는
                  것은 아니라(반려), 실수로 열린 채 두는 것보다 낫다. */}
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 top-9 z-20 flex w-48 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {transitions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onTransition(s);
                    }}
                    className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {s}(으)로
                  </button>
                ))}
                {onMerge && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onMerge();
                    }}
                    className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    중복 병합
                  </button>
                )}
                {canReject && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setClosing(REJECTED_STATUS);
                    }}
                    className="mt-1 border-t border-slate-100 px-3 py-1.5 pt-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    반려
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌드를 확인한다**

```bash
npm run lint && npm run build
```

Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add components/RequirementStatusActions.jsx
git commit -m "feat: 상태 컨트롤 - 주 버튼과 메뉴"
```

---

## Task 7: `RequirementHeader` — 제목과 머리 줄

**Files:**
- Create: `components/RequirementHeader.jsx`

- [ ] **Step 1: 만든다**

```jsx
'use client';

import { StatusDot } from '@/components/ui/StatusDot';
import { StatusStrip } from '@/components/StatusStrip';
import { HelpHint } from '@/components/HelpHint';

// 제목 · 뱃지 · 머리 줄 · 진행 스트립.
//
// 머리 줄 한 줄이 이 화면의 요점이다. 지금은 "이 건이 20일째 멈췄고 담당자가
// 없다"는 사실이 회색 드롭다운 셋으로만 표시된다.
//
// props:
//   requirement, head(lib/headline 결과), durations, counts({attachments, comments})
//   projectName, typeLabel, onEditType, actions(ReactNode), children(모바일 주 버튼)
export function RequirementHeader({
  requirement: r,
  head,
  durations,
  counts,
  projectName,
  typeLabel,
  onEditType,
  actions,
}) {
  const meta = [head.elapsed, head.assigneeText].filter(Boolean);
  if (counts?.attachments) meta.push(`첨부 ${counts.attachments}`);
  if (counts?.comments) meta.push(`대화 ${counts.comments}`);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {projectName && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            {projectName}
          </span>
        )}
        {/* 점선은 '누를 수 있다'는 뜻이다. 유형은 요청자도 바꿀 수 있다. */}
        <button
          type="button"
          onClick={onEditType}
          className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          {typeLabel ?? '유형 정하기'}
        </button>
      </div>

      <h1 className="text-lg font-semibold text-slate-900">{r.title}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <StatusDot status={r.status} tone={head.tone} />
        <HelpHint anchor="status" label="상태" />
        {head.badges.map((badge) => (
          <span key={badge} className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">
            {badge}
          </span>
        ))}
        <span
          className={`text-sm ${head.tone === 'stall' ? 'text-rose-700' : 'text-slate-500'}`}
        >
          {meta.join(' · ')}
        </span>
        {/* 데스크톱에서는 오른쪽 끝, 모바일에서는 아래 전폭이다(부르는 쪽이
            compact 로 한 번 더 그린다). */}
        <div className="ml-auto hidden md:block">{actions}</div>
      </div>

      <div className="md:hidden">{actions}</div>

      <StatusStrip durations={durations} current={r.status} />
    </div>
  );
}
```

- [ ] **Step 2: `HelpHint` 의 실제 props 를 확인한다**

```bash
grep -n "export function HelpHint" -A 6 components/HelpHint.jsx
```

`anchor` 와 `label` 이 아닌 이름을 쓰고 있으면 위 호출을 그 이름으로 맞춘다.
`RequirementDetail.jsx:465-466` 이 지금 쓰는 형태가 정답이다.

- [ ] **Step 3: 빌드를 확인한다**

```bash
npm run build
```

Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add components/RequirementHeader.jsx
git commit -m "feat: 상세 머리 줄과 진행 스트립"
```

---

## Task 8: `RequirementSidebar` — 지정 넷

**Files:**
- Create: `components/RequirementSidebar.jsx`

- [ ] **Step 1: 만든다**

```jsx
'use client';

import { useState } from 'react';
import { PropertyRow } from '@/components/ui/PropertyRow';

// 오른쪽 열. 여기서 바꾸는 것 넷만 남긴다.
//
// 지금은 열 항목이 섞여 있어서 '요청 내용 · 수정에서 변경'이라는 변명 문구가
// 붙어 있다. 읽기 전용 값을 접으면 그 문구가 필요 없어진다 — 바꾸는 자리에
// 없으니 변명할 것이 없다.
//
// props: assigneeSlot, statusText, expectedSlot, redmineSlot, request({...}), children
export function RequirementSidebar({
  assigneeSlot,
  statusText,
  expectedSlot,
  redmineSlot,
  request,
  children,
}) {
  const [openRequest, setOpenRequest] = useState(false);

  return (
    <aside className="flex flex-col gap-4 text-sm">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          지정
        </p>
        <div className="flex flex-col gap-px">
          {/* 색을 가진 행은 하나뿐이다. 담당자 미지정이 이 화면에서 지금
              잘못된 유일한 상태라, 나머지가 회색이라야 눈에 박힌다. */}
          <PropertyRow icon="◍" label="담당자" alert={!assigneeSlot?.filled}>
            {assigneeSlot?.node}
          </PropertyRow>
          <PropertyRow icon="◌" label="상태" value={statusText} />
          <PropertyRow icon="▤" label="배포예상일">
            {expectedSlot}
          </PropertyRow>
          <PropertyRow icon="↗" label="레드마인">
            {redmineSlot}
          </PropertyRow>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => setOpenRequest((v) => !v)}
          aria-expanded={openRequest}
          className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
        >
          <span aria-hidden="true">{openRequest ? '▾' : '▸'}</span>요청 내용
        </button>
        {openRequest ? (
          <dl className="mt-2 flex flex-col gap-1 text-xs">
            {request.rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-slate-800">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{request.summary}</p>
        )}
      </div>

      {children}
    </aside>
  );
}
```

- [ ] **Step 2: 빌드를 확인한다**

```bash
npm run build
```

Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add components/RequirementSidebar.jsx
git commit -m "feat: 오른쪽 열 - 바꾸는 것 넷만"
```

---

## Task 9: 첨부 — `Lightbox` 와 `RequirementAttachments`

**Files:**
- Create: `components/ui/Lightbox.jsx`
- Create: `components/RequirementAttachments.jsx`

- [ ] **Step 1: `Lightbox` 를 만든다**

```jsx
'use client';

import { useEffect } from 'react';

// 이미지 확대. 같은 페이지에서 연다.
//
// 새 탭으로 나가면 본문과 대조할 수 없다. 첨부의 9할이 화면 캡처이고 실무자가
// 그걸 보고 판단하므로, To-Be 를 읽다가 그림을 확인하고 돌아오는 왕복이
// 끊기면 안 된다.
export function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!src) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || '첨부 이미지'}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
    >
      <img
        src={src}
        alt={alt || ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm text-slate-700"
      >
        닫기
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `RequirementAttachments` 를 만든다**

```jsx
'use client';

import { useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';
import { ImageDropzone } from '@/components/ImageDropzone';

// 첨부. 비율을 지켜 크게 보여준다.
//
// 지금은 80px 정사각형에 object-cover 로 잘린다. 가로로 긴 화면 캡처가
// 가운데 한 조각만 남아서 무엇이 찍혔는지 알 수 없다.
//
// 크게 보여도 되는 근거: 첨부가 있는 건은 44건 중 7건이고 평균 1.6장, 최대
// 3장이다. 자리를 아낄 이유가 없다.
//
// props: pics, docs, canEdit, onDelete(id), newFiles, onAddFiles, onRemoveFile, onUpload
export function RequirementAttachments({
  pics = [],
  docs = [],
  canEdit,
  onDelete,
  newFiles = [],
  onAddFiles,
  onRemoveFile,
  onUpload,
}) {
  const [zoom, setZoom] = useState(null);
  const single = pics.length === 1;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        첨부 {pics.length + docs.length}
      </p>

      {pics.length > 0 && (
        <div className={single ? '' : 'grid grid-cols-2 gap-2 sm:grid-cols-3'}>
          {pics.map((img) => (
            // group 은 삭제 버튼을 올려놨을 때만 띄우기 위한 것이다. 지금은
            // 썸네일 위에 늘 떠 있어서 보려다 지울 수 있다.
            <div key={img.id} className="group relative">
              <button
                type="button"
                onClick={() => setZoom({ src: img.signedUrl, alt: img.file_name ?? '' })}
                className="block w-full"
              >
                <img
                  src={img.signedUrl}
                  alt={img.file_name ?? ''}
                  className={`w-full rounded border border-slate-200 object-contain ${
                    single ? 'max-h-90' : 'max-h-44'
                  }`}
                />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(img.id)}
                  aria-label={`${img.file_name ?? '이미지'} 삭제`}
                  className="absolute right-1 top-1 hidden rounded-full bg-slate-900/70 px-1.5 text-xs text-white group-hover:block"
                >
                  ×
                </button>
              )}
              {img.file_name && (
                <p className="mt-1 truncate text-[11px] text-slate-400">{img.file_name}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 문서는 썸네일을 만들 수 없다. 이미지 격자에 회색 네모로 섞으면 무슨
          파일인지 알 수 없으므로 파일명이 보이는 행으로 따로 뺀다. */}
      {docs.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <a
            href={f.signedUrl}
            download={f.file_name ?? undefined}
            className="flex-1 truncate text-indigo-600 hover:underline"
            title={f.file_name ?? ''}
          >
            {f.file_name || '이름 없는 파일'}
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={() => onDelete(f.id)}
              aria-label={`${f.file_name ?? '파일'} 삭제`}
              className="shrink-0 text-xs text-slate-400 hover:text-rose-600"
            >
              삭제
            </button>
          )}
        </div>
      ))}

      {pics.length === 0 && docs.length === 0 && (
        <p className="text-sm text-slate-400">첨부된 파일이 없습니다.</p>
      )}

      {canEdit && (
        <div className="mt-1">
          <ImageDropzone files={newFiles} onAdd={onAddFiles} onRemove={onRemoveFile} />
          {newFiles.length > 0 && (
            <button
              type="button"
              onClick={onUpload}
              className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
            >
              {newFiles.length}개 업로드
            </button>
          )}
        </div>
      )}

      <Lightbox src={zoom?.src} alt={zoom?.alt} onClose={() => setZoom(null)} />
    </section>
  );
}
```

- [ ] **Step 3: `max-h-90` 이 Tailwind v4 에 있는지 확인한다**

```bash
npm run build
```

없으면 `max-h-[360px]` 로 바꾼다. 스펙이 정한 값은 360px 다.

Expected: 빌드 성공

- [ ] **Step 4: `ImageDropzone` 의 props 이름을 확인한다**

```bash
grep -n "export function ImageDropzone" -A 5 components/ImageDropzone.jsx
```

`files` / `onAdd` / `onRemove` 가 맞는지 본다 — `RequirementDetail.jsx:440-443`
이 지금 쓰는 형태가 정답이다.

- [ ] **Step 5: 커밋**

```bash
git add components/ui/Lightbox.jsx components/RequirementAttachments.jsx
git commit -m "feat: 첨부를 잘라내지 않고 크게, 라이트박스로 확대"
```

---

## Task 10: `RequirementDetail` 조립

**Files:**
- Modify: `components/RequirementDetail.jsx`

가장 큰 태스크다. 앞의 여섯을 끼워 넣고 본문을 정리한다.

- [ ] **Step 1: 새 import 를 더한다**

`components/RequirementDetail.jsx` 상단:

```js
import { RequirementHeader } from '@/components/RequirementHeader';
import { RequirementStatusActions } from '@/components/RequirementStatusActions';
import { RequirementSidebar } from '@/components/RequirementSidebar';
import { RequirementAttachments } from '@/components/RequirementAttachments';
import { headline } from '@/lib/headline';
import { stalledDays } from '@/lib/stalled';
import { STATUS_META } from '@/lib/statusMeta';
```

- [ ] **Step 2: 주 버튼 하나가 세 갈래로 가게 한다**

`changeStatus` 아래에 더한다. 기존 `changeStatus` 는 그대로 둔다 — 메뉴가
그것을 쓴다.

```js
  // 주 버튼 한 개가 상태에 따라 다른 곳으로 간다. 어디로 갈지는
  // STATUS_META.primary.via 가 정한다 — 화면이 상태 이름으로 다시 분기하면
  // 상태를 추가할 때 여기를 빼먹는다.
  async function runPrimary() {
    const primary = STATUS_META[data?.requirement?.status]?.primary;
    if (!primary) return;
    if (primary.via === 'submit') return submitForReview();
    if (primary.via === 'start') return setStartOpen(true);
    if (primary.via === 'approve') return setApprovalOpen(true);
    if (primary.via === 'resume') return setResumeOpen(true);
    return changeStatus(primary.to);
  }
```

`resumeOpen` 상태를 다른 `useState` 옆에 더한다.

```js
  const [resumeOpen, setResumeOpen] = useState(false);
```

- [ ] **Step 3: 머리 줄에 필요한 값을 계산한다**

`const { requirement: r, ... } = data;` 아래에 더한다.

```js
  // 정체 일수는 회의 화면과 같은 함수를 쓴다. 회의 안건에 오른 건을 상세에서
  // 열었을 때 다른 숫자가 보이면 둘 중 하나가 틀린 것이다.
  //
  // history 는 상세 API 가 이미 내려주는 change_logs 다. 코멘트는 ActivityFeed
  // 가 따로 불러오므로 여기서는 넘기지 않는다 — 정체 판정이 코멘트 하나만큼
  // 늦어질 수 있으나, 그 때문에 상세 API 를 늘리는 것보다 낫다.
  const days = stalledDays({
    requirement: r,
    changeLogs: history ?? [],
    now: new Date().toISOString(),
  });
  const head = headline({
    requirement: r,
    stalledDays: days,
    viewer: identity,
    today,
  });
  const actions = (
    <RequirementStatusActions
      status={r.status}
      identity={identity}
      action={head.action}
      onPrimary={runPrimary}
      onTransition={changeStatus}
      onClose={closeRequirement}
      onMerge={processAllowed ? () => setMergeOpen(true) : null}
    />
  );
```

`mergeOpen` 은 지금 이 파일에 있는 병합 창 상태를 그대로 쓴다. 이름이 다르면
그 이름으로 맞춘다.

```bash
grep -n "Merge" components/RequirementDetail.jsx
```

- [ ] **Step 4: 머리 줄을 넣고 옛 제목 블록을 걷어낸다**

`mergedInto` 배너 아래, 본문 grid 위에 넣는다. 지금 grid 밖에 있는 제목
`<h1>` 과 `수정` 링크는 이 컴포넌트가 대신하므로 지운다. `수정` 링크는
머리 줄의 `···` 옆이 아니라 그 자리에 그대로 남긴다 — 편집 모드는 이번
범위 밖이다.

```jsx
      <RequirementHeader
        requirement={r}
        head={head}
        durations={statusDurations}
        counts={{ attachments: images.length, comments: commentCount }}
        projectName={r.project?.name}
        typeLabel={r.requirement_type}
        onEditType={() => setEditing(true)}
        actions={actions}
      />
```

`r.project?.name` 이 실제 필드명과 다르면 맞춘다.

```bash
grep -n "project" app/api/requirements/\[id\]/route.js | head -5
```

- [ ] **Step 5: 본문 카드를 문서로 바꾼다**

`RequirementDetail.jsx:369-380` 의 `<section className="rounded-lg border ...">`
세 개를 아래로 바꾼다.

```jsx
            <div className="max-w-[68ch]">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                As-Is
              </p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{r.as_is}</p>
            </div>

            {/* To-Be 에만 강조선을 준다. 실무자가 이 화면에서 찾는 것은
                "뭘 만들어야 하나"다. 순서는 그대로 As-Is → To-Be 다 —
                문제를 먼저 읽는 것이 자연스럽다. */}
            <div className="max-w-[68ch] border-l-2 border-indigo-500 pl-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-600">
                To-Be
              </p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{r.to_be}</p>
            </div>
```

`비고` 는 접는다.

```jsx
            {r.note && (
              <details className="max-w-[68ch] border-y border-slate-100 py-2">
                <summary className="cursor-pointer text-sm text-slate-500">비고</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                  {r.note}
                </p>
              </details>
            )}
```

- [ ] **Step 6: 첨부 섹션을 새 컴포넌트로 바꾼다**

`RequirementDetail.jsx:386-455` 의 첨부 `<section>` 전체를 지우고 넣는다.

```jsx
          <RequirementAttachments
            pics={pics}
            docs={docs}
            canEdit={canEdit}
            onDelete={deleteImage}
            newFiles={newFiles}
            onAddFiles={(added) => setNewFiles((prev) => [...prev, ...added])}
            onRemoveFile={(i) => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onUpload={uploadNew}
          />
```

`pics` 와 `docs` 를 만드는 줄은 그대로 둔다.

- [ ] **Step 7: 본문 아래 순서를 바꾼다**

본문 열의 끝이 **첨부 → 연결 → 하위 작업 → 비고 → 대화** 가 되게 옮긴다.
`RequirementLinks` 는 첨부 아래로, `ChecklistSection` 과 `ActivityFeed` 는
grid 밖에서 본문 열 안으로 들어온다.

`StatusDurations` 호출(710줄)은 **지운다** — 같은 정보를 머리의 스트립이
말한다. `components/StatusDurations.jsx` 파일은 남긴다(다른 화면이 쓸 수 있다).

- [ ] **Step 8: 오른쪽 열을 새 컴포넌트로 바꾼다**

`<aside>`(462-694줄) 전체를 지우고 넣는다. 담당자·예상일 컨트롤은 지금 쓰는
것을 그대로 슬롯으로 넘긴다.

```jsx
        <RequirementSidebar
          assigneeSlot={{ filled: Boolean(r.assignee), node: assigneeSelect }}
          statusText={r.status}
          expectedSlot={
            <ExpectedDateField
              value={r.expected_release_date}
              overdue={isOverdue(r.expected_release_date, r.status, today)}
              editable={processAllowed}
              onSave={changeExpectedDate}
            />
          }
          redmineSlot={redmineField}
          request={{
            summary: `${r.requester?.name ?? '요청자 없음'} · ${r.request_date ?? ''}`,
            rows: [
              ['카테고리', r.category_name],
              ['채널', r.channel],
              ['우선순위', r.priority],
              ['요청자', r.requester?.name],
              ['요청일', r.request_date],
            ],
          }}
        />
```

`assigneeSelect` 와 `redmineField` 는 지금 `<aside>` 안에 있던 JSX 를 그대로
변수로 뽑아 쓴다. `r.category_name` · `r.channel` 의 실제 필드명은 지금
`<aside>` 가 쓰는 것을 그대로 따른다.

- [ ] **Step 9: 빈 값을 유도 문구로 바꾼다**

`RequirementDetail.jsx` 안 `ExpectedDateField`(약 862줄)의 읽기 표시에서
`'-'` 를 바꾼다.

```jsx
        <span className={overdue ? 'font-medium text-rose-600' : 'font-medium text-slate-900'}>
          {value ? (overdue ? `⚠ ${value} 지연` : value) : null}
        </span>
        {!value && <span className="text-indigo-600">＋ 정하기</span>}
```

배포예상일은 44건 중 7건, 레드마인은 1건만 채워져 있다. 회색 `-` 로 두면 네
줄 중 절반이 늘 비어 보이고, 그 영역이 죽은 것처럼 읽힌다. 레드마인 필드도
같은 규칙으로 맞춘다.

- [ ] **Step 10: 모바일 순서를 바꾼다**

`<aside>` 에 붙어 있던 `order-first ... md:order-none` 을 **뺀다.** 머리 줄이
그 일을 하므로 오른쪽 열은 본문 아래로 내려가는 것이 맞다.

grid 는 그대로 `grid-cols-1 md:grid-cols-[minmax(0,1fr)_16rem]` 형태를 쓴다.

- [ ] **Step 11: 재개 창을 붙인다**

종결 건의 `재개` 버튼이 열 창이다. 지금 보드 밖 상태에서 쓰던 `재개 — 상태
선택` Select 를 창으로 옮긴 것이라, 새 컴포넌트를 만들지 않고 기존
`Dialog` 로 짠다.

```jsx
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>어느 상태로 되돌릴까요?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {DIRECT_STATUSES.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                onClick={() => {
                  setResumeOpen(false);
                  changeStatus(s);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
```

`DIRECT_STATUSES` 를 `@/lib/statuses` 에서 import 한다.

- [ ] **Step 12: 전체 검사**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: 테스트 전부 통과, lint 오류 0, 빌드 성공

- [ ] **Step 13: 줄 수를 확인한다**

```bash
wc -l components/RequirementDetail.jsx
```

Expected: 500줄 아래. 그보다 크면 아직 들어내지 못한 덩어리가 있다는 뜻이니
어느 것인지 확인하고 옮긴다.

- [ ] **Step 14: 커밋**

```bash
git add components/RequirementDetail.jsx
git commit -m "refactor: 상세 화면을 새 조각들로 조립"
```

---

## Task 11: 손으로 확인하고 배포한다

**Files:** 없음

- [ ] **Step 1: 개발 서버로 확인한다**

`.claude/launch.json` 의 `moa-dev` 를 띄우고 `/requirements/<id>` 를 연다.
상태가 다른 건을 최소 넷 확인한다 — 검토대기 · 검토중 · 완료 · 반려.

확인할 것:
1. 머리 줄에 상태·경과·담당·첨부 수가 뜨는가
2. 진행 스트립의 소요일이 예전 `StatusDurations` 와 같은 값인가
3. `검토 시작`을 누르면 착수 창이 뜨는가
4. `···` 에 완료가 **없는가**
5. 병합된 건에 버튼도 메뉴도 없는가
6. 첨부 이미지가 잘리지 않고, 눌렀을 때 같은 페이지에서 확대되는가
7. 375px 로 줄였을 때 주 버튼이 전폭이고 오른쪽 열이 본문 아래인가

- [ ] **Step 2: 4차 계정으로 확인한다**

요청자 계정으로 자기 건을 연다.

1. `요청 취소`가 보이는가
2. `···` 이 안 보이는가
3. 승인대기 건에서 `승인하고 완료`가 보이는가

- [ ] **Step 3: 배포 ZIP 을 만든다**

```bash
npm run package:src
```

`package:src` 여야 한다. `npm run package` 는 빌드 완료본이라 플랫폼이 소스에서
다시 빌드하는 지금 방식에서는 실패한다.

- [ ] **Step 4: 배포한다**

마이그레이션은 없다. ZIP 만 올리면 된다.

---

## 자체 점검

**스펙 대응**

| 스펙 절 | 태스크 |
|---|---|
| 1. 머리 줄 | 3 · 7 |
| 2. 진행 스트립 | 5 · 10(Step 7) |
| 3. 상태 컨트롤 | 1 · 2 · 6 · 10(Step 2·11) |
| 4. 오른쪽 열 | 4 · 8 · 10(Step 8·9) |
| 5. 본문 | 10(Step 5) |
| 6. 첨부 | 9 · 10(Step 6) |
| 7. 대화 · 하위 작업 · 연결 | 10(Step 7) |
| 8. 모바일 | 6(compact) · 7 · 10(Step 10) |
| 9. 파일 분할 | 4~10 |
| 10. 디자인 시스템 승격 | 4 |
| 11. 서버 무변경 | 전 태스크. 라우트 파일을 아무도 열지 않는다 |
| 12. 테스트 | 1 · 2 · 3 |

**확인된 것**

- `STATUS_META.next` 가 이미 이 계획의 버튼 문구와 같다(`IT — 검토 시작`,
  `IT — 개발 착수`, `IT — QA 시작`, `IT — 승인 요청`). 추측이 아니다.
- `computeStatusDurations` · `canApprove` · `canSubmitForReview` · `isOverdue`
  는 전부 기존 함수다. 새로 만들지 않는다.

**남는 위험**

Task 10 이 크다. 지금 `<aside>` 안에 있는 담당자 Select · 레드마인 필드 ·
프로젝트 Select 를 슬롯으로 뽑아내는 일이 손이 많이 가고, 필드명(`category_name`
· `channel` · `project`)을 이 계획이 코드로 확인하지 못했다. 각 Step 에 확인
명령을 붙여 두었으니 그 자리에서 맞춘다.

프로젝트 Select 는 오른쪽 열의 `children` 슬롯으로 내린다(Task 10 Step 8).
머리 줄의 뱃지를 누를 수 있게 하는 안도 있었지만, 뱃지 둘이 다 눌리면 점선이
'누를 수 있다'는 뜻을 잃는다. 가르는 규칙은 **누가 바꾸는가**다 — 유형은
요청자도 바꾸므로 머리 줄에, 프로젝트는 3차 이상만 바꾸므로 오른쪽 열에 둔다.
