# 런칭 3단계 — 활동 (댓글·멘션)

2026-09-08. 2단계 배포 뒤 정리한 스펙.

바탕: `2026-09-08-launch-url-and-task-view-design.md` §3 — **그 절의 §3.5 를 정정한다**(아래 4절).
목업: `agent/pj/launch-task-view.html`

---

## 0. 무엇을 만드나

2단계에서 만든 항목 보기 창 아래에 **활동**이 붙는다. 그 런칭의 참여자를 `@` 로
부를 수 있고, 부르면 벨과 메일이 간다.

**이것이 협조요청 메일의 8할을 미리 한다.** "18-22 막혔는데 @변기석 확인
부탁드립니다"가 링크와 함께 나간다 — 그 링크가 2단계의 `?task=18-22` 다.

## 1. 앞 단계에서 물린 것 — 규칙으로 남긴다

다섯이 실제로 물렸다. 셋은 이 단계에도 그대로 해당한다.

**① 숫자는 그것이 데려가는 곳과 같아야 한다.** 1단계에서 두 번, 2단계 검증에서
한 번. **이번에 위험한 자리:** 「@ 는 참여자 3명」이라 적어 놓고 목록에 다른 수가
뜨는 것, 댓글 수 배지와 실제 줄 수가 갈리는 것.

**② 조인해서 온 필드는 객체다.** `task.assignee` 가 `{ id, name }` 이라 1단계
필터가 늘 거짓이었다. 댓글의 `author` 도 같은 모양으로 온다 — `comment.author`
를 문자열 id 와 `===` 로 견주지 않는다. `canModifyComment` 가 이미 그 판정을
하므로 **그 함수를 쓴다.**

**③ 다이얼로그 안의 단추는 닫기 X 자리를 피한다.** `DialogContent` 의
`showCloseButton` 기본값이 참이라 `absolute top-2 right-2 size-7` 짜리 X 가
children **뒤에** 그려진다. 2단계에서 「고치기」가 20px 깔렸다. 활동이 붙어
창이 길어지면 이 자리가 더 눈에 띈다.

## 2. 데이터 — `0036_launch_task_comments.sql`

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
  -- 수정되면 채워진다. null 이면 한 번도 안 고친 댓글이다.
  edited_at timestamptz
);

create index if not exists idx_launch_task_comments_task
  on launch_task_comments (task_id, created_at);
```

**이미지 첨부는 안 넣는다.** 요구사항도 `0026` 으로 나중에 붙였다. 글부터
오가는지 보고 정한다. (아래 4절의 부품이 이미지 없는 모드를 받는다.)

## 3. 라우트

| | 가드 |
|---|---|
| `GET  /api/launch/[id]/tasks/[taskId]/comments` | `requireLaunchAccess(id, 'member')` |
| `POST` 같은 경로 | 같음 |
| `PATCH`/`DELETE .../comments/[commentId]` | 같음 + `canModifyComment` |
| `GET  /api/launch/[id]/mentionable` | 같음 |

요구사항 쪽과 같은 모양이다(`GET`/`POST` 한 파일, `[commentId]` 에 `PATCH`/`DELETE`).

**`launchRouteGuard.test.js` 가 자동으로 잡는다** — 그 테스트는 `app/api/launch`
아래 모든 `route.js` 를 훑어 핸들러마다 가드를 요구한다.

**`taskId` 는 uuid 다.** 주소의 `?task=` 는 코드지만, 창이 이미 받아 둔 `tasks`
배열에서 코드→항목을 찾아 uuid 로 부른다(2단계의 `taskByCode` 가 그 일을 한다).

## 4. `ActivityFeed` 를 어떻게 재사용하나 — §3.5 정정

**앞 스펙에 "두 URL 을 props 로 빼면 된다"고 썼는데 틀렸다.** 실제로 세어 보니
`ActivityFeed`(723줄)에 하드코딩된 URL 이 **다섯**이고, 그중 하나는 이미지
업로드다 — 런칭에는 안 만들 기능이다.

그런데 **안쪽 부품들은 이미 깨끗하다.** `requirement`·`brandId`·`fetch` 참조가
0 이다:

| 부품 | 줄 | requirement/fetch | 이미지 |
|---|---|---|---|
| `MentionTextarea` | 127 | **0** | 0 |
| `CommentComposer` | | **0** | 4 |
| `CommentEntry` | | **0** | 2 |
| `CommentBody` | | **0** | 0 |
| `Avatar` · `fmt` · `TabButton` | | **0** | 0 |

**얽힌 것은 바깥 껍데기뿐이다.** 그러니 껍데기를 일반화하지 말고
**부품을 꺼낸다.**

```
components/comments/MentionTextarea.jsx   ← 127줄, 그대로 옮긴다
components/comments/CommentPieces.jsx     ← Avatar · fmt · CommentBody · CommentEntry · CommentComposer
components/ActivityFeed.jsx               ← 요구사항 껍데기. 위 둘을 임포트
components/launch/TaskActivity.jsx        ← 런칭 껍데기(새로). 작다
```

**`MentionTextarea` 가 이 작업에서 가장 값진 조각이다.** 한국어 조사 처리
(`@김관리님이` → 김관리)가 어려운 부분이고 이미 풀려 있다. 다시 쓰지 않는다.

**이미지는 props 로 끈다.** `CommentComposer`/`CommentEntry` 에
`onUploadImages`(없으면 첨부 UI 를 안 그림), `onDeleteImage` 를 넘긴다.
런칭은 안 넘긴다.

**요구사항 화면의 동작은 한 픽셀도 안 바뀌어야 한다.** 이 작업의 절반은
리팩터이고, 리팩터가 기존 화면을 바꾸면 그건 실패다.

## 5. 런칭 껍데기 — `TaskActivity`

```jsx
// props: launchId, task, memberId
// 이력이 없다. 요구사항엔 change_logs 가 있지만 런칭엔 updated_by 한 칸뿐이다.
// 재료가 없는 「기록」 탭을 만들지 않는다 — 지라는 전체/댓글/기록/업무 로그로
// 가르지만, 빈 탭은 고장으로 보인다.
```

- `GET .../comments` 로 목록, `GET .../mentionable` 로 후보
- **순서는 오래된 것 위, 새 것 아래** — 요구사항 활동과 같다
  (`lib/activityFeed.js`: "정렬은 오래된 것이 위, 새 것이 아래다").
  지라는 반대(최신 먼저·입력 위)인데 **모아 안의 일관성이 먼저다.**
- `buildActivityFeed([], comments)` 를 그대로 쓴다 — 이력이 비면 댓글만 나온다

**입력창 안내 문구는 런칭용으로.** 지라가 "누가 이 작업을 하고 있습니까...?" 를
띄우는 자리다. 런칭에서 막히는 이유는 대개 하나다:

> 무엇이 막고 있는지, 언제 풀릴지 적어 주세요. @로 참여자를 부를 수 있습니다.

## 6. 창의 세로 — 머리·발 고정은 이미 되어 있다

2단계에서 `DialogContent` 를 `flex max-h-[85vh] flex-col overflow-hidden` 으로
잡고 몸통만 스크롤하게 해 뒀다. **활동은 몸통 맨 아래에 붙고, 입력창은 발로
내린다.**

요구사항 상세는 *페이지*라 입력칸이 목록 맨 아래에 있어도 되지만, 창은 높이가
갇혀 있어 그러면 댓글 12건 아래로 스크롤해야 답을 쓴다.

**@자동완성 목록의 높이 상한.**

> **정정 (구현 중).** 처음 이 절에 "상한이 없다"고 썼는데 **틀렸다.**
> 실제 컴포넌트에는 이미 `max-h-56`(224px) `overflow-auto` 가 있고,
> `bottom-full` 이라 요구사항 화면에서도 **위로** 뜬다. 목업의 `.ac` 에
> 상한이 없었을 뿐이고, 그 차이를 실제 코드로 확인하지 않고 스펙에 옮겼다.
> 목업에서 잰 "460px 화면에서 창 위로 11px" 은 실제 앱에 없는 일이다.

대신 **진짜 어긋남이 하나 있었다.** 한 행이 `py-1.5` + `text-sm` 이라 약
32px 이고 `MENTION_CANDIDATE_LIMIT` 가 8 이라 8행 256px + `py-1` 8px = 264px 인데,
상한이 224px 이라 **8명일 때 마지막 한둘이 스크롤 뒤에 숨었다.**
후보를 8로 자른 이유가 "스크롤해야 보이는 후보는 아무도 안 고른다"
(`lib/mentions.js`)인데 상한이 그 이유를 배반하고 있었다.

`max-h-72`(288px)로 올렸다.

**실측**(목업, 가로 넘침 0): 1280×800 → 창 672×750, 몸통 556 · 발 122.
1280×620 → 570, 몸통 376. 400×720 → 366×670.

## 7. 멘션 후보 = 그 런칭의 참여자

`lib/launchMentionable.js` — 새 파일. `lib/mentionable.js` 와 **같은 성질**을 갖는다.

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

**이것이 편의가 아니라 관문이라는 점이 요점이다.** 요구사항 쪽 주석이 그렇게
적어 두었고, 런칭도 같아야 한다.

**한 사람이 두 역할이면 한 번만 준다** — `launch_members` PK 가
`(launch_id, member_id, role_name)` 이라 줄이 둘이다.

**전체 관리자를 자동으로 넣지 않는다.** 넣으면 모든 런칭의 후보에 늘 셋이 껴
있다. 전체 관리자도 참여자로 넣으면 되고, 그게 명단을 진짜로 만드는 길이다.

지금 부를 수 있는 사람이 3명이다. 좁지만 맞는 방향이다.

**`lib/mentions.js` 는 그대로 쓴다.** 순수 함수고 요구사항에 안 묶여 있다.

## 8. 알림 — 스키마 변경이 없다

`in_app_notifications.link` 가 **이미 자유 텍스트 컬럼**이고(`0015`, `0021` 로 복구),
`notificationHref` 가 `link` 를 `requirement_id` 보다 **먼저** 본다.

```js
export function notificationHref(notification) {
  if (notification?.link) return notification.link;                    // ← 여기로 탄다
  if (notification?.requirement_id) return `/requirements/${notification.requirement_id}`;
  return null;
}
```

그러니 이렇게만 넣으면 벨이 알아서 데려간다:

```js
link: `/launch/${launchId}?task=${task.code}`
```

**1·2단계가 이 링크를 만들어 줬다.** 그게 없었으면 멘션을 만들어도 벨을 눌렀을 때
갈 데가 없었다.

`lib/notify.js` 에 `notifyLaunchComment({ launchId, taskId, actorId, body })` 를
더한다. `lib/notifications.js` 에는:

```js
// 받을 사람 = 담당자 + 멘션된 사람. 본인은 뺀다.
//
// commentRecipients 를 못 쓴다 — 그건 resolveRecipients(requirement) 를 거쳐
// 요청자/담당자를 읽고, 런칭 항목에는 요청자가 없다.
export function launchCommentRecipients(task, actorId, mentionedIds = []) { /* ... */ }
```

**담당자를 꺼낼 때 `assigneeId(task)` 를 쓴다** — 객체로 온다(§1②).

`mentionMessage(actorName, title)` 은 **그대로 쓴다** — 이름과 제목만 받는다.

**메일도 같이 나간다.** `mentionEmail`·`sendMail`·`appBaseUrl` 이 이미 있고
런칭용 본문만 더하면 된다.

**알림은 절대 throw 하지 않는다.** `notify.js` 의 규칙이다 — 알림 insert 가
실패했다고 사용자가 「댓글 등록 실패」를 보면 안 된다. 댓글은 이미 저장됐기
때문에 그 메시지는 거짓말이고, 되지도 않는 재시도를 하게 된다.

## 9. 안 하는 것

| | 왜 |
|---|---|
| 「기록」 탭 | 런칭에 이력 자료가 없다. 빈 탭은 고장으로 보인다 |
| 이미지 첨부 | 요구사항도 나중에 붙였다. 같은 순서 |
| 전체 관리자 자동 후보 | 참여자로 넣으면 된다 |
| 댓글 수 배지 | 목록을 안 받고는 셀 수 없다. 471줄에 요청 471번을 부를 수 없다 |
| 요구사항 화면 변경 | 이 작업의 절반은 리팩터다. 기존 화면이 바뀌면 실패다 |

## 10. 테스트

`environment: 'node'` 라 렌더 테스트가 없다.

**`lib/launchMentionable.test.js`**
- 참여자만 나온다 — 전체 관리자라도 명단에 없으면 안 나온다
- 한 사람이 두 역할이어도 **한 번만** 나온다
- 비활성 팀원은 안 나온다

**`lib/notifications.test.js`** (더하기)
- `launchCommentRecipients` — 담당자 + 멘션, 본인 제외, 중복 제거
- 담당자가 **객체**로 와도 꺼낸다(§1②)
- 담당자가 없으면 멘션된 사람만

**`lib/launchRouteGuard.test.js`** — 새 라우트 넷이 자동으로 걸린다. 통과 확인.

**리팩터 회귀** — 부품을 꺼낸 뒤 요구사항 쪽 기존 테스트가 전부 그대로 통과해야
한다. 기준선 **76 파일 / 1180 테스트**.

## 11. 위험한 자리

**① 리팩터가 요구사항 화면을 바꾸는 것.** 부품 다섯을 옮기는 일이라 가장
크다. 옮긴 뒤 요구사항 상세를 눈으로 봐야 한다 — 렌더 테스트가 없다.

**② 멘션 후보를 화면이 정하는 것.** 서버가 다시 만들어야 관문이 된다.

**③ 창 세로.** 활동이 붙으면 2단계에서 잡아 둔 머리/몸통/발이 실제로 버티는지
목업 실측과 견줘야 한다.
