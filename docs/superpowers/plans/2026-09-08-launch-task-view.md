# 런칭 2단계 — 항목 링크와 보기 창 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `?task=18-22` 로 항목 하나를 가리키고, 그 주소가 「보기 창」(기본 정보 + 연계)을 연다. 담당자를 한 번 눌러 자기에게 붙일 수 있게 한다.

**Architecture:** 창을 여는 `useState`(`linksFor`)를 없애고 주소가 유일한 출처가 된다. 입구 셋(줄 제목 · 「풀림 N」 · 링크)이 전부 `onParams({ task: code })` 로 모인다. `TaskLinksDialog` 를 `TaskViewDialog` 로 키워 쓴다 — 새 창을 만들지 않는다.

**Tech Stack:** Next.js 16 App Router (JS) · React 19 · Tailwind v4 · Vitest (`environment: 'node'` — DOM 없음)

**스펙:** `docs/superpowers/specs/2026-09-08-launch-task-view-step2-design.md`
**목업:** `agent/pj/launch-task-view.html`

---

## 1단계가 이미 해 둔 것

| | |
|---|---|
| `?task=` 파싱 | **있다.** `lib/launchFilters.js:48`. 아무도 안 쓴다 |
| `PATCH` 가 `assignee` 받기 | **있다.** `app/api/launch/[id]/tasks/[taskId]/route.js:78` |
| 가드 | **있다.** `requireLaunchAccess(id, 'member')` |
| `assigneeId(task)` | **있다.** `lib/launchMembers.js`. 객체·문자열 둘 다 받는다 |

**서버 변경이 없다. 마이그레이션도 없다.**

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/launchTaskLink.js` (새로) | 코드 → 항목 찾기. 못 찾은 이유까지 준다 |
| `lib/launchTaskLink.test.js` (새로) | 위의 테스트 |
| `app/launch/[id]/page.js` (고침) | `task` 를 훅에서 꺼내 내려 준다 |
| `components/launch/LaunchBoard.jsx` (고침) | `linksFor` state 제거 · 입구 셋 통합 · 못 찾음 안내 |
| `components/launch/TaskLinksDialog.jsx` → `TaskViewDialog.jsx` | 기본 정보 얹기 · 머리/몸통/발 · 「나에게 맡기」 |

## 1단계에서 물린 것 — 같은 자리를 또 밟지 않기

**① 숫자는 그것이 데려가는 곳과 같아야 한다.** 1단계에서 두 번 물렸다(「N건 중 M건」이
안 그려지는 목록을 셌고, 주간 진척 링크가 0건으로 데려갔다). **이번에 위험한 자리:**
「풀림 4」를 눌러 연 창의 후행이 정말 4건인가, 「나에게 맡기」 뒤 「내 담당」이
그 자리에서 1 오르는가.

**② `task.assignee` 는 객체다**(`{ id, name }`). `=== 문자열` 로 견주면 늘 거짓이다.
**`assigneeId(task)` 를 쓴다.**

**③ 창은 닫혀도 계속 그리면 지난 항목이 남는다.** 조건부로 그린다.

---

### Task 1: `lib/launchTaskLink.js` — 코드로 항목 찾기

**Files:**
- Create: `lib/launchTaskLink.js`
- Test: `lib/launchTaskLink.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/launchTaskLink.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { taskByCode } from './launchTaskLink';

const tasks = [
  { id: 'a', code: '18-22', title: '물류 창고 계약' },
  { id: 'b', code: '18-12', title: '인프라 설계' },
];

describe('taskByCode', () => {
  it('있는 코드를 찾는다', () => {
    expect(taskByCode({ tasks, code: '18-22' })).toEqual({
      task: tasks[0], missing: '',
    });
  });

  it('없는 코드는 missing 으로 돌려준다 — 조용히 넘기면 링크를 누른 사람이 아무것도 못 본다', () => {
    expect(taskByCode({ tasks, code: '99-99' })).toEqual({
      task: null, missing: '99-99',
    });
  });

  it('빈 코드는 창도 안 열고 안내도 안 띄운다', () => {
    expect(taskByCode({ tasks, code: '' })).toEqual({ task: null, missing: '' });
    expect(taskByCode({ tasks })).toEqual({ task: null, missing: '' });
  });

  it('공백만 있는 코드도 빈 것으로 친다', () => {
    expect(taskByCode({ tasks, code: '   ' })).toEqual({ task: null, missing: '' });
  });

  it('앞뒤 공백은 떼고 찾는다 — 주소를 손으로 붙이다 섞인다', () => {
    expect(taskByCode({ tasks, code: ' 18-12 ' }).task).toBe(tasks[1]);
  });

  it('목록이 비어 있어도 안 터진다 — 항목을 받기 전에 그려지는 순간이 있다', () => {
    expect(taskByCode({ tasks: [], code: '18-22' })).toEqual({
      task: null, missing: '18-22',
    });
    expect(taskByCode({})).toEqual({ task: null, missing: '' });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run lib/launchTaskLink.test.js`
Expected: FAIL — `Cannot find module './launchTaskLink'`

**눈으로 확인한 뒤에 다음으로 가세요.**

- [ ] **Step 3: 구현한다**

`lib/launchTaskLink.js`:

```js
// 주소의 코드로 항목을 찾는다.
//
// 못 찾은 것을 조용히 넘기지 않는다 — 링크를 누른 사람은 무언가 열릴 것을
// 기대했다. 왜 못 찾았는지(어떤 코드였는지)까지 돌려줘서 화면이 한 줄로
// 말할 수 있게 한다.
//
// 빈 코드와 못 찾은 코드는 다르다. 빈 것은 "창을 안 연다"이고, 못 찾은 것은
// "열려고 했는데 없다"이다. 둘을 같이 다루면 주소에 task 가 없는 평범한
// 화면에도 빨간 안내가 뜬다.
export function taskByCode({ tasks = [], code = '' } = {}) {
  const wanted = String(code ?? '').trim();
  if (!wanted) return { task: null, missing: '' };
  const found = (tasks ?? []).find((t) => t?.code === wanted);
  return found ? { task: found, missing: '' } : { task: null, missing: wanted };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run lib/launchTaskLink.test.js`
Expected: PASS — 6 tests (it 블록 기준)

**기대값과 실제가 다르면 테스트를 고치지 말고 보고하세요.**

- [ ] **Step 5: 커밋**

```bash
git add -- lib/launchTaskLink.js lib/launchTaskLink.test.js
git commit -m "feat: 주소의 코드로 런칭 항목 찾기"
```

---

### Task 2: 페이지가 `task` 를 내려 준다

**Files:**
- Modify: `app/launch/[id]/page.js`

- [ ] **Step 1: 훅에서 `task` 를 꺼낸다**

1단계에서 만든 구조 분해에 `task` 를 더합니다(지금 빠져 있습니다):

```js
const {
  tab, view, group, role, assignee, ws, q, task, roleInUrl,
  setParams, setQ, reset,
} = useLaunchFilters();
```

- [ ] **Step 2: `LaunchBoard` 에 넘긴다**

기존 props 는 하나도 빼지 말고 한 줄만 더합니다:

```jsx
  // 열려 있는 항목의 코드. 창을 state 가 아니라 주소가 연다.
  taskCode={task}
```

**이름이 `task` 가 아니라 `taskCode` 인 이유:** `LaunchBoard` 안에는 이미
`task` 라는 이름이 여러 map 콜백에서 쓰인다. prop 을 `task` 로 두면 그것들을
가린다 — 1단계에서 `role` 로 실제로 겪었다.

- [ ] **Step 3: 확인한다**

Run: `npm run build`
Expected: 성공. (이 단계만으로는 화면이 안 바뀝니다 — `LaunchBoard` 가 아직 안 씁니다.)

- [ ] **Step 4: 커밋**

```bash
git add -- "app/launch/[id]/page.js"
git commit -m "feat: 페이지가 열린 항목 코드를 보드에 내려 준다"
```

---

### Task 3: 창을 주소가 연다

**Files:**
- Modify: `components/launch/LaunchBoard.jsx`

- [ ] **Step 1: `linksFor` 를 없애고 주소로 바꾼다**

임포트를 더합니다:
```js
import { taskByCode } from '@/lib/launchTaskLink';
```

시그니처에 `taskCode` 를 더합니다(기존 props 유지):
```js
export function LaunchBoard({
  launch, tasks, today, decisions, members, canAdmin,
  view, group, role, roleInUrl, assignee, query, myMemberId, taskCode,
  onParams, onQuery, onReset,
  onChanged, onReload, onDecisionCreated, onBlockedChanged,
  focusWorkstream, onClearFocus,
}) {
```

**지웁니다:**
```js
const [linksFor, setLinksFor] = useState(null);
```

**넣습니다**(`shown` 근처, 다른 `useMemo` 들과 함께):
```js
// 창은 state 가 아니라 주소가 연다. 입구가 셋(줄 제목·「풀림 N」·링크)인데
// state 로 두면 링크로 들어온 사람만 다른 길을 타게 되고, 창 안에서 연계를
// 타고 옮겨 다닌 것이 주소에 안 남아 그 화면을 남에게 못 보낸다.
const { task: viewTask, missing: missingCode } = useMemo(
  () => taskByCode({ tasks, code: taskCode }),
  [tasks, taskCode],
);
```

- [ ] **Step 2: 입구 셋을 주소로 모은다**

`grep -n "setLinksFor" components/launch/LaunchBoard.jsx` 로 전부 찾으세요.

`TaskRow` 의 `onLinks` 를 바꿉니다:
```js
onLinks={() => {
  setMenuFor(null);
  onParams?.({ task: task.code });
}}
```

**줄 제목을 누를 수 있게 합니다.** `TaskRow` 안의 제목 `<p>` 를 찾아
(`{task.title}` 이 있는 줄), 제목만 감싸는 버튼으로 바꿉니다:

```jsx
{/* 제목을 누르면 그 항목을 연다. 지금까지 제목은 아무 일도 안 했고,
    항목을 열려면 ⋯ 메뉴를 거쳐야 했다. */}
<button
  type="button"
  onClick={onLinks}
  className="text-left hover:underline hover:decoration-indigo-300"
>
  {task.title}
</button>
```

★ 표시, 코드, 「해당없음」 배지는 **버튼 밖에** 그대로 둡니다 — 누르는 곳은
제목뿐입니다.

- [ ] **Step 3: 창을 갈아 끼운다**

```jsx
{/* 조건부로 그린다. 닫혀도 그리면 창 안의 '지금 보는 코드'가 지난 항목에
    머문다 — 이 병이 네 창에 있었다.
    고치기 창이 열려 있으면 이 창은 안 그린다. 주소의 task 는 그대로라
    고치기를 닫으면 다시 보기 창으로 돌아온다. */}
{viewTask && !taskDialog && (
  <TaskViewDialog
    open
    task={viewTask}
    tasks={tasks}
    myMemberId={myMemberId}
    launchName={launch?.name}
    openDate={openDate}
    today={today}
    busy={busy === viewTask.id}
    onNavigate={(code) => onParams?.({ task: code })}
    onClose={() => onParams?.({ task: '' })}
    onAssign={(next) => patchTask(viewTask, { assignee: next })}
    onEdit={(t) => setTaskDialog({ mode: 'edit', task: t })}
  />
)}
```

임포트 이름도 바꿉니다:
```js
import { TaskViewDialog } from '@/components/launch/TaskViewDialog';
```

**`onEdit` 가 `?task=` 를 안 지웁니다.** 같은 항목을 보고 있는 것이고,
고치기를 닫으면 보기 창으로 돌아옵니다.

- [ ] **Step 4: 못 찾은 코드를 말해 준다**

「내 담당 0」 안내 옆(툴바 아래, 목록 위)에 넣습니다:

```jsx
{/* 조용히 넘기지 않는다. 링크를 누른 사람은 무언가 열릴 것을 기대했다.
    주소의 task 는 안 지운다 — 지우면 왜 안 열렸는지 물을 근거가 사라진다. */}
{missingCode && (
  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    링크가 가리키는 항목 <b className="tabular-nums">{missingCode}</b> 를 이 런칭에서
    못 찾았습니다 — 지워졌거나 다른 런칭의 항목입니다.
  </p>
)}
```

- [ ] **Step 5: 확인한다**

```
npm run build && npm run test && npm run lint
```
Expected: 빌드 성공 · **75 파일 / 1174 + Task 1 의 6 = 1180 테스트** 통과 ·
새 lint 오류 없음(기존 `ImageDropzone.jsx:125` 경고 하나는 원래 있던 것).

`grep -n "setLinksFor\|linksFor" components/launch/LaunchBoard.jsx`
Expected: 결과 없음.

**이 단계에서 `TaskViewDialog.jsx` 가 아직 없으면 빌드가 깨집니다.**
Task 4 를 먼저 하거나, 이 단계에서 파일 이름만 먼저 바꾸세요
(`git mv components/launch/TaskLinksDialog.jsx components/launch/TaskViewDialog.jsx`
후 `export function TaskLinksDialog` → `TaskViewDialog`). **파일 이름을 먼저 바꾸는
쪽을 권합니다** — 그러면 이 단계가 혼자 서고 다음 단계가 내용만 다룹니다.

- [ ] **Step 6: 커밋**

```bash
git add -- components/launch/LaunchBoard.jsx components/launch/TaskViewDialog.jsx
git commit -m "feat: 항목 창을 주소가 연다 · 줄 제목 클릭"
```

---

### Task 4: 창에 기본 정보를 얹는다

**Files:**
- Modify: `components/launch/TaskViewDialog.jsx`

지금 이 창은 연계(선행·후행)만 보여줍니다. **기존 연계 부분은 건드리지 말고**
머리와 기본 정보만 더합니다.

- [ ] **Step 1: 보고 있는 코드를 밖에서 받는다**

지금은 로컬 state 입니다:
```js
const [code, setCode] = useState(() => task?.code ?? null);
```

**지웁니다.** 대신 `task` prop 이 곧 지금 보는 항목이고, 줄을 타는 것은
`onNavigate(code)` 로 밖에 알립니다.

```js
export function TaskViewDialog({
  open, task, tasks = [], myMemberId, launchName,
  openDate, today, busy = false,
  onNavigate, onClose, onAssign, onEdit,
}) {
  const links = linksOf({ task, tasks });
```

연계 줄을 누르던 자리(`setCode(...)`)를 **전부 `onNavigate(...)`** 로 바꿉니다.
`grep -n "setCode" components/launch/TaskViewDialog.jsx` 로 찾으세요.

**`from`(어디서 왔나) 표시가 있으면 그대로 둡니다** — 주소가 바뀌어도 그 줄이
하는 일은 같습니다.

- [ ] **Step 2: 머리 · 몸통 · 발 구조로 바꾼다**

`DialogContent` 를 세 덩어리로 나눕니다. **3단계에서 활동(댓글)이 붙으면 창이
길어지는데, 그때 입력칸이 댓글 12건 아래로 밀리지 않게 지금 구조를 잡아 둡니다.**

```jsx
<DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
  {/* 머리 — 고정 */}
  <DialogHeader className="shrink-0">
    <DialogTitle className="flex flex-wrap items-center gap-2">
      <span className="text-sm tabular-nums text-slate-400">{task.code}</span>
      <span className="min-w-0 flex-1">{task.title}</span>
      <button
        type="button"
        onClick={() => onEdit?.(task)}
        className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-normal text-slate-600 hover:bg-slate-50"
      >
        고치기
      </button>
    </DialogTitle>
    <DialogDescription>
      {launchName}
      {task.workstream && ` · ${task.workstream}`}
    </DialogDescription>
  </DialogHeader>

  {/* 몸통 — 스크롤 */}
  <div className="min-h-0 flex-1 overflow-y-auto">
    {/* 기본 정보 (Step 3) */}
    {/* 기존 연계 부분 — 그대로 */}
  </div>
</DialogContent>
```

**기존 `DialogFooter` 는 그대로 두되 `shrink-0` 을 더합니다.**

- [ ] **Step 3: 기본 정보를 넣는다**

몸통 맨 위, 연계 앞에 넣습니다:

```jsx
{/* 기한·주관·담당자. 지금까지 이 창은 연계만 보여줘서, 무엇을 언제까지
    누가 하는지는 고치기 창을 열어야 알 수 있었다. */}
<div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
  <Field label="기한">
    {due ? (
      <span className="tabular-nums">
        {due}
        {days !== null && (
          <span className={days < 0 ? 'ml-1 text-rose-600' : 'ml-1 text-slate-400'}>
            {dDayLabel(days)}
          </span>
        )}
      </span>
    ) : <span className="text-slate-400">없음</span>}
  </Field>

  <Field label="담당자">
    <Assignee
      task={task}
      myMemberId={myMemberId}
      busy={busy}
      onAssign={onAssign}
    />
  </Field>

  <Field label="주관">{task.owner_role || <span className="text-slate-400">없음</span>}</Field>
  <Field label="지원">{task.support_role || <span className="text-slate-400">없음</span>}</Field>
  <Field label="결정권">{task.decision_org || <span className="text-slate-400">없음</span>}</Field>
</div>
```

`Field` 를 파일 아래에 더합니다:

```js
// 이름과 값 한 쌍. 이름 칸을 고정폭으로 두면 값이 세로로 줄맞춤된다.
function Field({ label, children }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="w-14 shrink-0 text-[11.5px] text-slate-400">{label}</span>
      <span className="min-w-0 text-[13px] text-slate-800">{children}</span>
    </div>
  );
}
```

`due` 와 `days` 는 컴포넌트 안, `links` 바로 아래에서 만듭니다. 이 파일이
이미 세 함수를 임포트하고 있습니다(연계 줄이 같은 것을 씁니다):

```js
const due = dueDate(openDate, task.day_offset);
const days = dDay(due, today);
```

- [ ] **Step 4: 확인한다**

```
npm run build && npm run test
```

- [ ] **Step 5: 커밋**

```bash
git add -- components/launch/TaskViewDialog.jsx
git commit -m "feat: 항목 보기 창에 기한·주관·담당자"
```

---

### Task 5: 「나에게 맡기」

**Files:**
- Modify: `components/launch/TaskViewDialog.jsx`

- [ ] **Step 1: `Assignee` 를 만든다**

파일 아래에 더합니다:

```js
import { assigneeId } from '@/lib/launchMembers';

// 담당자 칸.
//
// 비어 있으면 「나에게 맡기」 한 줄. 드롭다운으로는 471건의 0 을 못 채운다 —
// 드롭다운은 "내가 후보에 있나"부터 알아야 하고(assigneeCandidates 는 그 항목의
// 주관 역할 참여자만 준다), 없으면 왜 없는지도 모른다.
//
// 남이 맡고 있으면 이 링크를 안 그린다. 남의 일을 한 번 눌러 가져가는 자리가
// 되면 안 된다 — 그때는 고치기 창의 드롭다운으로 바꾼다.
function Assignee({ task, myMemberId, busy, onAssign }) {
  // assignee 는 목록 API 에서 객체로 온다({ id, name }). === 문자열로 견주면
  // 늘 거짓이다 — 1단계에서 「내 담당」이 그래서 영영 0이었다.
  const current = assigneeId(task);
  const name = task.assignee?.name ?? task.assignee_name ?? '';

  if (!current && !name) {
    return myMemberId ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => onAssign?.(myMemberId)}
        className="text-[13px] text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:opacity-50"
      >
        나에게 맡기
      </button>
    ) : (
      <span className="text-slate-400">없음</span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[12.5px] text-indigo-700">
        {name || '(이름 없음)'}
      </span>
      {current && current === myMemberId && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign?.(null)}
          className="text-[11px] text-slate-400 underline hover:text-slate-600 disabled:opacity-50"
        >
          놓기
        </button>
      )}
    </span>
  );
}
```

**「놓기」는 내가 맡고 있을 때만 보입니다.** 남의 담당을 떼는 자리가 아닙니다.

- [ ] **Step 2: 눈으로 확인한다 — 숫자가 따라오나**

```
npm run build && npm run test && npm run dev
```

로그인하고 항목을 열어 **「나에게 맡기」를 누른 뒤**:

1. 이름이 그 자리에서 바뀌는가 (`onChanged` 로 그 줄만 갈아 끼운다)
2. **툴바의 「내 담당」 숫자가 그 자리에서 1 오르는가** ← 1단계에서 두 번 물린 자리
3. 「내 담당」을 눌렀을 때 그 항목이 목록에 있는가
4. 「놓기」를 누르면 되돌아오는가

**2번이 안 되면 멈추고 보고하세요.** `assigneeId` 를 안 쓰고 있거나
`onChanged` 가 응답을 안 반영하는 것입니다.

- [ ] **Step 3: 커밋**

```bash
git add -- components/launch/TaskViewDialog.jsx
git commit -m "feat: 항목 창에서 나에게 맡기"
```

---

### Task 6: 점검과 배포

- [ ] **Step 1: 전체**

```
npm run test && npm run lint && npm run build
```

- [ ] **Step 2: 주소를 손으로 고쳐 본다**

`npm run dev` 에서:

| 주소 | 기대 |
|---|---|
| `?task=18-22` | 그 항목 창이 열린 채로 도착 |
| `?task=99-99` | **창이 안 열리고** 빨간 안내 한 줄 |
| `?view=ready&task=18-22` | 18-22 가 막힘이어도 **창은 열리고 보기는 그대로** |
| `?task=` (빈 값) | 창도 안내도 없음 |
| 창에서 선행을 눌러 이동 | 주소의 `task` 가 따라 바뀜 |
| 「고치기」 → 닫기 | **보기 창으로 돌아옴** (`?task=` 유지) |

**두 번째 줄이 중요합니다.** 목업에서 이 자리에 버그가 났습니다 — 안내는
"99-99 를 못 찾았습니다"인데 창에는 지난 항목이 떠 있었습니다.

- [ ] **Step 3: 배포**

```
npm run package:src
```

`npm run package` 가 아닙니다.

---

## 안 하는 것 (2단계)

| | 언제 |
|---|---|
| 댓글·멘션 | 3단계 |
| 「기록」 탭 | 런칭에 이력 자료가 없다 |
| `/launch/[id]/tasks/[code]` 라우트 | `?task=` 로 충분하다 |
| 담당자 이름 드롭다운을 주소로 | 「나에게 맡기」가 uuid 를 채운 뒤 |
