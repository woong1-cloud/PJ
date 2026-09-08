# 런칭 3단계 — 활동(댓글·멘션) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2단계에서 만든 항목 보기 창 아래에 활동이 붙는다. 그 런칭의 참여자를 `@` 로 부를 수 있고, 부르면 벨과 메일이 간다.

**Architecture:** `ActivityFeed`(723줄)의 껍데기를 일반화하지 않는다 — 하드코딩된 URL 이 다섯이고 하나는 이미지 업로드다. 대신 **이미 깨끗한 안쪽 부품을 꺼내** 공용 파일로 옮기고, 런칭용 껍데기를 작게 새로 쓴다. 알림은 `in_app_notifications.link` 가 이미 있어 스키마 변경이 없다.

**Tech Stack:** Next.js 16 App Router (JS) · React 19 · Tailwind v4 · Vitest (`environment: 'node'` — DOM 없음)

**스펙:** `docs/superpowers/specs/2026-09-08-launch-activity-step3-design.md`
**목업:** `agent/pj/launch-task-view.html`

---

## 이미 있는 것

| | |
|---|---|
| `in_app_notifications.link` | **있다.** `notificationHref` 가 `requirement_id` 보다 먼저 본다 |
| `?task=<코드>` 링크 | **있다.** 2단계. 알림이 갈 곳이 이것이다 |
| `lib/mentions.js` | **있다.** 한국어 조사 처리까지. 그대로 쓴다 |
| `canModifyComment(comment, memberId)` | **있다.** `lib/comments.js` |
| `mentionMessage(actorName, title)` | **있다.** 이름·제목만 받는다 |
| `requireLaunchAccess(id, 'member')` | **있다.** |
| `assigneeId(task)` | **있다.** 조인해 온 객체에서 id 를 꺼낸다 |

**마이그레이션은 `0036` 하나뿐이다.**

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0036_launch_task_comments.sql` (새로) | 댓글 테이블 |
| `components/comments/MentionTextarea.jsx` (옮김) | @자동완성 입력칸. **127줄, 이미 독립적** |
| `components/comments/CommentPieces.jsx` (옮김) | `Avatar` · `fmt` · `CommentBody` · `CommentEntry` · `CommentComposer` |
| `components/ActivityFeed.jsx` (고침) | 요구사항 껍데기. 위 둘을 임포트. **화면은 그대로** |
| `lib/launchMentionable.js` (새로) | 멘션 후보 = `launch_members`. **관문이다** |
| `app/api/launch/[id]/mentionable/route.js` (새로) | 위를 노출 |
| `app/api/launch/[id]/tasks/[taskId]/comments/route.js` (새로) | GET · POST |
| `.../comments/[commentId]/route.js` (새로) | PATCH · DELETE |
| `lib/notifications.js` (고침) | `launchCommentRecipients` |
| `lib/notify.js` (고침) | `notifyLaunchComment` |
| `components/launch/TaskActivity.jsx` (새로) | 런칭 껍데기. 작다 |
| `components/launch/TaskViewDialog.jsx` (고침) | 활동을 몸통 아래·입력칸을 발에 |

## 앞 단계에서 물린 것 — 또 밟지 않기

**① 숫자는 그것이 데려가는 곳과 같아야 한다.** 1단계 두 번, 2단계 한 번.
**이번 위험 지점:** 「@ 는 참여자 3명」이라 적어 놓고 목록에 다른 수가 뜨는 것.

**② 조인해서 온 필드는 객체다.** `task.assignee` 가 `{id,name}` 이라 1단계
필터가 늘 거짓이었다. `comment.author` 도 같다 — **`canModifyComment` 를 쓴다.**

**③ 다이얼로그 안 단추는 닫기 X 자리를 피한다.** 2단계에서 「고치기」가 20px
깔렸다. `pr-10` 으로 고쳤다.

**④ 로컬 state 를 없앨 때 그것에 기대던 것이 조용히 죽는다.** 2단계에서
「← 돌아가기」가 그럴 뻔했다.

---

### Task 1: 마이그레이션 — `0036`

**Files:** Create `supabase/migrations/0036_launch_task_comments.sql`

- [ ] **Step 1: 파일을 만든다**

```sql
-- 0036: 런칭 항목 댓글
--
-- requirement_comments(0010) 와 같은 모양이다. 한 테이블에 합치지 않는다 —
-- 요구사항과 런칭 항목은 다른 테이블이고, 한 컬럼에 두 종류의 FK 를 담으면
-- on delete cascade 를 못 건다.
--
-- launch_id 를 두지 않는다. 댓글은 늘 특정 항목에 딸려 조회되고 런칭은
-- launch_tasks 에서 온다. 복제하면 둘이 어긋날 수 있다.
--
-- 이미지 첨부는 안 넣는다. 요구사항도 0026 으로 나중에 붙였다 —
-- 글부터 오가는지 보고 정한다.
create table if not exists launch_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references launch_tasks(id) on delete cascade,
  author uuid references team_members(id),
  body text not null,
  created_at timestamptz not null default now(),
  -- 수정되면 채워진다. null 이면 한 번도 안 고친 댓글이다.
  edited_at timestamptz
);

create index if not exists idx_launch_task_comments_task
  on launch_task_comments (task_id, created_at);
```

- [ ] **Step 2: 돌리지 않는다**

**이 SQL 을 실행하지 마세요.** 프로덕션 DB 는 사용자가 직접 돌립니다.
파일만 만들고 보고하세요.

- [ ] **Step 3: 커밋**

```bash
git add -- supabase/migrations/0036_launch_task_comments.sql
git commit -m "feat: 런칭 항목 댓글 테이블"
```

---

### Task 2: 부품을 꺼낸다 — 리팩터

**Files:**
- Create: `components/comments/MentionTextarea.jsx`
- Create: `components/comments/CommentPieces.jsx`
- Modify: `components/ActivityFeed.jsx`

**이 작업의 성공 조건은 "아무것도 안 바뀌는 것"이다.** 요구사항 상세 화면이
한 픽셀도 달라지면 실패다.

- [ ] **Step 1: 무엇을 옮길지 먼저 센다**

```
grep -n "^function \|^const .* = (" components/ActivityFeed.jsx
wc -l components/ActivityFeed.jsx
```

옮길 것: `MentionTextarea`(127줄) · `Avatar` · `fmt` · `CommentBody` ·
`CommentEntry` · `CommentComposer` · `CommentImages`.
**안 옮길 것:** `TabButton` · `ChangeEntry`(이력 전용, 런칭엔 이력이 없다) ·
바깥 `ActivityFeed` 자체.

**옮기기 전에 각각이 정말 독립적인지 확인하세요:**
```
for f in MentionTextarea CommentComposer CommentEntry CommentBody Avatar CommentImages; do
  echo "$f: $(awk "/^function $f\(/,/^}/" components/ActivityFeed.jsx | grep -c 'requirement\|brandId\|fetch(')"
done
```
Expected: 전부 **0**. 하나라도 0 이 아니면 **멈추고 보고하세요** — 옮기면
안 되는 것입니다.

- [ ] **Step 2: `MentionTextarea` 를 옮긴다**

`components/comments/MentionTextarea.jsx` 를 만들고 그 함수를 **글자 그대로**
옮깁니다. 주석도 그대로. 맨 위에 `'use client';` 와 필요한 임포트
(`useState`/`useRef` 등, `@/lib/mentions` 의 `filterMentionCandidates` ·
`findMentionQuery` · `MENTION_CANDIDATE_LIMIT` 등 — 실제로 쓰는 것만)를 넣고
`export function MentionTextarea` 로 바꿉니다.

**@목록에 높이 상한을 겁니다.** 지금은 상한이 없습니다:

```
max-h-[min(20rem,40vh)] overflow-y-auto
```

목록을 그리는 요소의 className 에 더하세요. **왜 필요한지:** 런칭에서는 이
입력칸이 창(dialog) **아래**에 있어 목록이 위로 뜹니다. 상한이 없으면 후보
8명(`MENTION_CANDIDATE_LIMIT`)에 화면 세로 460px 일 때 창 위로 삐져나갑니다 —
목업에서 재서 잡았습니다. 20rem(320px)이면 800px 화면에서 8명이 다 보이고,
상한이 무는 것은 8명을 어차피 못 보여줄 만큼 화면이 얕을 때뿐입니다.

요구사항 화면(페이지)에서는 목록이 아래로 뜨므로 이 상한이 사실상 안 뭅니다.

- [ ] **Step 3: 나머지 부품을 옮긴다**

`components/comments/CommentPieces.jsx` 에 `Avatar` · `fmt` · `CommentBody` ·
`CommentEntry` · `CommentComposer` · `CommentImages` 를 옮기고 export 합니다.
`CommentComposer` 는 `MentionTextarea` 를 임포트합니다.

**이미지를 props 로 끕니다.** `CommentComposer` 와 `CommentEntry` 가 지금
이미지 기능을 안에 갖고 있습니다. 아래처럼 **없으면 안 그리게** 바꿉니다:

```js
// onUploadImages 가 없으면 첨부 UI 를 안 그린다. 런칭 댓글은 이미지를
// 안 받는다 — 요구사항도 0026 으로 나중에 붙였다.
```

`ActivityFeed`(요구사항)는 지금 하던 그대로 넘기므로 **동작이 안 바뀝니다.**

- [ ] **Step 4: `ActivityFeed` 가 임포트하게 한다**

옮긴 함수 정의를 지우고 임포트로 바꿉니다. **`ActivityFeed` 의 JSX·상태·fetch
는 하나도 안 건드립니다.**

- [ ] **Step 5: 확인한다**

```
npm run build && npm run test && npm run lint
```
Expected: 빌드 성공 · **76 파일 / 1180 테스트** · 새 lint 오류 없음
(기존 `components/ImageDropzone.jsx:125` 경고 하나는 원래 있던 것).

**렌더 테스트가 없으므로 눈으로 봐야 합니다.** `npm run dev` 로 띄워
요구사항 상세를 열고:
1. 활동 탭이 그대로인가 (전체/코멘트 탭, 이력 줄, 코멘트 줄)
2. `@` 를 쳤을 때 자동완성이 뜨는가
3. 이미지 첨부 단추가 그대로 있는가

**로그인이 안 되면 그 단계는 건너뛰고 보고하세요.**

- [ ] **Step 6: 커밋**

```bash
git add -- components/comments/ components/ActivityFeed.jsx
git commit -m "refactor: 코멘트 부품을 공용으로 꺼낸다"
```

---

### Task 3: 멘션 후보 — `lib/launchMentionable.js`

**Files:**
- Create: `lib/launchMentionable.js`
- Test: `lib/launchMentionable.test.js`
- Create: `app/api/launch/[id]/mentionable/route.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

순수 부분만 테스트합니다. `lib/launchMentionable.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { mentionableFromMembers } from './launchMentionable';

const row = (id, name, roleName, isActive = true) => ({
  member_id: id,
  role_name: roleName,
  member: { id, name, is_active: isActive },
});

describe('mentionableFromMembers', () => {
  it('참여자를 이름순으로 준다', () => {
    expect(mentionableFromMembers([row('b', '황경임', '재무팀'), row('a', '변기석', '물류팀')]))
      .toEqual([{ id: 'a', name: '변기석' }, { id: 'b', name: '황경임' }]);
  });

  it('한 사람이 두 역할이어도 한 번만 준다 — PK 가 셋이라 줄이 둘이다', () => {
    expect(mentionableFromMembers([row('a', '변기석', '재무팀'), row('a', '변기석', '법무팀')]))
      .toEqual([{ id: 'a', name: '변기석' }]);
  });

  it('비활성 팀원은 뺀다 — 부르면 알림만 쌓인다', () => {
    expect(mentionableFromMembers([row('a', '나간사람', '재무팀', false)])).toEqual([]);
  });

  it('이름이 없으면 뺀다 — 빈 이름은 @ 하나로 아무나 걸린다', () => {
    expect(mentionableFromMembers([row('a', '', '재무팀')])).toEqual([]);
    expect(mentionableFromMembers([{ member_id: 'a', role_name: '재무팀', member: null }])).toEqual([]);
  });

  it('빈 목록은 빈 목록', () => {
    expect(mentionableFromMembers([])).toEqual([]);
    expect(mentionableFromMembers()).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run lib/launchMentionable.test.js`
Expected: FAIL — `Cannot find module './launchMentionable'`

- [ ] **Step 3: 구현한다**

```js
// 이 런칭에서 부를 수 있는 사람들 = launch_members.
//
// 범위는 "그 런칭을 열 수 있는 사람"이다. 열지도 못하는 사람을 부르면 벨에
// 알림은 뜨는데 눌러 들어가면 403 이 뜬다 — 안 부른 것보다 나쁘다.
//
// 이 목록은 두 곳이 함께 쓴다: 입력창 자동완성(편의)과 알림 수신자
// 판정(관문). 화면이 보내온 이름이 아니라 서버가 다시 만든 이 목록으로 본문을
// 해석하므로, 화면 목록을 조작해 남을 부르는 길은 없다.
// lib/mentionable.js 와 같은 규칙이다.
//
// 전체 관리자를 자동으로 넣지 않는다. 넣으면 모든 런칭의 후보에 늘 셋이 껴
// 있다 — 전체 관리자도 참여자로 넣으면 되고, 그게 명단을 진짜로 만드는 길이다.

// 순수 부분. launch_members 조인 결과를 후보 목록으로 줄인다.
export function mentionableFromMembers(rows = []) {
  const seen = new Set();
  const out = [];
  for (const r of rows ?? []) {
    const m = r?.member;
    const name = String(m?.name ?? '').trim();
    // 이름이 빈 사람을 남기면 안 된다. ''.startsWith 는 어느 위치에서나
    // 통과해서 '@' 하나가 그 사람 멘션이 되어버린다(lib/mentions.js 참조).
    if (!m?.id || !name) continue;
    if (m.is_active === false) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// 조회 + 줄이기. 라우트와 notify 가 같이 쓴다.
export async function loadLaunchMentionable(supabase, { launchId }) {
  if (!launchId) return [];
  const { data, error } = await supabase
    .from('launch_members')
    .select('member_id, role_name, member:team_members!launch_members_member_id_fkey(id, name, is_active)')
    .eq('launch_id', launchId);
  if (error) return [];
  return mentionableFromMembers(data);
}
```

**FK 이름(`launch_members_member_id_fkey`)이 실제와 다르면 조회가
PGRST201(모호한 관계)로 실패합니다.** `supabase/migrations/0031_launch.sql` 과
`0034_launch_members.sql` 에서 실제 제약 이름을 확인하고, 다르면 **고치지 말고
보고하세요.**

- [ ] **Step 4: 라우트를 만든다**

`app/api/launch/[id]/mentionable/route.js`:

```js
import { requireLaunchAccess } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { loadLaunchMentionable } from '@/lib/launchMentionable';

// 자동완성용. 이 목록이 곧 알림이 갈 수 있는 사람의 상한이다 —
// 서버가 본문을 해석할 때도 같은 함수를 쓴다.
export async function GET(request, { params }) {
  const { id } = await params;
  await requireLaunchAccess(id, 'member');
  const members = await loadLaunchMentionable(getSupabaseAdmin(), { launchId: id });
  return Response.json({ members });
}
```

**실제 라우트들의 오류 처리 관례를 먼저 보고 맞추세요** — 이 저장소는
`ApiError` 와 공용 래퍼를 씁니다. `app/api/launch/[id]/tasks/route.js` 를
본보기로 삼으세요.

- [ ] **Step 5: 확인하고 커밋**

```
npx vitest run lib/launchMentionable.test.js
npm run test
npm run build
```
Expected: 새 테스트 6개 통과 · 전체 **76+1 파일 / 1186 테스트** ·
`launchRouteGuard.test.js` 가 새 라우트를 자동으로 잡고 통과.

```bash
git add -- lib/launchMentionable.js lib/launchMentionable.test.js "app/api/launch/[id]/mentionable/route.js"
git commit -m "feat: 런칭 멘션 후보는 그 런칭의 참여자"
```

---

### Task 4: 댓글 라우트

**Files:**
- Create: `app/api/launch/[id]/tasks/[taskId]/comments/route.js`
- Create: `app/api/launch/[id]/tasks/[taskId]/comments/[commentId]/route.js`

- [ ] **Step 1: 본보기를 읽는다**

`app/api/requirements/[id]/comments/route.js` (GET·POST) 와
`app/api/requirements/[id]/comments/[commentId]/route.js` (PATCH·DELETE) 를
읽고 **같은 모양으로** 만듭니다. 오류 처리·응답 형태를 그대로 따르세요.

- [ ] **Step 2: 네 핸들러를 만든다**

| | 하는 일 |
|---|---|
| `GET` | 그 항목의 댓글을 `created_at` 오름차순으로. 글쓴이 이름을 조인 |
| `POST` | `{ body }` 를 받아 저장. `author` 는 `requireLaunchAccess` 가 준 `memberId` |
| `PATCH` | 본문 수정 + `edited_at = now()` |
| `DELETE` | 지우기 |

**전부 `requireLaunchAccess(id, 'member')` 로 시작합니다.**
`PATCH`/`DELETE` 는 그 뒤에 `canModifyComment(comment, memberId)` 를 한 번 더
봅니다 — 글쓴이 본인만 고치고 지웁니다.

**`comment.author` 는 조인하면 객체로 옵니다.** `canModifyComment` 가 그
판정을 하므로 **직접 `===` 로 견주지 마세요.** (1단계에서 `task.assignee` 를
그렇게 견줘서 「내 담당」이 영영 0이었습니다.)

**`taskId` 로 지울 때 `launch_id` 도 함께 겁니다.** 주소를 손으로 고쳐 다른
런칭의 항목을 건드리는 길을 막습니다 — `tasks/[taskId]/route.js` 가 이미
그렇게 합니다.

- [ ] **Step 3: 확인하고 커밋**

```
npm run test
```
Expected: `launchRouteGuard.test.js` 가 **새 핸들러 넷을 자동으로 잡고** 통과.
가드를 빠뜨렸으면 여기서 실패합니다.

```bash
git add -- "app/api/launch/[id]/tasks/[taskId]/comments"
git commit -m "feat: 런칭 항목 댓글 라우트"
```

---

### Task 5: 알림

**Files:**
- Modify: `lib/notifications.js`, `lib/notifications.test.js`
- Modify: `lib/notify.js`
- Modify: 댓글 `POST` 라우트 (마지막에 한 줄)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/notifications.test.js` 에 더합니다:

```js
describe('launchCommentRecipients', () => {
  const task = (over = {}) => ({ assignee: null, ...over });

  it('담당자와 멘션된 사람에게 간다', () => {
    const r = launchCommentRecipients(task({ assignee: { id: 'a', name: '가' } }), 'me', ['b']);
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('담당자가 객체로 와도 꺼낸다 — 조인해서 오는 모양이다', () => {
    const r = launchCommentRecipients(task({ assignee: { id: 'a', name: '가' } }), 'me', []);
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('담당자가 문자열이어도 받는다', () => {
    const r = launchCommentRecipients(task({ assignee: 'a' }), 'me', []);
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('본인은 뺀다 — 자기 글에 자기가 알림을 받으면 안 된다', () => {
    expect(launchCommentRecipients(task({ assignee: { id: 'me' } }), 'me', ['me'])).toEqual([]);
  });

  it('담당자가 멘션도 됐으면 한 번만, mentioned 로 준다', () => {
    const r = launchCommentRecipients(task({ assignee: { id: 'a' } }), 'me', ['a']);
    expect(r).toEqual([{ id: 'a', mentioned: true }]);
  });

  it('담당자가 없으면 멘션된 사람만', () => {
    expect(launchCommentRecipients(task(), 'me', ['b']).map((x) => x.id)).toEqual(['b']);
  });
});
```

임포트 줄에 `launchCommentRecipients` 를 더하세요.

- [ ] **Step 2: 실패를 확인하고 구현한다**

Run: `npx vitest run lib/notifications.test.js` → FAIL

`lib/notifications.js` 에 더합니다:

```js
import { assigneeId } from './launchMembers';

// 런칭 댓글의 수신자 = 담당자 + 멘션된 사람. 본인은 뺀다.
//
// commentRecipients 를 못 쓴다 — 그건 resolveRecipients(requirement) 를 거쳐
// 요청자/담당자를 읽는데, 런칭 항목에는 요청자가 없다.
//
// 담당자는 assigneeId 로 꺼낸다. 조인해서 오면 { id, name } 객체다 —
// 문자열과 === 로 견주면 늘 거짓이고, 1단계에서 실제로 그 버그가 있었다.
export function launchCommentRecipients(task, actorId, mentionedIds = []) {
  if (!actorId) return [];
  const mentioned = new Set(
    (Array.isArray(mentionedIds) ? mentionedIds : []).filter((id) => id && id !== actorId),
  );
  const out = [];
  const seen = new Set();
  const owner = assigneeId(task);
  if (owner && owner !== actorId) {
    seen.add(owner);
    out.push({ id: owner, mentioned: mentioned.has(owner) });
  }
  for (const id of mentioned) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, mentioned: true });
  }
  return out;
}
```

- [ ] **Step 3: `notify.js` 에 진입점을 만든다**

`notifyComment` 를 본보기로 `notifyLaunchComment({ launchId, taskId, actorId, body })`
를 더합니다. 하는 일:

1. 항목(`code`, `title`, `assignee`)과 런칭 이름을 읽는다
2. `loadLaunchMentionable(supabase, { launchId })` 로 후보를 **서버가 다시 만든다**
3. 부른 사람을 뽑는다 — `notify.js:193` 이 쓰는 그 모양 그대로:
   ```js
   const mentionedIds = parseMentions(body, mentionable).map((m) => m.id);
   ```
4. `launchCommentRecipients(task, actorId, mentionedIds)` 로 수신자를 정한다
5. `in_app_notifications` 에 넣는다 — **`link: \`/launch/${launchId}?task=${task.code}\`**
6. 멘션된 사람에게 메일(`mentionEmail`)

**문구는 `mentionMessage(actorName, title)` 를 그대로 씁니다.**

**이 함수는 절대 throw 하지 않습니다.** `notify.js` 의 규칙입니다 — 알림
insert 가 실패했다고 사용자가 「댓글 등록 실패」를 보면 안 됩니다. 댓글은 이미
저장됐으므로 그 메시지는 거짓말이고, 되지도 않는 재시도를 하게 됩니다.
그 파일 맨 위 주석에 그렇게 적혀 있습니다.

- [ ] **Step 4: 댓글 POST 가 부르게 한다**

라우트가 자기 일을 끝낸 **뒤 마지막에** 한 줄로 부릅니다(요구사항 쪽과 같은 자리).

- [ ] **Step 5: 확인하고 커밋**

```
npm run test && npm run build
```

```bash
git add -- lib/notifications.js lib/notifications.test.js lib/notify.js "app/api/launch/[id]/tasks/[taskId]/comments/route.js"
git commit -m "feat: 런칭 댓글 멘션 알림"
```

---

### Task 6: 화면 — `TaskActivity`

**Files:**
- Create: `components/launch/TaskActivity.jsx`
- Modify: `components/launch/TaskViewDialog.jsx`

- [ ] **Step 1: `TaskActivity` 를 쓴다**

```jsx
'use client';
// 런칭 항목의 활동.
//
// 이력이 없다. 요구사항엔 change_logs 가 있지만 런칭엔 updated_by 한 칸뿐이다.
// 재료가 없는 「기록」 탭을 만들지 않는다 — 지라는 전체/댓글/기록/업무 로그로
// 가르지만, 빈 탭은 고장으로 보인다.
//
// 순서는 오래된 것 위, 새 것 아래. 요구사항 활동과 같다
// (lib/activityFeed.js: "정렬은 오래된 것이 위, 새 것이 아래다").
// 지라는 반대(최신 먼저·입력 위)인데 모아 안의 일관성이 먼저다.
//
// props: launchId, taskId, memberId, onCountChange?
```

- `GET /api/launch/<launchId>/tasks/<taskId>/comments` 로 목록
- `GET /api/launch/<launchId>/mentionable` 로 후보
- `buildActivityFeed([], comments)` 를 그대로 씀
- 줄은 `CommentEntry`, 입력은 `CommentComposer` — **이미지 props 는 안 넘김**
- 후보를 못 받아도 **댓글은 쓸 수 있어야 합니다.** 자동완성은 편의입니다 —
  실패를 배너로 띄우면 "댓글이 안 되나?"로 읽힙니다. 조용히 비웁니다
  (`ActivityFeed` 가 같은 이유로 그렇게 합니다)

**입력창 안내 문구:**
```
무엇이 막고 있는지, 언제 풀릴지 적어 주세요. @로 참여자를 부를 수 있습니다.
```

- [ ] **Step 2: 창에 붙인다**

`TaskViewDialog` 의 **몸통 맨 아래**에 활동 목록을, **발**에 입력칸을 둡니다.

2단계에서 이미 `flex max-h-[85vh] flex-col overflow-hidden` + 몸통만 스크롤로
잡아 뒀습니다. **`DialogFooter` 자리에 입력칸이 들어갑니다** — 「닫기」와 같은
줄이 좁으면 입력칸을 그 위 한 줄로 올리세요.

**왜 발인가:** 요구사항 상세는 *페이지*라 입력칸이 목록 맨 아래여도 되지만,
창은 높이가 갇혀 있어 그러면 댓글 12건 아래로 스크롤해야 답을 씁니다.

`launchId` 와 `taskId` 를 `LaunchBoard` 에서 넘겨야 합니다
(`launch.id`, `viewTask.id`).

- [ ] **Step 3: 확인한다**

```
npm run build && npm run test && npm run lint
```

**그리고 `npm run dev` 로 눈으로 보세요** (로그인이 안 되면 건너뛰고 보고):

| 볼 것 | 기대 |
|---|---|
| 항목을 열고 댓글을 남긴다 | 목록 아래에 붙는다 |
| `@` 를 친다 | **참여자만** 뜬다. 「@ 는 참여자 N명」 문구가 있으면 **그 수와 목록 수가 같아야 한다** |
| 화면 세로를 460px 로 줄이고 `@` | **@목록이 창 위로 안 삐져나간다** |
| 댓글 12건 | **입력칸이 늘 보인다**(발 고정) |
| 「고치기」 단추 | **닫기 X 와 안 겹친다**(`pr-10`) |
| 요구사항 상세 | **아무것도 안 바뀌었다** ← Task 2 의 회귀 확인 |

- [ ] **Step 4: 커밋**

```bash
git add -- components/launch/TaskActivity.jsx components/launch/TaskViewDialog.jsx components/launch/LaunchBoard.jsx
git commit -m "feat: 항목 창에 활동(댓글·멘션)"
```

---

### Task 7: 점검과 배포

- [ ] **Step 1: 전체**

```
npm run test && npm run lint && npm run build
```

- [ ] **Step 2: 사용자가 SQL 을 돌린다**

`supabase/migrations/0036_launch_task_comments.sql` 을 **사용자에게 넘깁니다.**
직접 실행하지 마세요.

- [ ] **Step 3: 배포**

```
npm run package:src
```

`npm run package` 가 아닙니다.

---

## 안 하는 것

| | 왜 |
|---|---|
| 「기록」 탭 | 런칭에 이력 자료가 없다. 빈 탭은 고장으로 보인다 |
| 댓글 이미지 첨부 | 요구사항도 나중에 붙였다 |
| 댓글 수 배지 | 목록을 안 받고는 못 센다. 471줄에 요청 471번을 못 부른다 |
| 요구사항 화면 변경 | Task 2 의 절반은 리팩터다. 기존 화면이 바뀌면 실패다 |
| 전체 관리자 자동 멘션 후보 | 참여자로 넣으면 된다 |

## 알려진 것

**부를 수 있는 사람이 지금 3명입니다.** 좁지만 맞는 방향입니다 — 부를 사람이
없으면 참여자를 넣게 됩니다.
