# QA·최종 승인 단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 요구사항 흐름에 `QA중`·`승인대기` 두 상태를 더하고, `완료`로 가는 모든 전환이 "누가 무엇을 확인했는가"를 남기는 승인 절차를 지나게 한다.

**Architecture:** 상태 상수(`lib/statuses.js`)와 순수 판정 함수(`lib/approval.js`)를 단일 출처로 두고, 서버 라우트(`POST .../approve`)가 유일한 관문이 된다. 화면(보드·상세)은 같은 `ApprovalDialog` 하나를 공유하고, 기존 `PATCH .../status` 는 `완료`를 더 이상 받지 않는다. 승인 기록은 새 테이블 없이 `change_logs` 한 줄로 남는다.

**Tech Stack:** Next.js 16 (App Router, JS), React 19, Supabase Postgres, Vitest, Tailwind v4 + shadcn/ui(base-ui)

**설계 문서:** `docs/superpowers/specs/2026-08-03-qa-approval-design.md`

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `supabase/migrations/0017_qa_approval_statuses.sql` | CHECK 제약에 두 상태 추가 | 신규 |
| `lib/statuses.js` | 상태 상수 단일 출처. `DIRECT_STATUSES` 추가 | 수정 |
| `lib/statusMeta.js` | 상태의 색·뜻·다음 행동 | 수정 |
| `lib/approval.js` | `canApprove` 순수 판정 | 신규 |
| `lib/approval.test.js` | 위 함수 테스트 | 신규 |
| `app/api/requirements/[id]/approve/route.js` | 승인 라우트(유일한 완료 경로) | 신규 |
| `app/api/requirements/[id]/status/route.js` | 완료를 거부하도록 수정 | 수정 |
| `components/ApprovalDialog.jsx` | 확인 내용 입력 창. 보드·상세 공유 | 신규 |
| `app/requirements/board/page.js` | 완료 드롭 가로채기 | 수정 |
| `components/RequirementDetail.jsx` | Select 2곳 가로채기 + 승인 버튼 | 수정 |

**설계 문서에 없던 것 하나를 더한다.** 상세 화면의 상태 Select 는 `processAllowed`(3차 이상)에게만 보인다. 그런데 승인은 4차도 할 수 있어야 하므로, 4차에게는 승인할 수단이 아예 없다. **상태가 `승인대기`일 때 별도 `승인` 버튼**을 두어 이 구멍을 막는다(Task 8).

---

### Task 1: 마이그레이션 0017

**Files:**
- Create: `supabase/migrations/0017_qa_approval_statuses.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0017_qa_approval_statuses.sql`:

```sql
-- 0017: QA중 · 승인대기 상태 추가
--
-- 개발이 끝난 뒤 두 개의 문이 생긴다. QA중은 개발팀이 테스트하는 구간이고,
-- 승인대기는 요청한 브랜드나 본부가 "요청한 대로 됐다"를 확인하기를 기다리는
-- 구간이다. 두 구간은 기다리는 주체가 달라서 한 칸으로 합치지 않는다.
--
-- 아래 목록은 0009_requirement_fields.sql 의 제약에 두 값만 더한 것이다.
-- 0009 이후 상태를 건드린 마이그레이션은 없다(확인함).
--
-- 데이터 변환은 없다. 기존 요구사항은 전부 지금 상태 그대로다.
alter table requirements drop constraint if exists requirements_status_check;
alter table requirements add constraint requirements_status_check
  check (status in ('작성중','검토대기','검토중','개발중','QA중','승인대기',
                    '완료','반려','취소','중복'));

-- 검증용: 아래가 6이어야 한다(작성중/검토대기/검토중/개발중/QA중/승인대기 중
-- 실제 존재하는 값의 종류 수가 아니라, 제약이 새 값을 받는지 확인하는 용도).
--   select 'QA중'::text = any (array['작성중','검토대기','검토중','개발중',
--     'QA중','승인대기','완료','반려','취소','중복']);
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/0017_qa_approval_statuses.sql
git commit -m "feat: 0017 QA중·승인대기 상태 제약 추가"
```

> 마이그레이션 실행은 사용자가 Supabase SQL 편집기에서 직접 한다. Task 10 전에 실행되어야 한다.

---

### Task 2: 상태 상수 추가

**Files:**
- Modify: `lib/statuses.js`
- Modify: `lib/statusMeta.js`

- [ ] **Step 1: 기존 테스트를 먼저 돌려 현재 통과를 확인**

Run: `npx vitest run lib/statusMeta.test.js`
Expected: PASS

이 테스트는 `REQUIREMENT_STATUSES` 의 모든 상태가 `STATUS_META` 에 있는지 검사한다. 다음 단계에서 상태를 추가하면 **이 테스트가 깨진다.** 그게 정상이고, 그것이 이 테스트의 존재 이유다.

- [ ] **Step 2: `lib/statuses.js` 수정**

`REQUIREMENT_STATUSES` 와 `BOARD_STATUSES` 배열을 아래로 교체하고, 새 상수 세 줄을 더한다.

```js
export const REQUIREMENT_STATUSES = [
  '작성중',
  '검토대기',
  '검토중',
  '개발중',
  'QA중',
  '승인대기',
  '완료',
  '반려',
  '취소',
  '중복',
];

// 보드 컬럼(왼쪽→오른쪽). 종결 상태(반려·취소·중복)는 컬럼이 아니다 —
// 드래그로 옮기는 것이 아니라 사유를 적고 종결하는 행동이기 때문이다.
export const BOARD_STATUSES = [
  '작성중',
  '검토대기',
  '검토중',
  '개발중',
  'QA중',
  '승인대기',
  '완료',
];
```

파일 아래쪽, `REVIEW_PENDING_STATUS` 정의 다음에 추가한다:

```js
// 개발이 끝나고 테스트가 도는 구간. 개발팀이 들고 있다.
export const QA_STATUS = 'QA중';
// QA 가 끝나고 브랜드·본부의 최종 확인을 기다리는 구간. 상대 차례다.
export const APPROVAL_PENDING_STATUS = '승인대기';
```

그리고 `CLOSED_STATUSES` 정의 **다음에** 추가한다(`DONE_STATUS` 가 먼저 정의돼 있어야 한다):

```js
// 드래그·Select 로 바로 갈 수 있는 상태.
//
// 완료가 빠져 있는 것이 핵심이다. 완료는 POST .../approve 로만 도달한다 —
// 누가 무엇을 확인했는지를 받지 않고 완료로 보낼 길이 있으면 승인 절차 전체가
// 선택사항이 된다. 출발지가 승인대기든 개발중이든 마찬가지다.
export const DIRECT_STATUSES = BOARD_STATUSES.filter((s) => s !== DONE_STATUS);
```

- [ ] **Step 3: 테스트를 돌려 statusMeta 가 깨지는 것을 확인**

Run: `npx vitest run lib/statusMeta.test.js`
Expected: FAIL — `QA중`, `승인대기` 가 `STATUS_META` 에 없다는 내용

- [ ] **Step 4: `lib/statusMeta.js` 에 두 항목 추가**

`STATUS_META` 객체의 `개발중` 항목과 `완료` 항목 **사이에** 넣는다. 순서는 화면에 영향이 없지만(가이드는 `REQUIREMENT_STATUSES` 순서를 따른다) 읽는 사람을 위해 흐름대로 둔다.

동시에 `개발중` 의 `next` 를 고쳐야 한다 — 이제 개발 다음은 완료가 아니라 QA다.

```js
  개발중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 진행 중',
    next: 'IT — QA 시작',
  },
  'QA중': {
    // 개발중과 같은 계열. 아직 IT가 들고 있는 구간이라는 뜻이다.
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 끝나고 테스트가 진행 중',
    next: 'IT — 승인 요청',
  },
  '승인대기': {
    // 검토대기와 같은 색. 둘 다 "상대가 손대야 넘어간다"는 뜻이고, 목록에서
    // 튀어 보여야 한다. 승인대기가 오래 쌓이면 그게 병목이다.
    style: 'bg-amber-50 text-amber-700',
    meaning: 'QA까지 끝남, 브랜드·본부의 최종 확인을 기다리는 중',
    next: '브랜드·본부 — 승인',
  },
```

> `'QA중'` 과 `'승인대기'` 에 따옴표가 필요하다. `QA중` 은 따옴표 없이도 되지만 두 줄의 모양을 맞춘다.

- [ ] **Step 5: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS (전부)

- [ ] **Step 6: 커밋**

```bash
git add lib/statuses.js lib/statusMeta.js
git commit -m "feat: QA중·승인대기 상태 상수와 표현 추가"
```

---

### Task 3: `canApprove` 순수 함수 (TDD)

**Files:**
- Create: `lib/approval.js`
- Create: `lib/approval.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/approval.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { canApprove } from './approval';

const ACTOR = { memberId: 'm1', tier: '3차', isGlobalAdmin: false };

describe('canApprove', () => {
  it('일반적인 경우 승인할 수 있다', () => {
    const r = { status: '승인대기', assignee: 'm2' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('승인대기가 아니어도 승인할 수 있다 — 완료로 가는 길은 하나뿐이다', () => {
    const r = { status: '개발중', assignee: 'm2' };
    expect(canApprove({ requirement: r, actor: ACTOR }).allowed).toBe(true);
  });

  it('이미 완료면 거절한다', () => {
    const r = { status: '완료', assignee: 'm2' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: false,
      reason: '이미 완료된 요구사항입니다.',
    });
  });

  it('종결된 건은 거절한다', () => {
    for (const status of ['반려', '취소', '중복']) {
      expect(canApprove({ requirement: { status, assignee: 'm2' }, actor: ACTOR })).toEqual({
        allowed: false,
        reason: '종결된 요구사항은 승인할 수 없습니다.',
      });
    }
  });

  it('담당자 본인은 거절한다', () => {
    const r = { status: '승인대기', assignee: 'm1' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: false,
      reason: '담당자 본인은 승인할 수 없습니다.',
    });
  });

  it('전체 관리자는 담당자여도 승인할 수 있다', () => {
    const r = { status: '승인대기', assignee: 'm1' };
    const admin = { memberId: 'm1', tier: '3차', isGlobalAdmin: true };
    expect(canApprove({ requirement: r, actor: admin }).allowed).toBe(true);
  });

  it('전체 관리자여도 이미 완료된 건은 거절한다', () => {
    const r = { status: '완료', assignee: 'm2' };
    const admin = { memberId: 'm9', tier: '1차', isGlobalAdmin: true };
    expect(canApprove({ requirement: r, actor: admin }).allowed).toBe(false);
  });

  it('담당자가 없는 건은 아무나 승인할 수 있다', () => {
    // assignee 와 memberId 가 둘 다 undefined 일 때 undefined === undefined 로
    // 통과해 "담당자 본인" 판정에 걸리는 사고를 막는다.
    const r = { status: '승인대기', assignee: null };
    expect(canApprove({ requirement: r, actor: { memberId: undefined } }).allowed).toBe(true);
    expect(canApprove({ requirement: { status: '승인대기' }, actor: {} }).allowed).toBe(true);
  });

  it('입력이 없으면 거절한다', () => {
    expect(canApprove({ requirement: null, actor: ACTOR }).allowed).toBe(false);
    expect(canApprove({ requirement: { status: '승인대기' }, actor: null }).allowed).toBe(false);
    expect(canApprove({}).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/approval.test.js`
Expected: FAIL — `Failed to resolve import "./approval"`

- [ ] **Step 3: 구현**

`lib/approval.js`:

```js
import { DONE_STATUS, CLOSED_STATUSES } from './statuses';

// 이 요구사항을 승인해서 완료로 보낼 수 있는가.
//
// 브랜드 접근 권한은 여기서 보지 않는다. 라우트가 requireBrandAccess(brandId,
// '4차') 로 이미 판정하므로, 같은 규칙을 두 벌로 갖지 않는다. 이 함수가 답하는
// 것은 "접근할 수 있는 사람이라면, 이 건을 승인해도 되는가" 하나다.
//
// 소속(브랜드/본부)으로 가르지 않는 이유: team_members.affiliation 은 가입 시
// 자기 신고값이라 권한 판단에 쓰지 않기로 되어 있다. 본부 사람도 실제로는
// 브랜드 배치나 전체관리자 권한으로 그 건에 접근한다.
//
// requirement: { status, assignee }
// actor: { memberId, isGlobalAdmin }
// 반환: { allowed: boolean, reason: string|null }
export function canApprove({ requirement, actor } = {}) {
  if (!requirement || !actor) {
    return { allowed: false, reason: '승인할 수 없습니다.' };
  }

  // 상태 검사가 권한 검사보다 먼저다. 전체 관리자라도 이미 끝난 건을 두 번
  // 완료시킬 수는 없다 — 그러면 change_logs 에 완료 → 완료 가 쌓인다.
  if (requirement.status === DONE_STATUS) {
    return { allowed: false, reason: '이미 완료된 요구사항입니다.' };
  }
  if (CLOSED_STATUSES.includes(requirement.status)) {
    return { allowed: false, reason: '종결된 요구사항은 승인할 수 없습니다.' };
  }

  if (actor.isGlobalAdmin) return { allowed: true, reason: null };

  // 담당자 본인 제외가 이 함수의 존재 이유다. 이것이 없으면 개발 → QA →
  // 본인 승인이 되어 도장 찍기가 되고, 점검 단계를 만든 목적과 정면으로
  // 충돌한다.
  //
  // Boolean(assignee) 가드가 필요하다. 담당자가 없는 건에서 assignee 와
  // memberId 가 둘 다 undefined 면 undefined === undefined 로 참이 되어,
  // 아무 관계 없는 사람이 "담당자 본인"으로 걸린다.
  if (Boolean(requirement.assignee) && requirement.assignee === actor.memberId) {
    return { allowed: false, reason: '담당자 본인은 승인할 수 없습니다.' };
  }

  return { allowed: true, reason: null };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/approval.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/approval.js lib/approval.test.js
git commit -m "feat: canApprove 순수 판정 함수"
```

---

### Task 4: 승인 라우트

**Files:**
- Create: `app/api/requirements/[id]/approve/route.js`

- [ ] **Step 1: 라우트 작성**

`app/api/requirements/[id]/approve/route.js`:

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { DONE_STATUS } from '@/lib/statuses';
import { canApprove } from '@/lib/approval';
import { computeCompletedAt } from '@/lib/completedAt';
import { notifyStatusChange } from '@/lib/notify';

const MAX_REASON = 500;

// 최종 승인 — 완료로 가는 유일한 길.
//
// PATCH .../status 가 완료를 받지 않기 때문에(DIRECT_STATUSES) 여기가 관문이다.
// 출발 상태를 가리지 않는다: 개발중에서 바로 와도 받는다. 절차를 강제하지
// 않되 건너뛴 사실은 상태 이력에 남는다 — 사소한 건까지 QA를 거치게 하면
// 사람들은 규칙을 우회할 방법부터 찾는다.
//
// 최소 등급이 4차인 것이 status 라우트(3차)와 다른 점이다. 승인은 요청한
// 브랜드가 "받았다"고 확인하는 행동이라, 요청자도 할 수 있어야 한다.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, reason } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    // 무엇을 확인했는지가 안 남으면 이 단계를 만든 의미가 없다.
    if (!reason?.trim()) throw new ApiError(400, '확인 내용을 입력해 주세요.');
    if (reason.trim().length > MAX_REASON) {
      throw new ApiError(400, `확인 내용은 ${MAX_REASON}자 이하여야 합니다.`);
    }

    const { memberId, isGlobalAdmin } = await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, status, assignee, completed_at')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    const verdict = canApprove({
      requirement: current,
      actor: { memberId, isGlobalAdmin },
    });
    if (!verdict.allowed) throw new ApiError(403, verdict.reason);

    const nowIso = new Date().toISOString();
    const completedAt = computeCompletedAt(current.status, DONE_STATUS, current.completed_at, nowIso);

    const { error: updError } = await supabase
      .from('requirements')
      .update({ status: DONE_STATUS, completed_at: completedAt, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    // 상태 변경으로 기록한다. 별도 change_type 을 만들지 않는 이유:
    // lib/statusDurations.js 가 field_name === 'status' 로 걸러 구간을 계산하는데,
    // 그 필터에 걸리려면 여기도 같은 모양이어야 한다. 승인은 상태 변경의
    // 한 종류이고, 확인 내용은 반려·취소 사유와 같은 자리(comment)에 들어간다.
    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '상태변경',
      field_name: 'status',
      old_value: current.status,
      new_value: DONE_STATUS,
      comment: reason.trim(),
    });
    if (logError) throw logError;

    // 완료는 요청자가 가장 알고 싶어 하는 소식이다. 실패해도 조용히 넘어간다.
    await notifyStatusChange({ requirementId: id, actorId: memberId, status: DONE_STATUS });

    return Response.json({ ok: true, status: DONE_STATUS });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 빌드로 문법·임포트 확인**

Run: `npm run build`
Expected: `✓ Compiled successfully`, 라우트 목록에 `/api/requirements/[id]/approve` 가 보인다

- [ ] **Step 3: 커밋**

```bash
git add "app/api/requirements/[id]/approve/route.js"
git commit -m "feat: POST /api/requirements/[id]/approve"
```

---

### Task 5: status 라우트가 완료를 거부하게

**Files:**
- Modify: `app/api/requirements/[id]/status/route.js`

- [ ] **Step 1: import 교체**

4번 줄을 아래로 바꾼다. `BOARD_STATUSES` 는 이 파일에서 더 이상 쓰지 않으므로 뺀다.

```js
import { DIRECT_STATUSES, MERGED_STATUS, DONE_STATUS } from '@/lib/statuses';
```

- [ ] **Step 2: 검증 블록 교체**

기존:

```js
    if (!BOARD_STATUSES.includes(status)) {
      throw new ApiError(400, '유효하지 않은 상태입니다.');
    }
```

교체:

```js
    // 완료를 여기서 막는 것이 이번 변경의 핵심이다. 화면이 다이얼로그를
    // 띄우게 되어 있지만, 서버가 관문이어야 그 화면을 우회해도 막힌다.
    if (status === DONE_STATUS) {
      throw new ApiError(400, '완료는 승인 절차로만 처리할 수 있습니다.');
    }
    if (!DIRECT_STATUSES.includes(status)) {
      throw new ApiError(400, '유효하지 않은 상태입니다.');
    }
```

- [ ] **Step 3: lint + build**

Run: `npx eslint . && npm run build`
Expected: eslint 0 errors(경고 2개는 기존 `<img>` 관련), build 성공

- [ ] **Step 4: 커밋**

```bash
git add "app/api/requirements/[id]/status/route.js"
git commit -m "feat: 상태 변경 API가 완료를 거부한다"
```

---

### Task 6: ApprovalDialog 컴포넌트

**Files:**
- Create: `components/ApprovalDialog.jsx`

- [ ] **Step 1: 컴포넌트 작성**

`components/ApprovalDialog.jsx`:

```jsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { APPROVAL_PENDING_STATUS } from '@/lib/statuses';

const MAX_REASON = 500;

// 최종 승인 창. 보드와 상세가 같은 컴포넌트를 쓴다 — 두 벌로 만들면 한쪽만
// 고치는 날이 온다.
//
// 확인 내용을 필수로 받는 것이 이 창의 존재 이유다. 버튼 하나로 끝내면
// "누가 눌렀다"만 남고 "무엇을 확인했다"가 안 남는다.
//
// props:
//   requirement — { id, title, status, brand_id }
//   brandId     — 요청에 실을 브랜드(요구사항 자신의 브랜드)
//   onApproved  — 성공 시 호출. 부모가 목록/상세를 다시 불러온다
//   onOpenChange
export function ApprovalDialog({ open, onOpenChange, requirement, brandId, onApproved }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 창이 열리는 렌더에서 초기화한다(useEffect 대신 파생 상태).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason('');
      setError('');
    }
  }

  // 승인대기를 거치지 않고 바로 완료로 오는 경우를 알려 준다. 막지는 않는다 —
  // 급한 건이나 사소한 건까지 QA를 강제하면 사람들은 우회로부터 찾는다.
  const skipped = requirement?.status !== APPROVAL_PENDING_STATUS;

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/requirements/${requirement.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '승인에 실패했습니다.');
      onOpenChange(false);
      onApproved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>최종 승인</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3 break-keep text-sm">
          <p className="text-slate-600">
            <span className="font-medium text-slate-900">{requirement?.title}</span>
            {' 를 완료로 처리합니다.'}
          </p>

          {skipped && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              현재 상태는 <b>{requirement?.status}</b> 입니다. QA중·승인대기를 거치지
              않았고, 그 사실은 상태 이력에 그대로 남습니다.
            </p>
          )}

          {error && <p className="text-red-600">{error}</p>}

          <div className="flex flex-col gap-1">
            <label htmlFor="approval-reason" className="text-slate-600">
              무엇을 확인하셨나요?
            </label>
            <textarea
              id="approval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={MAX_REASON}
              placeholder="예: 요청한 데이터 파이프라인이 설계대로 동작하는 것을 확인했습니다."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              required
            />
            <p className="text-xs text-slate-400">
              나중에 요구사항을 정리할 때 이 기록이 재료가 됩니다.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? '처리 중...' : '승인하고 완료'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: lint**

Run: `npx eslint components/ApprovalDialog.jsx`
Expected: 0 problems

- [ ] **Step 3: 커밋**

```bash
git add components/ApprovalDialog.jsx
git commit -m "feat: ApprovalDialog — 보드·상세가 공유하는 승인 창"
```

---

### Task 7: 보드에서 완료 드롭 가로채기

**Files:**
- Modify: `app/requirements/board/page.js`

- [ ] **Step 1: import 추가**

파일 상단 import 목록에 두 줄을 더한다.

```js
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { DONE_STATUS } from '@/lib/statuses';
```

- [ ] **Step 2: 상태 하나 추가**

`const [mergeSource, setMergeSource] = useState(null);` 근처에 추가한다.

```js
  // 완료로 드래그된 카드. 승인 창이 이 값을 보고 열린다.
  const [approvalTarget, setApprovalTarget] = useState(null);
```

- [ ] **Step 3: `handleStatusChange` 를 아래로 교체**

```js
  async function handleStatusChange(card, newStatus) {
    // 완료만 다르게 다룬다. 카드를 먼저 옮겨 놓고 창을 닫으면 되돌리는 순간이
    // 깜빡여서 승인이 된 건지 만 건지 헷갈린다. 이 전환만 "성공한 뒤에
    // 움직인다" — 낙관적 갱신을 하지 않는 유일한 경우다.
    if (newStatus === DONE_STATUS) {
      // 담당자 본인이면 창을 띄우지 않는다. 적게 한 다음 거절하는 것은
      // 시간 낭비다. 서버도 같은 판정을 다시 하므로 여기는 안내일 뿐이다.
      if (card.assignee?.id && card.assignee.id === identity.memberId) {
        setError('담당자 본인은 승인할 수 없습니다. 브랜드 또는 본부의 다른 분께 확인을 요청해 주세요.');
        return;
      }
      setError('');
      setApprovalTarget(card);
      return;
    }

    const prevStatus = card.status;
    setReqs((prev) => prev.map((r) => (r.id === card.id ? { ...r, status: newStatus } : r)));

    const res = await fetch(`/api/requirements/${card.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: card.brand_id ?? identity.brandId, status: newStatus }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '상태 변경 실패');
      setReqs((prev) => prev.map((r) => (r.id === card.id ? { ...r, status: prevStatus } : r)));
    }
  }
```

> `card.assignee` 는 목록 API 가 `assignee:team_members(...)` 로 조인해 내려주므로 `{ id, name }` 객체다. `card.assignee?.id` 로 읽어야 한다.

- [ ] **Step 4: 다이얼로그 렌더 추가**

`{mergeSource && ( ... )}` 블록 **다음에**, `</div>` 앞에 넣는다.

```jsx
      {approvalTarget && (
        <ApprovalDialog
          open
          onOpenChange={(v) => {
            if (!v) setApprovalTarget(null);
          }}
          requirement={approvalTarget}
          brandId={approvalTarget.brand_id ?? identity.brandId}
          onApproved={() => {
            setApprovalTarget(null);
            load();
          }}
        />
      )}
```

- [ ] **Step 5: lint + build**

Run: `npx eslint . && npm run build`
Expected: eslint 0 errors, build 성공

- [ ] **Step 6: 커밋**

```bash
git add app/requirements/board/page.js
git commit -m "feat: 보드에서 완료로 드래그하면 승인 창이 뜬다"
```

---

### Task 8: 상세 화면 — Select 가로채기 + 승인 버튼

**Files:**
- Modify: `components/RequirementDetail.jsx`

상세에는 `changeStatus` 를 부르는 Select 가 **둘** 있다(일반 Select, 종결 건의 "재개" Select). 둘 다 같은 함수를 부르므로 함수 하나만 고치면 된다.

- [ ] **Step 1: import 추가**

```js
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { canApprove } from '@/lib/approval';
```

그리고 기존 `@/lib/statuses` import 에 `APPROVAL_PENDING_STATUS` 를 더한다.

- [ ] **Step 2: 상태 추가**

`const [editing, setEditing] = useState(false);` 근처에 추가한다.

```js
  // 승인 창 열림 여부. 완료로 가려는 모든 경로가 이 창을 지난다.
  const [approvalOpen, setApprovalOpen] = useState(false);
```

- [ ] **Step 3: `changeStatus` 를 아래로 교체**

상세 API 는 `assignee` 를 `assignee:team_members!...(id, name)` 로 조인해 **객체**로 내려주는데, `canApprove` 는 **문자열 id** 를 본다. 그래서 `.id` 로 풀어 넘긴다 — 객체를 그대로 넘기면 `{...} === 'm1'` 이 항상 거짓이라 담당자 본인 판정이 조용히 통과한다.

```js
  async function changeStatus(status) {
    setActionError('');
    // 완료는 상태 변경 API 가 받지 않는다. 보드와 같은 창을 띄운다 —
    // 여기만 막아 두면 상세 Select 가 우회로가 된다.
    if (status === DONE_STATUS) {
      const verdict = canApprove({
        requirement: {
          status: data?.requirement?.status,
          assignee: data?.requirement?.assignee?.id ?? null,
        },
        actor: { memberId: identity.memberId, isGlobalAdmin: isGlobalAdmin(identity) },
      });
      if (!verdict.allowed) {
        setActionError(verdict.reason);
        return;
      }
      setApprovalOpen(true);
      return;
    }

    const res = await fetch(`/api/requirements/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: requirementBrandId, status }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '상태 변경 실패');
      return;
    }
    load();
  }
```

- [ ] **Step 4: 승인 버튼 추가 (4차를 위한 유일한 승인 수단)**

상태 Select 블록의 닫는 `)}` 다음, 검토 요청 버튼 근처에 넣는다. 조건은 "승인대기이고, 내가 승인할 수 있을 때"다.

```jsx
            {/* 상태 Select 는 3차 이상에게만 보인다. 승인은 4차도 할 수 있어야
                하므로 별도 버튼이 필요하다 — 이게 없으면 요청한 브랜드 담당자가
                자기 건을 확인할 방법이 없다. */}
            {r.status === APPROVAL_PENDING_STATUS &&
              canApprove({
                requirement: { status: r.status, assignee: r.assignee?.id ?? null },
                actor: { memberId: identity.memberId, isGlobalAdmin: isGlobalAdmin(identity) },
              }).allowed && (
                <button
                  type="button"
                  onClick={() => setApprovalOpen(true)}
                  className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                >
                  승인하고 완료
                </button>
              )}
```

- [ ] **Step 5: 다이얼로그 렌더 추가**

`<RequirementDangerZone ... />` 블록 **다음**, 최상위 `</div>` 앞에 넣는다.

```jsx
      <ApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        requirement={r}
        brandId={requirementBrandId}
        onApproved={load}
      />
```

- [ ] **Step 6: lint + build**

Run: `npx eslint . && npm run build`
Expected: eslint 0 errors, build 성공

- [ ] **Step 7: 커밋**

```bash
git add components/RequirementDetail.jsx
git commit -m "feat: 상세에서 완료 선택 시 승인 창, 승인대기에 승인 버튼"
```

---

### Task 9: 도움말 갱신

**Files:**
- Modify: `components/StatusGuide.jsx` (확인만 — 수정 불필요일 수 있음)

- [ ] **Step 1: 자동 반영 여부 확인**

`StatusGuide` 는 `BOARD_STATUSES` 로 흐름도를, `STATUS_GUIDE`(= `REQUIREMENT_STATUSES` 순회)로 표를 그린다. Task 2 에서 두 배열을 모두 고쳤으므로 **코드 수정 없이 반영된다.**

Run: `npm run build`
그리고 빌드 산출물에서 문구가 들어갔는지 확인한다:

```bash
grep -rl "승인대기" .next/server/app/help*  || echo "확인 필요"
```

Expected: 파일 경로가 출력된다

- [ ] **Step 2: 승인 규칙 한 문단 추가**

표만으로는 "누가 승인할 수 있는지"가 안 보인다. `StatusGuide` 의 `</table>` **다음**, `</section>` 앞에 넣는다.

```jsx
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 break-keep">
        <h3 className="mb-1 font-medium text-slate-900">최종 승인</h3>
        <p>
          완료로 넘기려면 승인이 필요합니다. 그 요구사항을 볼 수 있는 사람이면
          브랜드·본부 누구든 한 명이 승인하면 되고, 순서는 없습니다.
        </p>
        <p className="mt-1">
          다만 <b>담당자 본인은 승인할 수 없습니다.</b> 만든 사람이 스스로 확인하면
          점검이 되지 않기 때문입니다.
        </p>
        <p className="mt-1">
          승인할 때 무엇을 확인했는지 적습니다. QA중·승인대기를 건너뛰고 바로
          완료로 보낼 수도 있지만, 건너뛴 사실은 상태 이력에 남습니다.
        </p>
      </div>
```

- [ ] **Step 3: lint + build + 커밋**

Run: `npx eslint . && npm run build`

```bash
git add components/StatusGuide.jsx
git commit -m "docs: 도움말에 최종 승인 규칙 추가"
```

---

### Task 10: 전체 검증 + 배포 준비

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npx vitest run`
Expected: 전부 PASS. Task 3 에서 9개가 늘었으므로 **408개**(현재 399 + 9)

- [ ] **Step 2: lint**

Run: `npx eslint .`
Expected: `0 errors` (경고 2개는 기존 `<img>` 관련이라 무방)

- [ ] **Step 3: build**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 사용자에게 마이그레이션 실행 요청**

Task 1 의 `0017_qa_approval_statuses.sql` 을 Supabase SQL 편집기에서 실행해야 한다. **이걸 안 하면 QA중으로 옮기는 순간 CHECK 제약 위반(23514)이 난다.**

- [ ] **Step 5: 브라우저 검증 (사용자)**

마이그레이션 실행 후 확인할 것:

1. 보드에 `QA중`·`승인대기` 컬럼이 보이는가 (7칸)
2. `개발중 → QA중` 드래그가 되는가
3. `QA중 → 개발중` 드래그로 되돌아가는가
4. `개발중 → 완료` 드래그 시 승인 창이 뜨고, 노란 안내(건너뜀)가 보이는가
5. 창을 닫으면 카드가 제자리인가
6. 상세 화면 Select 에서 `완료` 선택 시 같은 창이 뜨는가
7. 담당자 본인이 완료로 옮기면 창 없이 안내 문구가 뜨는가
8. 승인 후 상세의 **상태 구간**에 `QA중 N일` 이 잡히는가
9. 승인 후 **활동 이력**에 확인 내용이 보이는가
10. 4차 계정으로 `승인대기` 건을 열면 `승인하고 완료` 버튼이 보이는가

- [ ] **Step 6: ZIP**

Run: `npm run package:src:env`

산출물: `dist/moa-src-0.1.0-<날짜>-<시각>.zip`

---

## 자동으로 맞는 것 (손대지 않음, 확인만)

아래는 코드 변경 없이 동작한다. Task 10 브라우저 검증에서 눈으로 확인한다.

- **상태 필터** — `REQUIREMENT_STATUSES` 를 그대로 쓰므로 선택지가 둘 늘어난다
- **지연 판정(`isOverdue`)** — QA중·승인대기는 `CLOSED_STATUSES` 가 아니라 지연 대상에 포함된다
- **상태 구간(`lib/statusDurations.js`)** — `field_name === 'status'` 로 거르므로 새 상태 구간이 자동으로 잡힌다
- **대시보드** — 미완료 집계에 자연히 들어간다
