# 주간회의 개편 구현 계획

스펙: `docs/superpowers/specs/2026-09-01-meeting-refinement-design.md`

**목표:** 회의를 요건 확인하는 자리로 바꾼다. ①만 단독 배포 가능하다.

**테스트 환경이 `node` 라 DOM 이 없다.** 렌더 테스트는 만들지 않고 판정을
순수 함수로 빼서 그것만 검사한다.

---

## ① 확인 대기 — 공이 누구에게 있나

회의가 아직 0회 열렸으므로, 회의에만 값어치가 있는 ②③④보다 이것이 먼저다.
27일 된 건에 코멘트가 0개인 지금 상황에 바로 듣는다.

### 1-1. 마이그레이션 0029

**파일** — 만들기: `supabase/migrations/0029_awaiting_answer.sql`

```sql
alter table requirements
  add column if not exists awaiting_answer_since timestamptz,
  add column if not exists awaiting_answer_comment_id uuid
    references requirement_comments(id) on delete set null;
```

부분 인덱스 하나. 대부분의 건이 null 이라 그쪽은 상태로 찾는다.

### 1-2. `lib/awaitingAnswer.js` — 판정

**파일** — 만들기: `lib/awaitingAnswer.js`, `lib/awaitingAnswer.test.js`

```js
// 물어본 뒤 요청자가 말했는가.
export function hasAnswered({ requirement, comments = [] } = {})
```

`requirement.awaiting_answer_since` 가 없으면 언제나 거짓. 있으면 그 시각
이후, 작성자가 `requirement.requester` 인 코멘트가 하나라도 있으면 참.

작성자 id 는 문자열과 `{ id, name }` 두 모양으로 온다(`commentAuthorId` 가
이미 그 둘을 흡수한다). 그것을 쓴다.

**검사할 것:** 물어본 뒤 요청자 코멘트 → 참 / 물어보기 **전**의 요청자
코멘트 → 거짓 / 실무자 코멘트 → 거짓 / 물어본 적 없음 → 거짓 / 코멘트 없음
→ 거짓 / 읽을 수 없는 시각 → 거짓.

### 1-3. 메일

**파일**
- 고치기: `lib/emailContent.js` — `EMAIL_EVENTS` 에 `'요건확인'`, `askEmail()`
- 고치기: `lib/emailContent.test.js` — 못을 갱신(의도적 결정)

`mentionEmail` 이 본보기다. 제목에 요구사항 제목, 본문에 질문 전문과 링크.

### 1-4. `notifyAsk` · `notifyAnswered`

**파일** — 고치기: `lib/notify.js`

- `notifyAsk({ requirementId, actorId, question })` — 요청자에게 인앱 + 메일
- `notifyAnswered({ requirementId, askedBy })` — 물어본 사람에게 인앱만

메일을 안 보내는 이유: `EMAIL_EVENTS` 는 "지금 당신이 뭘 해야 하는" 것만
싣는데, 답이 온 것은 다음 회의에서 볼 일이다.

### 1-5. `POST /api/requirements/[id]/ask`

**파일** — 만들기: `app/api/requirements/[id]/ask/route.js`

3차 이상. 코멘트를 먼저 만들고 그 id 로 플래그를 채운다 — 순서를 뒤집으면
가리킬 코멘트가 없다.

이미 확인 대기인 건은 400. 두 번 물으면 첫 질문을 가리키던 포인터가 덮여
"무엇을 물어봤는지"가 사라진다. 더 물을 것이 있으면 코멘트로 단다.

`@멘션` 을 본문에 넣지 않는다 — 넣으면 멘션 메일과 겹쳐 한 사건에 두 통이 간다.

### 1-6. 답이 오면 푼다

**파일** — 고치기: `app/api/requirements/[id]/comments/route.js`

코멘트 등록 직후, 그 코멘트 작성자가 요청자이고 확인 대기 중이면 플래그를
지우고 물어본 사람에게 알린다.

크론으로 미루지 않는다 — "답했는데 화면이 그대로"인 구간이 생긴다.

실패해도 코멘트는 이미 등록됐다. 조용히 넘어간다(알림과 같은 규칙).

### 1-7. 정체 판정에서 뺀다

**파일** — 고치기: `lib/stalled.js`, `lib/stalled.test.js`

`isStalled` 가 확인 대기 건에 거짓을 준다. `stalledDays` 는 계속 잰다 —
답을 60일 안 주는 것도 드러나야 한다.

시그니처가 `{ status, stalledDays }` 에서 `{ status, stalledDays, awaitingAnswer }`
로 늘어난다. 부르는 곳 다섯을 전부 고친다.

### 1-8. 실어 보내기

**파일**
- 고치기: `app/api/requirements/route.js` — `awaitingAnswer` 를 행에 담는다
- 고치기: `app/api/meeting/route.js` — 같은 값 + 회의 안건에서 제외
- 고치기: `lib/listRow.js` — 확인 대기 뱃지
- 고치기: `lib/quickFilters.js` — `멈춘 것` 이 확인 대기를 안 센다

### 1-9. 화면

**파일**
- 만들기: `components/AskDialog.jsx` — 질문 한 칸
- 고치기: `components/RequirementDetail.jsx` — 확인 대기 배너 + 질문 버튼
- 고치기: `components/MeetingBoard.jsx` — `질문하기` · `확인 대기` 칩

상세에도 두는 이유: 회의가 아직 안 열렸다. 회의 화면에만 두면 이 기능도
0회가 된다.

### 1-10. 검증 · 커밋 · 배포

`npx vitest run` · `npm run build` · `npm run package:src`

---

## ② 본문 펴기 · 요건 얇음 (이후)

- `lib/requirementDepth.js` — `THIN_TOBE = 30`, `isThin`
- `/api/meeting` 이 As-Is · To-Be · 첨부 서명 URL 을 함께 내린다
- 행에서 접었다 편다

## ③ 처분을 행에서 (이후)

- `⋯` 에 보류 · 반려 · 중복. `CloseReasonDialog` · `MergeDialog` 재사용

## ④ 진행률 · 마치기 확인 창 (이후)

- 봤음은 화면 안에서만 산다(서버 저장 없음)
- `GET /api/meeting/end-preview` — 숫자는 서버가 센다
- `회의 마치기` 를 화면 위로
