# 소식 메뉴와 의견 보내기 구현 계획

스펙: `docs/superpowers/specs/2026-08-28-news-menu-design.md`
(의견의 데이터·메일·관리 화면은 `2026-08-28-feedback-loop-design.md` 2~4절)

**목표:** 소식을 헤더 한 클릭 거리로 꺼내고, 그 자리에 의견 창구를 연다.

**순서가 중요하다.** 의견 창구가 들어갈 자리가 소식 팝오버 안이므로 A 를 먼저
끝낸다. A 는 마이그레이션이 없어 단독 배포가 가능하고, B 는 0028 이 필요하다.

**테스트 환경이 `node` 라 DOM 이 없다.** 렌더 테스트는 만들지 않는다. 판정을
순수 함수로 빼고 그것만 검사한다.

---

## A. 소식 메뉴

### A1. `lib/newsDismiss.js` — 팝업을 띄울지 정하는 순수 함수

**파일**
- 만들기: `lib/newsDismiss.js`, `lib/newsDismiss.test.js`

핵심은 저장값이 **불린이 아니라 날짜**라는 것이다. 불린이면 한 번 X 한 사람에게
다음 배포의 팝업도 영영 안 뜬다.

```js
export const NEWS_DISMISS_KEY = 'moa.news.dismissed';

// unseen: unseenNews() 결과, dismissedDate: localStorage 에 저장된 'YYYY-MM-DD'
export function shouldOpenDialog(unseen, dismissedDate) {
  const items = Array.isArray(unseen) ? unseen : [];
  if (items.length === 0) return false;
  if (typeof dismissedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dismissedDate)) return true;
  return items[0].date > dismissedDate;
}
```

`readDismissed()` · `writeDismissed(date)` 는 try/catch 로 감싼 얇은 래퍼다.
읽을 수 없으면 `null` — 팝업을 한 번 더 보는 쪽이 영영 못 보는 쪽보다 가볍다.

**검사할 것:** 저장값 없음 → 뜬다 / 저장값이 최신보다 앞섬 → 뜬다 / 같음 →
안 뜬다 / 깨진 값 → 뜬다 / unseen 이 비었으면 저장값과 무관하게 안 뜬다.

### A2. `NewsDialog` — 닫기와 확인을 가른다

**파일**
- 고치기: `components/NewsDialog.jsx`

지금은 `/api/me` 를 스스로 부르고 열지 말지도 스스로 정한다. 그 판단을
`NewsMenu` 로 올리고 이 컴포넌트는 **받은 것을 그리기만** 한다.

```
props: items, onConfirm(), onDismiss()
```

- `확인했습니다` → `onConfirm()` — 서버에 seen 을 찍는다
- X · Esc · 바깥 → `onDismiss()` — localStorage 에만 쓴다

### A3. `NewsMenu` — 아이콘·점·팝오버·팝업을 한 컴포넌트가 소유

**파일**
- 만들기: `components/NewsMenu.jsx`

`/api/me` 를 한 번 부르고 `newsSeenAt` 을 들고 있는다. 나누면 요청이 둘이 되고,
팝업에서 확인을 눌러도 아이콘의 점이 안 사라진다.

- `Sparkles` (lucide-react), 벨 왼쪽
- 안 본 소식이 있으면 인디고 점 (숫자 아님)
- 팝오버: 최근 3건 (날짜·제목·본문), 하단에 `전체 보기` → `/help#news`
- 팝오버를 열면 seen 을 찍는다 — 여는 행동이 곧 읽는 것이다
- 같은 파일에서 `<NewsDialog />` 를 렌더한다

의견 링크 자리는 B 에서 채운다.

### A4. 붙이고 떼기

**파일**
- 고치기: `components/TopBar.jsx` — 벨 왼쪽에 `<NewsMenu />`
- 고치기: `app/requirements/layout.js` — `<NewsDialog />` 제거

팝업이 이제 `TopBar` 가 있는 모든 화면에서 뜬다. 로그인 직후 도착지는 여전히
`/requirements` 라 실제로 달라지는 경우는 드물다.

### A5. 팝오버가 자를 개수를 못 박는다

**파일**
- 고치기: `lib/newsItems.js` (`POPOVER_LIMIT = 3`), `lib/newsItems.test.js`

소식이 3건 미만이면 팝오버가 빈약해 보인다. 지금 4건이라 문제없지만, 목록을
줄이는 날 팝오버가 함께 얇아지는 것을 테스트가 알려 준다.

### A6. 전체 검증 후 커밋

`npx vitest run` · `npm run build` · `npm run package:src`

---

## B. 의견 보내기

### B1. 마이그레이션 0028

**파일**
- 만들기: `supabase/migrations/0028_moa_feedback.sql`

스펙의 `moa_feedback` 그대로. `brand_id` 를 두지 않는다 — 의견은 모아 전체에
대한 것이지 어느 브랜드의 것이 아니다.

`status` CHECK 는 `'새로 옴','확인함','반영함'`.

### B2. `lib/feedback.js` — 순수 판정

**파일**
- 만들기: `lib/feedback.js`, `lib/feedback.test.js`

```js
export const FEEDBACK_STATUSES = ['새로 옴', '확인함', '반영함'];
export const RESOLVED_STATUS = '반영함';
export const MAX_FEEDBACK_BODY = 2000;

export function normalizeFeedbackBody(value)   // trim, 아니면 ''
export function validateStatusChange({ status, note })  // { ok, error }
```

`반영함` 은 메모 없이는 안 된다. 반려 사유를 필수로 받는 것과 같은 이유다 —
무엇이 어떻게 반영됐는지 없으면 낸 사람은 그냥 닫혔다고 읽는다.

**검사할 것:** 공백만이면 빈 문자열 / 길이 상한 / `반영함` + 메모 없음 → 거부 /
`확인함` 은 메모 없어도 됨 / 모르는 상태 → 거부.

### B3. 메일

**파일**
- 고치기: `lib/emailContent.js` — `EMAIL_EVENTS` 에 `'의견'`, `feedbackEmail()`
- 고치기: `lib/emailContent.test.js` — 못을 갱신한다(의도적 결정)
- 고치기: `lib/notify.js` — `notifyFeedback()`

`notifySignup` 이 그대로 본보기다. 전체 관리자 전원에게, 인앱 알림 없이 메일만.
인앱은 110건 중 105건이 안 읽혔다.

### B4. `POST /api/feedback`

**파일**
- 만들기: `app/api/feedback/route.js`

로그인한 사람이면 누구나(4차 포함). `member_id` 는 세션에서 온다 — 폼이 보낸
값을 믿지 않는다. 메일 실패는 삼킨다(의견은 이미 저장됐다).

### B5. `FeedbackDialog`

**파일**
- 만들기: `components/FeedbackDialog.jsx`

한 칸이다. 종류·우선순위·화면 경로를 묻지 않는다.

### B6. 두 입구

**파일**
- 고치기: `components/NewsMenu.jsx` — 팝오버 하단 `의견 보내기`
- 고치기: `components/TopBar.jsx` — 계정 메뉴에도 한 줄

둘 다 같은 창을 연다. 창의 열림 상태는 `TopBar` 가 소유하고 `NewsMenu` 에
`onOpenFeedback` 으로 내려 준다 — `NewsMenu` 안에 두면 계정 메뉴에서 열 수 없다.

### B7. 관리 화면 API

**파일**
- 만들기: `app/api/admin/feedback/route.js` (GET)
- 만들기: `app/api/admin/feedback/[id]/route.js` (PATCH)

전체 관리자 전용. PATCH 는 상태와 메모를 받고 `validateStatusChange` 를 탄다.
`반영함` 이면 `resolved_at` 을 찍고 낸 사람에게 인앱 알림을 보낸다 — 이건
"당신 것에 답이 왔다"라 벨이 맞는 자리다.

### B8. `/admin/feedback` 화면

**파일**
- 만들기: `app/admin/feedback/page.js`
- 고치기: `components/TopBar.jsx` — 전체 관리자 메뉴에 `의견` 한 줄

새로 온 것이 위. 줄마다 사람·날짜·내용·상태. 분류·우선순위 칸은 안 만든다.

### B9. 요구사항으로 승격

**파일**
- 고치기: `app/admin/feedback/page.js`
- 고치기: `app/api/admin/feedback/[id]/route.js`

줄마다 `요구사항으로` 버튼. 브랜드는 관리자가 고른다 — 의견에는 브랜드가
없으므로 자동으로 정할 수 없다. 등록하면 `requirement_id` 가 이어지고 상태가
`확인함` 이 된다.

### B10. 소식 항목 · 전체 검증 · 배포

`lib/newsItems.js` 에 한 건. 날짜는 **8/30 보다 커야 한다** — 새 항목은 기존
어느 것보다도 나중이어야 묻히지 않는다.

---

## 되짚어 볼 위험

| 무엇 | 왜 |
|---|---|
| `EMAIL_EVENTS` 못 | 테스트가 깨진다. 늘리는 것은 의도적 결정이라 주석을 남긴다 |
| 팝업 위치 이동 | `/requirements` 밖에서도 뜬다. 의도한 것이다 |
| `moa_feedback` 의 FK | `member_id` 는 `team_members(id)`. 계정을 지우면 의견도 함께 지울지 정해야 한다 — `on delete cascade` 로 둔다. 낸 사람이 없는 의견은 읽어도 답할 곳이 없다 |
| 관리 화면 권한 | `/admin/*` 은 전부 전체 관리자 전용이다. 같은 문턱을 쓴다 |
