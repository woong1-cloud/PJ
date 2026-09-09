# 협조 요청 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 항목의 역할(주관·지원·결정권)로 참여자에게 협조를 요청한다. 사람이 눌러야 나가고, 활동에 남고, 메일과 벨이 간다.

**Architecture:** 새 테이블을 안 만든다 — 협조 요청은 **댓글**이고 `request_roles text[]` 하나로 구별한다. 받는 사람은 `launch_members` 를 역할로 좁혀 **서버가 다시 만든다**. 3단계의 댓글·알림·메일을 그대로 쓴다.

**Tech Stack:** Next.js 16 App Router (JS) · React 19 · Tailwind v4 · Vitest (`environment: 'node'` — DOM 없음)

**스펙:** `docs/superpowers/specs/2026-09-09-launch-help-request-design.md`
**목업:** `agent/pj/help-request-ideation.html`

---

## 이미 있는 것

| | |
|---|---|
| `launch_task_comments` | 3단계. 여기에 컬럼 하나만 더한다 |
| `launch_members` (역할 → 사람) | 참여자 명단 |
| `mentionableFromMembers(rows)` | `lib/launchMentionable.js`. 조인 객체에서 id·이름을 꺼내고 중복을 없앤다 |
| `splitRoles(value)` | `lib/launchMembers.js`. 쉼표로 둘 든 역할을 나눈다 |
| `?task=<코드>` 링크 | 2단계. 메일·벨이 걸 곳 |
| `sendMailToMany` · `insertNotificationRows` · `runQuietly` | `lib/mailer.js` · `lib/notify.js` |
| `SUBJECT_PREFIX` · `shorten` · `body` · `absoluteUrl` | `lib/emailContent.js` (이름 확인됨) |
| `requireLaunchAccess(id, 'member')` | `lib/permissions.js` |

**마이그레이션은 `0037` 하나 — 컬럼 추가뿐이다.**

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0037_help_request_roles.sql` (새로) | `request_roles text[]` |
| `lib/helpRequest.js` (새로) | 순수 로직 넷 — 기본 역할·수신자·상한·중복 |
| `lib/helpRequest.test.js` (새로) | 위의 테스트 |
| `lib/emailContent.js` (고침) | `helpRequestEmail` 더하기 |
| `lib/notify.js` (고침) | `notifyHelpRequest` 더하기 |
| `app/api/launch/[id]/help-requests/route.js` (새로) | POST |
| `app/api/launch/[id]/help-requests/recent/route.js` (새로) | GET — 24시간 검사 |
| `components/launch/HelpRequestDialog.jsx` (새로) | 요청 창 |
| `components/launch/TaskViewDialog.jsx` (고침) | 「협조 요청」 단추 |
| `components/launch/LaunchBoard.jsx` (고침) | 여러 줄 배너에 단추 · 창 렌더 |

## 앞 단계에서 물린 것 — 또 밟지 않기

**① 숫자는 그것이 데려가는 곳과 같아야 한다.** 1단계 두 번, 2단계 한 번.
**이번 위험 지점:** 화면이 「5명에게 보내기」라 했는데 실제로 3명에게 가는 것.
받는 사람을 **서버가 다시 만들기 때문에** 갈릴 수 있다(비활성 팀원 등).
**보낸 뒤 실제 수를 돌려주고 화면이 그것을 말한다.**

**② 조인해서 온 필드는 객체다.** `launch_members.member` 가 그렇다.
`mentionableFromMembers` 가 이미 처리하니 **다시 쓰지 말고 그것을 쓴다.**

**③ 다이얼로그 안 단추는 닫기 X 자리를 피한다.** `pr-10`. 2단계에서 20px 깔렸다.

**④ 렌더 테스트가 없다.** 브라우저 확인이 검증의 절반이다.

---

### Task 1: 마이그레이션 — `0037`

**Files:** Create `supabase/migrations/0037_help_request_roles.sql`

- [ ] **Step 1: 파일을 만든다**

```sql
-- 0037: 협조 요청은 댓글이다
--
-- 새 테이블을 안 만든다. 요청의 본체는 사람이 쓴 한마디이고, 그것이 활동에
-- 남아야 "언제 누구에게 요청했더라"에 답이 된다 — 댓글이 이미 그 자리다.
--
-- 이 칸이 비어 있으면 평범한 댓글, 차 있으면 협조 요청이다. 그래서 활동에서
-- 다르게 그릴 수 있고, 24시간 안에 또 보내는 것도 이 칸으로 찾는다.
--
-- 인덱스는 새로 안 만든다. 24시간 검사가 (항목, 시각)으로 훑는데
-- idx_launch_task_comments_task 가 이미 (task_id, created_at) 이다.
alter table launch_task_comments
  add column if not exists request_roles text[];
```

- [ ] **Step 2: 돌리지 않는다**

**이 SQL 을 실행하지 마세요.** 프로덕션 DB 는 사용자가 직접 돌립니다.
파일만 만들고 보고하세요.

- [ ] **Step 3: 커밋**

```bash
git add -- supabase/migrations/0037_help_request_roles.sql
git commit -m "feat: 협조 요청 역할 컬럼"
```

---

### Task 2: `lib/helpRequest.js` — 순수 로직

**Files:**
- Create: `lib/helpRequest.js`
- Test: `lib/helpRequest.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
import { describe, expect, it } from 'vitest';
import {
  MAX_RECIPIENTS,
  defaultRoles,
  recentlyAsked,
  recipientsForRoles,
  tooMany,
} from './helpRequest';

const member = (id, name, roleName, isActive = true) => ({
  member_id: id,
  role_name: roleName,
  member: { id, name, is_active: isActive },
});

describe('defaultRoles', () => {
  it('막힘이면 결정권 — 막힌 것의 상대는 거의 늘 결정권이다', () => {
    expect(defaultRoles({ status: '막힘', decision_org: 'CAIO실', owner_role: '물류팀' }))
      .toEqual(['CAIO실']);
  });

  it('막힘이 아니면 주관', () => {
    expect(defaultRoles({ status: '할 것', decision_org: 'CAIO실', owner_role: '물류팀' }))
      .toEqual(['물류팀']);
  });

  it('막힘인데 결정권이 비어 있으면 주관으로 떨어진다 — 빈 화면을 주지 않는다', () => {
    expect(defaultRoles({ status: '막힘', decision_org: '', owner_role: '물류팀' }))
      .toEqual(['물류팀']);
  });

  it('쉼표로 둘 든 값을 나눈다 — support_role 에 실제로 그런 값이 있다', () => {
    expect(defaultRoles({ status: '할 것', owner_role: '재무팀 , 법무팀' }))
      .toEqual(['재무팀', '법무팀']);
  });

  it('아무 역할도 없으면 빈 목록', () => {
    expect(defaultRoles({ status: '할 것' })).toEqual([]);
    expect(defaultRoles()).toEqual([]);
  });
});

describe('recipientsForRoles', () => {
  const members = [
    member('a', '변기석', '물류팀'),
    member('b', '장재혁', 'CAIO실'),
    member('c', '황경임', '물류팀'),
  ];

  it('고른 역할의 사람만 준다', () => {
    expect(recipientsForRoles(members, ['물류팀']).map((m) => m.id).sort())
      .toEqual(['a', 'c']);
  });

  it('역할 둘이면 합친다', () => {
    expect(recipientsForRoles(members, ['물류팀', 'CAIO실']).length).toBe(3);
  });

  it('한 사람이 두 역할이어도 한 번만 — PK 가 셋이라 줄이 둘이다', () => {
    const both = [member('a', '변기석', '물류팀'), member('a', '변기석', 'CAIO실')];
    expect(recipientsForRoles(both, ['물류팀', 'CAIO실']).map((m) => m.id)).toEqual(['a']);
  });

  it('비활성 팀원은 뺀다 — 보내도 안 읽는다', () => {
    const gone = [member('z', '나간사람', '물류팀', false)];
    expect(recipientsForRoles(gone, ['물류팀'])).toEqual([]);
  });

  it('역할이 없거나 명단이 비면 빈 목록', () => {
    expect(recipientsForRoles(members, [])).toEqual([]);
    expect(recipientsForRoles([], ['물류팀'])).toEqual([]);
    expect(recipientsForRoles()).toEqual([]);
  });
});

describe('tooMany', () => {
  it('20명까지는 보낸다', () => {
    expect(tooMany(MAX_RECIPIENTS)).toBe(false);
  });

  it('넘으면 세운다 — 역할을 잘못 골라 30명이 되는 것을 막는다', () => {
    expect(tooMany(MAX_RECIPIENTS + 1)).toBe(true);
  });

  it('0 명도 못 보낸다는 뜻은 아니다 — 그건 부르는 쪽이 따로 본다', () => {
    expect(tooMany(0)).toBe(false);
  });
});

describe('recentlyAsked', () => {
  const now = new Date('2026-09-09T10:00:00Z');
  const at = (iso, roles) => ({ created_at: iso, request_roles: roles });

  it('24시간 안에 같은 역할로 나갔으면 찾는다', () => {
    expect(recentlyAsked([at('2026-09-08T18:00:00Z', ['CAIO실'])], ['CAIO실'], now))
      .toEqual(['CAIO실']);
  });

  it('24시간이 지났으면 아니다', () => {
    expect(recentlyAsked([at('2026-09-08T09:00:00Z', ['CAIO실'])], ['CAIO실'], now))
      .toEqual([]);
  });

  it('다른 역할로 나간 것은 아니다', () => {
    expect(recentlyAsked([at('2026-09-09T09:00:00Z', ['물류팀'])], ['CAIO실'], now))
      .toEqual([]);
  });

  it('평범한 댓글은 안 센다 — request_roles 가 비어 있다', () => {
    expect(recentlyAsked([at('2026-09-09T09:00:00Z', null)], ['CAIO실'], now)).toEqual([]);
  });

  it('겹치는 역할만 준다', () => {
    expect(recentlyAsked([at('2026-09-09T09:00:00Z', ['CAIO실', '물류팀'])],
      ['CAIO실', '재무팀'], now)).toEqual(['CAIO실']);
  });

  it('빈 입력에 안 터진다', () => {
    expect(recentlyAsked([], ['CAIO실'], now)).toEqual([]);
    expect(recentlyAsked()).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run lib/helpRequest.test.js`
Expected: FAIL — `Cannot find module './helpRequest'`

**눈으로 확인한 뒤 다음으로.**

- [ ] **Step 3: 구현한다**

```js
import { splitRoles } from './launchMembers';
import { mentionableFromMembers } from './launchMentionable';
import { BLOCKED_STATUS } from './launchTask';

// 한 번에 몇 명까지.
//
// Gmail 한도 때문이 아니다 — 역할당 3~5명이라 회당 3~5통이고 한도의 몇 %다.
// 사람 때문이다. 역할을 잘못 골라 30명에게 나가면 그 뒤로 아무도 안 읽는다.
// weeklyDigest.js 가 같은 이유로 개별 리마인더를 안 만든다.
export const MAX_RECIPIENTS = 20;

// 같은 역할로 또 보내기 전에 알려 주는 창.
const RECENT_HOURS = 24;

// 미리 고를 역할.
//
// 막힘의 상대는 거의 늘 결정권이다. 매번 고르게 하면 같은 것을 반복한다.
// 결정권이 비어 있으면 주관으로 떨어진다 — 빈 화면을 주지 않는다.
export function defaultRoles(task) {
  if (!task) return [];
  if (task.status === BLOCKED_STATUS) {
    const decision = splitRoles(task.decision_org);
    if (decision.length > 0) return decision;
  }
  return splitRoles(task.owner_role);
}

// 고른 역할의 참여자.
//
// mentionableFromMembers 를 다시 쓴다 — 조인해서 온 member 객체에서 id·이름을
// 꺼내고, 비활성을 빼고, 한 사람이 두 역할이어도 한 번만 주는 일을 이미 한다.
// 여기서 새로 쓰면 그 판정이 두 곳으로 갈라진다.
export function recipientsForRoles(members = [], roles = []) {
  const wanted = new Set((roles ?? []).filter(Boolean));
  if (wanted.size === 0) return [];
  return mentionableFromMembers(
    (members ?? []).filter((m) => wanted.has(m?.role_name)),
  );
}

// 상한을 넘었나. 0 은 넘은 것이 아니다 — "고른 사람이 없다"는 부르는 쪽이 본다.
export function tooMany(count) {
  return Number(count) > MAX_RECIPIENTS;
}

// 최근에 같은 역할로 나간 요청이 있나. 겹치는 역할만 돌려준다.
//
// 막지 않는다. 정말 다시 보내야 할 때가 있다 — 판단은 사람이 한다.
// 여기서는 "어제 이미 보냈습니다"를 말할 재료만 준다.
export function recentlyAsked(comments = [], roles = [], now = new Date()) {
  const wanted = new Set((roles ?? []).filter(Boolean));
  if (wanted.size === 0) return [];
  const since = now.getTime() - RECENT_HOURS * 60 * 60 * 1000;
  const hit = new Set();
  for (const c of comments ?? []) {
    const list = c?.request_roles;
    if (!Array.isArray(list) || list.length === 0) continue;
    const at = new Date(c.created_at ?? 0).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    for (const r of list) if (wanted.has(r)) hit.add(r);
  }
  return [...hit];
}
```

**`BLOCKED_STATUS` 가 `lib/launchTask.js` 에 그 이름으로 있는지 확인하세요.**
없으면 고치지 말고 보고하세요.

- [ ] **Step 4: 통과를 확인한다**

```
npx vitest run lib/helpRequest.test.js
npm run test
```
Expected: 새 테스트 **21개** (`it` 블록 기준) · 전체 기존 것 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add -- lib/helpRequest.js lib/helpRequest.test.js
git commit -m "feat: 협조 요청 순수 로직"
```

---

### Task 3: 라우트 둘

**Files:**
- Create: `app/api/launch/[id]/help-requests/route.js` (POST)
- Create: `app/api/launch/[id]/help-requests/recent/route.js` (GET)

**먼저 읽으세요:** `app/api/launch/[id]/tasks/[taskId]/comments/route.js` — 가드·
오류 처리·`launch_id` 이중 확인의 본보기입니다.

- [ ] **Step 1: POST**

```js
const { id } = await params;
const { memberId } = await requireLaunchAccess(id, 'member');
const { taskIds, roles, message } = await request.json();
```

**`const { id } = await params;` 를 가드보다 먼저** 씁니다.

순서가 중요합니다:

1. **항목이 이 런칭의 것인지 확인** — `launch_tasks` 에서 `.in('id', taskIds).eq('launch_id', id)`.
   받은 개수와 다르면 `ApiError(404, '항목을 찾을 수 없습니다.')`.
   **안 하면 주소를 고쳐 남의 런칭에 요청을 넣을 수 있습니다.**
2. **받는 사람을 서버가 다시 만든다** — `launch_members` 를 이 런칭으로 좁혀 읽고
   `recipientsForRoles(rows, roles)`. **화면이 보낸 사람 목록을 믿지 않습니다.**
3. `recipients.length === 0` → `ApiError(400, '그 역할에 참여자가 없습니다.')`
4. `tooMany(recipients.length)` → `ApiError(400, '한 번에 20명까지 보낼 수 있습니다.')`
5. 항목마다 `launch_task_comments` 에 한 줄:
   ```js
   { task_id, author: memberId, body: 본문, request_roles: roles }
   ```
   **본문**은 사람이 쓴 한마디입니다. 비어 있으면
   `'협조를 요청했습니다.'` 를 넣습니다 — `body` 가 `not null` 입니다.
6. 알림·메일 — Task 4 의 `notifyHelpRequest` 를 마지막에 한 줄로 부릅니다.
   **이번 작업에서는 아직 안 부릅니다**(Task 4 가 만듭니다).
7. **실제 수를 돌려줍니다:** `Response.json({ sent: recipients.length, tasks: taskIds.length })`

전체를 `try { } catch (error) { return errorResponse(error); }` 로 감쌉니다.

- [ ] **Step 2: GET recent**

`?taskIds=a,b,c` 를 받아 그 항목들의 **최근 24시간 요청 댓글**을 돌려줍니다.

```js
// 창이 열릴 때 한 번 부른다. 보내기 전에 "어제 이미 보냈습니다"를 말할
// 재료다 — 막지 않고 알려만 준다.
```

`launch_task_comments` 에서 `.in('task_id', ids)` +
`.gte('created_at', 24시간 전)` + `request_roles` 가 있는 것만.
`{ recent: [{ task_id, request_roles, created_at }] }` 로 줍니다.

**여기서도 항목이 이 런칭의 것인지 확인합니다.**

- [ ] **Step 3: 확인하고 커밋**

```
npx vitest run lib/launchRouteGuard.test.js
npm run test
```
Expected: 가드 테스트가 **새 핸들러 둘을 자동으로 잡고** 통과.

```bash
git add -- "app/api/launch/[id]/help-requests"
git commit -m "feat: 협조 요청 라우트"
```

---

### Task 4: 메일과 알림

**Files:**
- Modify: `lib/emailContent.js`, `lib/notify.js`
- Modify: `app/api/launch/[id]/help-requests/route.js` (한 줄)

- [ ] **Step 1: `helpRequestEmail`**

`lib/emailContent.js` 에 더합니다. **기존 것은 안 건드립니다.**

```js
// 협조 요청 메일.
//
// 제목에 항목 코드를 넣는다 — 메일함에서 무엇에 대한 것인지 알아야 열린다.
// launchMentionEmail 과 같은 이유다.
//
// 사람당 한 통이고, 항목이 여럿이면 목록을 본문에 담는다. 항목마다 보내면
// 3건 × 5명 = 15통이 된다.
export function helpRequestEmail({ tasks, roles, actorName, launchId, launchName, message, baseUrl }) {
  const one = tasks.length === 1 ? tasks[0] : null;
  const by = actorName ? `${actorName}님이 ` : '누군가 ';
  const lines = tasks.map((t) => `· ${t.code} ${t.title}`);
  return {
    subject: one
      ? `${SUBJECT_PREFIX} 협조 요청 — ${one.code} ${shorten(one.title)}`
      : `${SUBJECT_PREFIX} 협조 요청 — ${launchName} ${tasks.length}건`,
    text: body({
      lines: [`${by}${roles.join(' · ')}에 협조를 요청했습니다.`, '', ...lines]
        .concat(message ? ['', `"${message}"`] : []),
      url: absoluteUrl(
        baseUrl,
        one ? `/launch/${launchId}?task=${encodeURIComponent(one.code)}` : `/launch/${launchId}`,
      ),
    }),
  };
}
```

**`SUBJECT_PREFIX`·`shorten`·`body`·`absoluteUrl` 이름은 확인했습니다.**
실제와 다르면 고치지 말고 보고하세요.

- [ ] **Step 2: `notifyHelpRequest`**

`lib/notify.js` 에 `notifyLaunchComment` 를 본보기로 더합니다.

```js
// 협조 요청 알림.
//
// 벨도 사람당 하나다. 항목이 여럿이면 "3건" 이라 적고 런칭으로 보낸다 —
// 여러 코드를 가리키는 필터가 없다. 자세한 것은 메일이 담는다.
export async function notifyHelpRequest({ launchId, tasks, roles, actorId, recipientIds, message }) {
```

- 벨: `insertNotificationRows` 로 사람당 한 줄.
  `link` 는 항목이 하나면 `/launch/${launchId}?task=${code}`, 여럿이면 `/launch/${launchId}`
- 메일: `sendMailToMany(이메일들, helpRequestEmail({...}))`
- **`requirement_id` 는 안 넣습니다** — 그 컬럼은 `requirements(id)` FK 라
  런칭 항목 id 를 못 넣습니다
- **절대 throw 하지 않습니다.** `try`/`catch` + `runQuietly` + `logFailure` 를
  `notifyLaunchComment` 와 같은 모양으로. 메일이 실패했다고 「요청 실패」를 보이면
  안 됩니다 — 댓글은 이미 저장됐습니다

- [ ] **Step 3: POST 가 부르게 한다**

POST 의 `return` **직전에** 한 줄. 이 파일에서 다른 것은 안 건드립니다.

- [ ] **Step 4: 확인하고 커밋**

```
npm run test
npx eslint lib/emailContent.js lib/notify.js "app/api/launch/[id]/help-requests"
```

```bash
git add -- lib/emailContent.js lib/notify.js "app/api/launch/[id]/help-requests/route.js"
git commit -m "feat: 협조 요청 메일과 알림"
```

---

### Task 5: 화면

**Files:**
- Create: `components/launch/HelpRequestDialog.jsx`
- Modify: `components/launch/TaskViewDialog.jsx`
- Modify: `components/launch/LaunchBoard.jsx`

- [ ] **Step 1: `HelpRequestDialog`**

```jsx
// props: open, launchId, launchName, tasks(배열), members, myMemberId, onClose, onSent
```

목업(`agent/pj/help-request-ideation.html`)의 요청 창을 옮깁니다. 담을 것:

| | |
|---|---|
| 머리 | 한 건이면 「협조 요청 · 18-22 물류 창고 계약」, 여럿이면 「협조 요청 — 3건」 |
| 경고 | 「받는 사람에게 메일이 나갑니다. 활동에도 남아 다른 사람이 또 보내지 않습니다.」 |
| 항목 목록 | 여럿일 때만. **24시간 안에 요청 나간 것에 표시** + 체크를 풀 수 있게 |
| 역할 칩 | `defaultRoles(task)` 로 미리 고름. 역할마다 **참여자 수**를 숫자로 |
| 받는 사람 | `recipientsForRoles` 결과. **0명이면 「명단에 넣으면 보낼 수 있습니다」** |
| 한마디 | `textarea`. 안내: 「언제까지 필요한지 적으면 답이 빨라집니다.」 |
| 보내기 | 「N명에게 보내기」. **0명이거나 `tooMany` 면 못 누름** |

**창이 열릴 때 `GET .../help-requests/recent` 를 한 번 부릅니다.**
실패하면 조용히 비웁니다 — 경고는 편의이고, 실패를 배너로 띄우면 "요청이 안 되나?"로
읽힙니다.

**보낸 뒤 실제 수를 말합니다** — 응답의 `sent` 를 씁니다. 화면이 센 수가 아닙니다
(§앞 단계 ①).

**`DialogTitle` 에 `pr-10`** — 닫기 X 가 `absolute top-2 right-2 size-7` 이라
오른쪽 36px 을 먹습니다.

- [ ] **Step 2: 항목 창에 단추**

`TaskViewDialog` 의 머리, 「고치기」 **왼쪽**에:

```jsx
<button type="button" onClick={() => onHelpRequest?.(task)} className="...">
  협조 요청
</button>
```

`onHelpRequest` 를 props 로 받아 `LaunchBoard` 가 창을 엽니다.
**단추 둘이 들어가므로 `pr-10` 만으로 충분한지 폭을 확인하세요** — 좁으면
「고치기」와 함께 `⋯` 로 접거나 줄바꿈을 허용합니다(`flex-wrap` 이 이미 있습니다).

- [ ] **Step 3: 여러 줄 배너에 단추**

`LaunchBoard` 의 `{picked.size > 0 && (...)}` 배너, 「해당없음으로」 **옆**에:

```jsx
<button
  type="button"
  disabled={bulkBusy}
  onClick={() => setHelpFor([...picked])}
  className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
>
  협조 요청
</button>
```

`view === 'na'` 일 때는 **안 그립니다** — 해당없음으로 둔 것에 협조를 구할 일이
없습니다.

- [ ] **Step 4: 창을 렌더한다**

`LaunchBoard` 에 `helpFor` state 를 두고, 있으면 `HelpRequestDialog` 를 조건부로
그립니다. **조건부로 그립니다** — 닫혀도 계속 그리면 지난 항목이 남습니다
(이 병이 네 창에 있었습니다).

보낸 뒤(`onSent`)에는 `setPicked(new Set())` 로 선택을 놓고, 활동이 바뀌었으므로
**항목 창이 열려 있으면 그 활동을 다시 받게** 합니다.

- [ ] **Step 5: 확인한다**

```
npm run build && npm run test && npm run lint
```

**로그인이 필요해 눈으로 못 보면 "못 봤다"고 명확히 보고하세요.**

- [ ] **Step 6: 커밋**

```bash
git add -- components/launch/HelpRequestDialog.jsx components/launch/TaskViewDialog.jsx components/launch/LaunchBoard.jsx
git commit -m "feat: 협조 요청 화면"
```

---

### Task 6: 점검과 배포

- [ ] **Step 1: 전체**

```
npm run test && npm run lint && npm run build
```

- [ ] **Step 2: SQL 을 사용자에게 넘긴다**

`supabase/migrations/0037_help_request_roles.sql`. **직접 실행하지 마세요.**

- [ ] **Step 3: 브라우저 확인**

**낡은 dev 서버를 먼저 죽입니다** — 3단계에서 그것 때문에 500 이 나 하마터면
리팩터를 의심할 뻔했습니다.

| | |
|---|---|
| 참여자 없는 역할 | 「명단에 넣으면 보낼 수 있습니다」, 못 보냄 |
| 20명 초과 | 화면이 세우고 **주소로 직접 쏴도 400** |
| 24시간 안에 재요청 | 경고가 뜨고 **그래도 보낼 수 있다** |
| 보낸 뒤 | 활동에 한 줄 · 벨 · 메일 |
| 여러 건 | **사람당 한 통**에 목록이 담긴다 |
| **실제 발송 수** | **화면이 말한 수와 같다** |
| 해당없음 보기 | 「협조 요청」 단추가 **안 보인다** |

- [ ] **Step 4: 배포**

```
npm run package:src
```

---

## 안 하는 것

| | 왜 |
|---|---|
| 자동 발송 | 스펙 §1 — `weeklyDigest.js` 의 판단 |
| 막힘 창에서 함께 묻기 | 막힘 = 협조 요청이 아니다 |
| 요청 상태 추적 | 답은 댓글로 온다. 상태를 따로 두면 둘이 어긋난다 |
| 재촉 | §1 이 막는 바로 그것이다 |
