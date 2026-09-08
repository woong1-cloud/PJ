# 런칭 — 주소에 남는 화면과 항목 보기 창

2026-09-08. 목업: `agent/pj/launch-url-filters.html`, `agent/pj/launch-task-view.html`

레퍼런스 점검: 지라(`woong.atlassian.net`) 사이드바·목록·이슈 상세.

---

## 0. 왜 하나

**요구사항은 이미 다 갖고 있고 런칭만 없다.** 지라를 가져오는 일이 아니라,
런칭을 요구사항 수준으로 올리는 일이다.

| | 요구사항 | 런칭 |
|---|---|---|
| 필터가 주소에 남나 | 있음 (`useRequirementFilters`) | **없음** — `useState` + `localStorage` |
| 「내 것」 | 있음 (`quickFilters.js` — 내 담당·내 요청) | **없음** |
| 항목 하나를 가리키는 주소 | 있음 (`/requirements/<id>`) | **없음** — 창으로만 열린다 |
| 댓글·멘션 | 있음 (`ActivityFeed`) | **없음** |
| 지금 몇 건 보이나 | — | **없음** |

세 번째가 제일 크다. 471건 중 한 건을 남에게 가리킬 방법이 없어서
**협조요청 메일이 걸 링크가 존재하지 않는다** — 대기 목록의 그 일이 이것 때문에
막혀 있다.

지라에서 가져오는 것은 둘뿐이다: **「나에게 할당」 한 줄**과 **댓글 입력창의
안내 문구**. 나머지(하위 작업·연결된 업무 항목·레이블·우선순위·업무 로그)는
안 가져온다 — 선행조건이 이미 「연결된 업무 항목」보다 낫고(D-day와 「풀림 N」이
붙어 있다), 우선순위는 `urgency` 0/48 을 보고 빼기로 한 것이다. 지라 이 인스턴스도
우선순위가 「없음 100%」다.

---

## 1. 1단계 — 화면 상태를 주소로

### 1.1 파라미터

`/launch/<launchId>?...`

| 키 | 값 | 기본 |
|---|---|---|
| `tab` | `board` `decisions` `weekly` `gantt` | `board` |
| `view` | `week` `late` `blocked` `ready` `na` `all` | `ready` |
| `role` | 역할 이름 (한글, `encodeURIComponent`) | 없음 = 역할 전체 |
| `assignee` | `team_members.id` (uuid) | 없음 |
| `q` | 검색어 | 없음 |
| `group` | `workstream` `assignee` `week` | `workstream` |
| `ws` | 간트에서 넘어온 워크스트림 (`focusWorkstream`) | 없음 |
| `task` | 항목 **코드** (`18-22`) — 2단계 | 없음 |

**기본값은 안 쓴다.** `mergeFilterParams` 와 같은 규칙이다 — 빈 값은 키째 지운다.
`/launch/hoka` 는 보드 탭·착수 가능·워크스트림 묶기다.

**`tab` 도 주소에 넣는다.** 지금 `tab` 과 `boardFocus`(=`ws`)는 페이지의
`useState` 다. `tab` 을 안 넣으면 §1.5 의 「보드에서 열기」가 동작하지 않는다 —
주간 진척 탭에서 그 링크를 눌러 봐야 쿼리스트링만 바뀌고 탭은 주간 진척에
그대로 머문다. 링크는 `/launch/<id>?view=blocked` 이고, `tab` 키가 없으니
기본값인 보드로 간다.

**`assignee` 는 uuid 다, `me` 가 아니다.** 「내 담당」을 켜면 내 `memberId` 가
주소에 박힌다. 누가 열든 같은 목록이어야 한다 — 링크를 보내는 이유가 대부분
"이것 좀 봐 주세요"이고, `me` 로 두면 상대 화면에는 다른 목록이 뜬다.
"각자 자기 것 보세요"는 링크가 아니라 각자 토글을 누르면 되는 일이고,
그건 이미 화면에 있다.

**`task` 는 코드다, uuid 가 아니다.** `?task=18-22` 는 카톡에 붙였을 때 읽히고
`?task=8f3c1d2e…` 는 안 읽힌다. 코드는 한 런칭 안에서 유일하고, 주소가 이미
`/launch/<launchId>` 로 좁혀져 있다.

**전부 `router.replace` 다, `push` 가 아니다.** 요구사항이 이미 그 규칙이고
(`useRequirementFilters` 주석: "필터를 만질 때마다 히스토리가 쌓이면 뒤로가기를
여러 번 눌러야 화면을 빠져나갈 수 있게 된다"), 창도 같다 — 연계를 타고
`18-22 → 18-12 → 18-08` 로 옮겨 다니면 히스토리가 세 칸 쌓인다. 창은 ✕ 로 닫는다.

### 1.2 `lib/launchFilters.js` — 새 파일

`lib/requirementFilters.js` 와 같은 모양. 순수 함수라 테스트한다.

```js
export const LAUNCH_TABS = ['board', 'decisions', 'weekly', 'gantt'];
export const DEFAULT_TAB = 'board';
export const LAUNCH_VIEWS = ['week', 'late', 'blocked', 'ready', 'na', 'all'];
export const DEFAULT_VIEW = 'ready';
export const LAUNCH_GROUPS = ['workstream', 'assignee', 'week'];
export const DEFAULT_GROUP = 'workstream';

// 주소 → 화면 상태. 모르는 값은 기본값으로 떨어뜨린다 — 손으로 주소를 고친
// 사람에게 빈 화면 대신 기본 화면을 준다.
export function parseLaunchParams(searchParams) {
  const get = (k) => searchParams.get(k) ?? '';
  const tab = get('tab');
  const view = get('view');
  const group = get('group');
  return {
    tab: LAUNCH_TABS.includes(tab) ? tab : DEFAULT_TAB,
    view: LAUNCH_VIEWS.includes(view) ? view : DEFAULT_VIEW,
    group: LAUNCH_GROUPS.includes(group) ? group : DEFAULT_GROUP,
    role: get('role'),
    assignee: get('assignee'),
    q: get('q'),
    ws: get('ws'),
    task: get('task'),
    // 주소에 role 키 자체가 있었나. 값이 빈 문자열인 것과 키가 없는 것은
    // 다르다 — 1.3 참조.
    roleInUrl: searchParams.has('role'),
  };
}

// 화면 상태 → 주소. 기본값·빈 값은 키째 뺀다.
export function mergeLaunchParams(currentSearch, patch) { /* mergeFilterParams 와 동형 */ }
```

**`useSearchParams` 는 Suspense 경계 안에 있어야 한다.** 없으면 프로덕션 빌드가
"Missing Suspense boundary with useSearchParams" 로 실패한다 — 개발 서버는
on-demand 렌더라 그냥 통과해서 눈치채기 어렵다. `app/requirements/page.js` 가
같은 이유로 경계를 두고 있다. `app/launch/[id]/page.js` 도 같은 모양으로 가른다.

`view` 별 거르기는 이미 `LaunchBoard` 안에 있다(`isThisWeek`/`isLate`/`isBlocked`/
`isReady`/`isNotApplicable`). **옮기지 않는다** — 이번 작업은 상태를 어디에 두느냐지
세는 규칙이 아니다.

### 1.3 역할 — 주소와 브라우저 기억

지금 역할은 `localStorage` 에 있다(`roleStorageKey(launchId)`). 한 번 고르면 다시
안 묻는 게 요점이었다. 주소에도 넣으면 둘이 싸운다. 규칙 하나로 정리한다.

| | |
|---|---|
| 주소에 `role` 키가 **있으면** | 주소가 이긴다. 값이 빈 문자열이면 「역할 전체」다 |
| 주소에 `role` 키가 **없으면** | `localStorage` 를 읽어 화면에 반영하고, **곧바로 주소에 replace 로 쓴다** |

두 번째가 요점이다. 마운트 직후 한 번 `replace` 해서 **주소가 늘 화면과 1:1** 이
되게 한다. 안 그러면 역할을 안 건드리고 보기만 바꿔 링크를 보냈을 때,
받은 사람은 자기 역할로 보게 된다 — 링크가 사람마다 다른 것을 가리키면 안 된다는
결정과 어긋난다.

**링크로 들어와 역할이 바뀌어도 `localStorage` 를 안 덮어쓴다.** 남의 링크 한 번
열었다가 내 기본 역할이 바뀌어 있으면 안 된다.

지금은 `selectedRole` 을 보는 `useEffect` 가 `localStorage` 에 쓴다. **그 effect 를
없앤다.** 대신 사람이 고르는 두 자리에서만 쓴다 — 역할 드롭다운 `onChange` 와
역할 띠의 `pickRole`. 주소에서 들어온 값은 이 두 자리를 안 지나므로 저절로
안 써진다.

`roleAsked`(역할 띠를 넘겼나)는 `localStorage` 에 그대로 둔다. 화면 상태가 아니라
그 사람의 습관이라 링크로 옮길 것이 아니다.

### 1.4 화면 — 툴바를 두 줄로

「내 담당」 칩과 구분선 둘을 지금 한 줄에 더하면 **한 줄 유지 최소 폭이
1112px → 1283px** 로 는다(실측). 13″ 노트북(1240px)에서 지금은 한 줄인데 두 줄이
되고, **「묶기」 하나만 둘째 줄에 홀로** 남는다. 넘치지는 않지만(`flex-wrap`)
우연히 생긴 둘째 줄은 고장으로 보인다.

우연한 둘째 줄 대신 뜻이 있는 둘째 줄로 나눈다.

```
[역할 전체 ▾] ┃ (내 담당 0) ┃ (이번 주 12)(지남 2)(막힘 5)(착수 가능 34)(해당없음 25)(전체 446)
───────────────────────────────────────────────────────────────────
[항목·역할로 찾기] [묶기 · 워크스트림 ▾]  446건 중 34건 [착수 가능][물류팀]   필터 초기화  [＋ 항목]
```

- **첫째 줄 = 무엇을 볼까** — 역할 · 내 담당 · 덩어리
- **둘째 줄 = 뭐가 보이나 · 뭘 할까** — 찾기 · 묶기 · 건수 · 초기화 · 항목 추가

**「내 담당」은 보기 칩이 아니라 그 왼쪽이다.** 이번 주·지남·막힘은 서로 배타적인
한 축(라디오)이고, 내 담당은 그와 **겹쳐 걸리는** 다른 축이다. 같은 묶음에 섞으면
「내 담당 중 이번 주」를 못 본다. 구분선 둘이 세 덩어리를 만든다.

**0 을 감추지 않는다.** 담당자가 0/471 이라 칸을 숨기면 담당자를 붙일 이유가
영영 안 보인다. 담당자 드롭다운이 `assigneeOptions.length > 0` 에 걸려 안 그려지는
지금이 그 상태다. 0 일 때 눌러서 빈 목록을 보여주는 대신 무엇을 하면 되는지 말한다.

> 아직 **내 담당이 없습니다.** 항목을 열어 담당자에 자기 이름을 붙이면 여기 모입니다.

**「446건 중 34건」** — 참여자 넣기 창의 「19명 중 4명」과 같은 규칙이다.
분모는 해당없음을 뺀 수다(진척률 분모와 같다).

**「이 화면 링크」 단추는 안 만든다.** 주소창이 이미 그 일을 하고, 요구사항이
같은 조건에서 한 번도 필요하지 않았다. 나중에 필요해지면 제목 줄의 `⋯` 에 한 줄
넣는다 — 툴바 자리를 안 쓴다.

**실측** (목업, 넘침 0):

| 폭 | 첫째 줄 | 둘째 줄 |
|---|---|---|
| 1440 · 1240 · 1024 · 900 | 1줄 | 1줄 |
| 768 | 2줄 | 1줄 |
| 420 | 3줄 | — |

### 1.5 주간 진척 → 보드

`WeeklyProgress` 의 ②막힘 · ③기한 지남 머리에 **「보드에서 열기 ↗」** 한 줄.

```jsx
<Link href={`/launch/${launch.id}?view=blocked`}>보드에서 열기 ↗</Link>
<Link href={`/launch/${launch.id}?view=late`}>보드에서 열기 ↗</Link>
```

**①결정 대기·④·⑤에는 안 단다.** ①은 항목이 아니라 결정이라 보드에 대응하는 줄이
없고, ⑤이번 주 완료는 확인 자리라 건너갈 이유가 약하다. 전부에 다는 대신 둘에만.

주간 진척은 이미 항목을 **줄로** 보여준다 — 지라 요약처럼 숫자만 있는 게 아니다.
그래서 필요한 건 「숫자를 링크로」가 아니라 **손을 댈 수 있는 화면으로 건너가는
길**이다. 주간 진척에서는 상태를 못 바꾼다.

---

## 2. 2단계 — `?task=` 와 항목 보기 창

### 2.1 레이어 창이다, 새 페이지가 아니다

`/launch/[id]/tasks/[code]` 라우트를 **안 만든다**. `?task=` 는 쿼리스트링이라
페이지는 `/launch/[id]` 그대로이고 그 위에 창이 뜬다. 목록·필터·스크롤·접힌
그룹이 뒤에 그대로 살아 있다.

라우트를 만들면 창을 닫고 목록으로 돌아올 때 필터와 스크롤을 복원하는 일이
새로 생긴다. 지라는 목록의 **사이드 패널**과 `/browse/KEY` **전체 페이지** 둘 다
갖고 있지만, 그건 스페이스가 여럿이고 이슈가 수만 건인 규모의 이야기다.

### 2.2 `TaskLinksDialog` 를 키운다 — 새 창이 아니다

지금 런칭에는 항목 창이 넷이다(고치기·연계·막힘·해당없음). 다섯째를 만들지 않는다.

`TaskLinksDialog`(261줄)가 **이미 「한 항목을 보는 창」**이다 — 선행·후행을 오가고
`onEdit` 로 고치기에 넘긴다. 여기에 기본 정보와 활동을 얹는다.
파일 이름을 `TaskViewDialog.jsx` 로 바꾼다.

```
18-22  물류 창고 계약                      [막힘]  [고치기] ✕   ← 머리 고정
호카 HOKA · D30_물류구축
──────────────────────────────────────────────────────────
기한   2026-09-30 D-62      담당자  없음 「나에게 맡기」        ← 몸통 스크롤
주관   물류팀               지원    재무팀
결정권 CAIO실               고친이  변기석 · 9/5
⚠ 결정 대기 · 물류 3PL 최종 선정
선행 ↑ 18-12 인프라 설계 [완료] D-91
후행 ↓ 18-25 · 18-26 · 2건 더 보기          풀림 4건
활동
──────────────────────────────────────────────────────────
💬 무엇이 막고 있는지, 언제 풀릴지 적어 주세요…      [남기기]  ← 발 고정
```

**입구 셋이 이 한 창으로 모인다** — 줄 제목 클릭(지금은 아무 일도 안 한다) ·
「풀림 N」 배지 · `?task=` 링크. 뒤의 둘은 지금도 이 창을 연다.

**제목 클릭을 고치기(폼)에 연결하지 않는다.** 참여자가 처음 보는 화면이 폼이면
"내가 뭘 고쳐야 하나"로 읽힌다. 보는 게 먼저고 고치기는 한 번 더다.

**머리·발은 고정, 몸통만 스크롤한다.** 요구사항 상세는 *페이지*라 입력칸이 맨
아래에 있어도 되지만(`ActivityFeed`: "피드가 오래된 것→새 것 순이라 입력칸도 맨
아래에 둔다"), 창은 높이가 갇혀 있어서 그러면 댓글 12건 아래로 스크롤해야 답을
쓴다. 읽는 자리와 쓰는 자리를 가른다.

**실측** (목업, 가로 넘침 0):

| 화면 | 창 | 몸통(스크롤) | 발(고정) |
|---|---|---|---|
| 1280×800 | 672×750 | 556px | 122px |
| 1280×620 | 672×570 | 376px | 122px |
| 400×720 | 366×670 | 476px | 122px |

창은 늘 화면보다 작고 입력칸은 늘 보인다. 댓글 12건이면 몸통 내용이 1210px 이고
나머지는 스크롤한다.

### 2.3 「나에게 맡기」 — 지라에서 가져온 것

담당자가 비어 있으면 이름 자리에 밑줄 링크 한 줄.

```
담당자   없음  나에게 맡기
담당자   [한지웅]  놓기        ← 누른 뒤
```

**드롭다운으로는 0/471 을 못 채운다.** 드롭다운은 "내가 후보에 있나"부터 알아야
하고(`assigneeCandidates` 는 그 항목의 주관 역할 참여자만 준다), 없으면 왜 없는지도
모른다. 한 번 누르면 끝나는 길이 따로 있어야 한다.

**주관 역할의 참여자가 아니어도 누를 수 있게 한다.** 실제로는 역할 배정이 느슨하고,
"내가 하겠다"를 막을 이유가 없다. 서버는 `requireLaunchAccess` 만 본다.

기존 담당자가 있으면 이 링크를 안 그린다 — 남의 일을 한 번 눌러 가져가는 자리가
되면 안 된다. 그때는 고치기 창의 드롭다운으로 바꾼다.

`PATCH /api/launch/[id]/tasks/[taskId]` 에 `{ assignee }` 를 보낸다. 이미 있는
라우트다.

### 2.4 없는 코드로 들어왔을 때

`?task=99-99` 처럼 목록에 없는 코드면 — 지워졌거나 다른 런칭의 항목이다.

- **창을 반드시 닫는다.** 안 닫으면 이미 열려 있던 지난 항목이 그대로 남아,
  안내는 "99-99 를 못 찾았습니다"인데 창에는 18-22 가 떠 있는 화면이 된다.
  목업에서 실제로 이 버그가 났다. `TaskEditDialog` 주석의 그 병과 같다.
- 툴바 아래에 한 줄로 말한다:
  > 링크가 가리키는 항목 **99-99** 를 이 런칭에서 못 찾았습니다 — 지워졌거나 다른 런칭의 항목입니다.
- 조용히 넘기지 않는다. 링크를 누른 사람은 무언가 열릴 것을 기대했다.

### 2.5 필터에 안 걸리는 항목을 가리킬 때

`?view=ready&task=18-22` 인데 18-22 는 막힘이라 착수 가능 목록에 없다.

**창은 열되 보기를 바꾸지 않는다.** 링크가 뜻한 필터를 마음대로 바꾸지 않고,
창을 닫으면 원래 보려던 목록이 그대로 있다. 뒤 목록에 그 줄이 없는 것은
창이 닫힌 뒤에 보이므로 혼란이 적다.

---

## 3. 3단계 — 활동 (댓글·멘션)

### 3.1 데이터 — `0036_launch_task_comments.sql`

`requirement_comments`(`0010`)를 그대로 옮긴다.

```sql
-- 0036: 런칭 항목 댓글
--
-- requirement_comments 와 같은 모양이다. 한 테이블에 합치지 않는다 —
-- 요구사항과 런칭 항목은 다른 테이블이고, 한 컬럼에 두 종류의 FK 를 담으면
-- on delete cascade 를 못 건다.
--
-- launch_id 를 두지 않는다. 댓글은 늘 특정 항목에 딸려 조회되고 런칭은
-- launch_tasks 에서 온다. 복제하면 둘이 어긋날 수 있다.
create table if not exists launch_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references launch_tasks(id) on delete cascade,
  author uuid references team_members(id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists idx_launch_task_comments_task
  on launch_task_comments (task_id, created_at);
```

**이미지 첨부는 1차에 안 넣는다.** 요구사항 쪽은 `0026_comment_images` 로 나중에
붙였다. 같은 순서로 간다 — 글부터 오가는지 보고 정한다.

### 3.2 라우트

| | 가드 |
|---|---|
| `GET /api/launch/[id]/tasks/[taskId]/comments` | `requireLaunchAccess(id, 'member')` |
| `POST` 같은 경로 | 같음 |
| `PATCH`/`DELETE /api/launch/[id]/tasks/[taskId]/comments/[commentId]` | 같음 + `canModifyComment` |
| `GET /api/launch/[id]/mentionable` | 같음 |

`requireLaunchAccess` 는 이미 있다(`lib/permissions.js`). `canModifyComment`
(`lib/comments.js`)도 그대로 쓴다 — 글쓴이 본인만 고치고 지운다.

**`taskId` 는 uuid 다.** 주소의 `?task=` 는 코드지만, 창이 이미 받아 둔
`tasks` 배열에서 코드→항목을 찾아 uuid 로 부른다. 라우트에 코드를 받으면
`(launch_id, code)` 로 다시 조회해야 하고, 코드가 바뀔 수 있는 값이라 URL 이
아닌 곳에서는 uuid 가 맞다.

**`launch_route_guard.test.js` 에 새 라우트가 자동으로 걸린다** — 그 테스트는
`app/api/launch/**` 전부를 훑어 핸들러마다 가드를 요구한다.

### 3.3 멘션 후보 = 그 런칭의 참여자

`lib/launchMentionable.js` — 새 파일. `lib/mentionable.js` 와 같은 성질을 갖는다.

```js
// 이 런칭에서 부를 수 있는 사람들 = launch_members.
//
// 범위는 "그 런칭을 열 수 있는 사람"이다. 열지도 못하는 사람을 부르면 벨에
// 알림은 뜨는데 눌러 들어가면 403 이 뜬다 — 안 부른 것보다 나쁘다.
//
// 이 목록은 두 곳이 함께 쓴다: 입력창 자동완성(편의)과 알림 수신자 판정(관문).
// 화면이 보내온 이름이 아니라 서버가 다시 만든 이 목록으로 본문을 해석하므로,
// 화면 목록을 조작해 남을 부르는 길은 없다. mentionable.js 와 같은 규칙이다.
export async function loadLaunchMentionable(supabase, { launchId }) { /* ... */ }
```

**전체 관리자를 자동으로 넣지 않는다.** 넣으면 모든 런칭의 후보 목록에 늘 셋이
껴 있게 된다. 전체 관리자도 참여자로 넣으면 되고, 그게 명단을 진짜로 만드는
길이다. (지금 변기석·장재혁은 이미 참여자다.)

지금 부를 수 있는 사람이 3명이다. 좁지만 맞는 방향이다 — 부를 사람이 없으면
참여자를 넣게 된다.

`lib/mentions.js` 는 **그대로 쓴다.** 한국어 조사 처리(`@김관리님이` → 김관리)가
어려운 부분이고 요구사항에 안 묶여 있다. `MENTION_CANDIDATE_LIMIT`(8)도 같다.

### 3.4 알림 — 스키마 변경이 없다

`in_app_notifications.link` 가 **이미 자유 텍스트 컬럼**이고(`0015`, `0021`로 복구),
`notificationHref` 가 `link` 를 `requirement_id` 보다 먼저 본다.

```js
export function notificationHref(notification) {
  if (notification?.link) return notification.link;                    // ← 여기로 탄다
  if (notification?.requirement_id) return `/requirements/${notification.requirement_id}`;
  return null;
}
```

그러니 런칭 멘션 알림은 이렇게만 넣으면 벨이 알아서 데려간다:

```js
link: `/launch/${launchId}?task=${task.code}`
```

**1단계·2단계가 이 링크를 만들어 준다.** 그게 없으면 멘션을 만들어도 벨을 눌렀을 때
갈 데가 없다.

`lib/notifications.js` 에 더할 것:

```js
// 받을 사람 = 담당자 + 멘션된 사람. 본인은 뺀다.
//
// commentRecipients 를 못 쓴다 — 그건 resolveRecipients(requirement) 를 거쳐
// 요청자/담당자를 읽고, 런칭 항목에는 요청자가 없다.
export function launchCommentRecipients(task, actorId, mentionedIds = []) { /* ... */ }
```

`mentionMessage(actorName, title)` 은 **그대로 쓴다** — 이름과 제목만 받는다.

**메일도 같이 나간다.** `mentionEmail` · `sendMail` · `appBaseUrl` 이 이미 있고
런칭용 본문만 더하면 된다. 이게 협조요청 메일의 상당 부분을 미리 한다 —
"18-22 막혔는데 @변기석 확인 부탁드립니다"가 링크와 함께 간다.

### 3.5 `ActivityFeed` 일반화

지금 URL 이 박혀 있다.

```js
fetch(`/api/requirements/${requirementId}/comments?brandId=${brandId}`)
fetch(`/api/requirements/${requirementId}/mentionable?brandId=${brandId}`)
```

**두 URL 을 props 로 뺀다.** `commentsUrl` · `mentionableUrl` · `history` ·
`memberId` 를 받는 모양으로 바꾸고, 요구사항 쪽 호출부에서 지금 URL 을 만들어
넘긴다. 동작은 그대로다.

**런칭은 `history` 에 빈 배열을 넘긴다.** 런칭 항목에는 이력이 없다 —
요구사항엔 `change_logs` 가 있지만 런칭엔 `updated_by` 한 칸뿐이다.
지라의 활동은 「전체 / 댓글 / 기록 / 업무 로그」로 갈리지만, **재료가 없는 탭은
안 만든다.** 댓글만으로 시작한다.

`buildActivityFeed` 는 그대로 쓴다 — 이력이 비면 댓글만 시간순으로 나온다.
**순서는 오래된 것 위, 새 것 아래**다(요구사항과 같다). 지라는 반대(최신 먼저 ·
입력 위)인데, 모아 안의 일관성이 먼저다.

**입력창 안내 문구는 런칭용으로 바꾼다.** 지라가 "누가 이 작업을 하고
있습니까...?" 를 띄우는 자리다. 런칭에서 막히는 이유는 대개 하나다:

> 무엇이 막고 있는지, 언제 풀릴지 적어 주세요. @로 참여자를 부를 수 있습니다.

**@자동완성 목록에 높이 상한을 건다.** 후보가 8명(`MENTION_CANDIDATE_LIMIT`)이고
화면 세로가 460px 이면 목록이 창 위로 삐져나간다(목업에서 실측). 입력칸이 창
아래에 있어 목록이 위로 뜨기 때문이다.

```
max-h-[min(20rem,40vh)] overflow-y-auto
```

20rem(320px)이면 800px 화면에서 8명이 다 보인다. 상한이 무는 것은 8명을 어차피
못 보여줄 만큼 화면이 얕을 때뿐이다 — 그래야 "스크롤해야 보이는 후보는 아무도
안 고른다"(`mentions.js`)와 안 어긋난다.

---

## 4. 안 하는 것

| | 왜 |
|---|---|
| 「이 화면 링크」 단추 | 주소창이 이미 한다. 요구사항이 같은 조건에서 안 필요했다 |
| `/launch/[id]/tasks/[code]` 라우트 | `?task=` 로 충분하다. 라우트를 만들면 복원이 숙제가 된다 |
| 「기록」 탭 | 런칭에 이력 자료가 없다. 빈 탭을 안 만든다 |
| 사이드바 | 지라는 스페이스가 여럿이라 필요하다. 모아는 화면이 여섯이다 |
| 우선순위 · 레이블 · 하위 작업 | 선행조건이 이미 낫다. 우선순위는 빼기로 한 것이다 |
| 댓글 이미지 첨부 | 요구사항도 나중에 붙였다. 같은 순서 |
| 전체 관리자 자동 멘션 후보 | 참여자로 넣으면 된다 |

---

## 5. 테스트

`environment: 'node'` 라 렌더 테스트는 없다. 순수 함수와 라우트 가드로 잡는다.

**`lib/launchFilters.test.js`**
- 모르는 `view` 는 `ready` 로 떨어진다 — 손으로 주소를 고친 사람에게 빈 화면을 안 준다
- 기본값은 주소에 안 쓴다 (`view=ready` 를 넣으면 키가 빠진다)
- `role=` (빈 값)과 `role` 키 없음이 다르다 — `roleInUrl` 이 갈라 준다
- 한글 역할이 왕복한다 (`물류팀` → 인코딩 → 파싱)

**`lib/launchMentionable.test.js`**
- 참여자만 나온다 — 전체 관리자라도 명단에 없으면 안 나온다
- 한 사람이 두 역할이어도 한 번만 나온다 (PK 가 셋이라 줄이 둘이다)

**`lib/notifications.test.js`** (더하기)
- `launchCommentRecipients` — 담당자 + 멘션, 본인 제외, 중복 제거
- 담당자가 없으면 멘션된 사람만

**`lib/launchRouteGuard.test.js`** — 새 라우트 넷이 자동으로 걸린다. 통과만 확인.

---

## 6. 배포 순서

1단계는 마이그레이션이 없다. 3단계만 SQL 이 필요하다.

| | 무엇 | SQL |
|---|---|---|
| 1 | URL 필터 · 내 담당 · 건수 · 주간 진척 링크 | 없음 |
| 2 | `?task=` · 항목 보기 창 · 나에게 맡기 | 없음 |
| 3 | 댓글 · 멘션 | `0036` |

**1 → 2 → 3 순서에 이유가 있다.** 1이 2의 주소를 만들고, 2가 3의 알림이 갈 곳을
만든다. 그리고 2의 「나에게 맡기」가 담당자를 채우기 시작해야 1의 「내 담당」 칩이
0 을 벗어난다 — 지금 0/471 이라 1만 배포하면 그 칩은 계속 0 이다.

배포는 `npm run package:src` (`npm run package` 아니다).
