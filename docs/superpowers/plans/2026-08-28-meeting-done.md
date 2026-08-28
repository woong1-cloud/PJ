# 주간회의 화면에 이번 주 완료 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax로 tracking.

**Goal:** 주간회의가 밀린 것만 보는 자리가 되지 않게, 이번 주에 끝낸 것을 함께 보여준다.

**Architecture:** 회의 API 의 조회 범위를 미종결 + 지난 7일 완료로 넓히고, 화면에 요약 칩과 보기 칩을 하나씩 더한다. 완료 건의 문구는 목록·상세가 쓰는 `closureReason` 을 그대로 쓴다.

**Tech Stack:** Next.js 16 App Router (JS), React 19, Tailwind v4, Supabase, Vitest

설계 문서: `docs/superpowers/specs/2026-08-28-feedback-loop-design.md` 6절

---

## 이 계획이 지키는 경계

**소통 루프 스펙의 6절만 한다.** 의견 보내기(1~4절)와 업데이트 소식(5절)은
별도 배포다.

**서버는 회의 API 하나만 바꾼다.** 권한·알림·마이그레이션은 그대로다.

**새 순수 함수를 만들지 않는다.** 완료 건의 문구는 `lib/closureReason.js` 가
이미 만든다. 그 둘에 테스트가 있으므로 여기에 또 걸지 않는다.

---

## 지금 무엇이 문제인가

`app/api/meeting/route.js:37` 이 미종결 건만 가져온다.

```js
.not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);
```

그래서 회의 화면에는 이번 주에 끝낸 것이 아예 없다. 회의 **메일**에는
`이번 주 움직인 것` 블록이 있는데 화면에는 없어서, 메일과 화면이 어긋나 있다.

요약 칩 셋도 전부 문제를 세는 숫자다 — `14일+ 멈춤` · `담당 없음` ·
`이번 주 신규`. 회의가 나쁜 소식 셋으로 시작한다.

---

## 파일 구조

| 파일 | 무엇을 |
|---|---|
| `app/api/meeting/route.js` | 조회 범위를 넓히고 완료 정보를 실어 보낸다 |
| `components/MeetingBoard.jsx` | 요약 칩·보기 칩 하나씩, 완료 줄 표시 |

새로 만드는 파일은 없다.

---

## Task 1: 회의 API 가 이번 주 완료를 함께 가져온다

**Files:**
- Modify: `app/api/meeting/route.js`

- [ ] **Step 1: import 를 더한다**

파일 상단 import 에 한 줄 더한다. `DONE_STATUS` 는 기존 `@/lib/statuses`
import 에 이름만 추가한다.

```js
import { CLOSED_STATUSES, DONE_STATUS } from '@/lib/statuses';
import { closureReason } from '@/lib/closureReason';
```

- [ ] **Step 2: 조회 범위를 넓힌다**

`.select(...)` 에 `completed_at` 을 더하고, 상태 조건을 바꾼다.

```js
    const doneSince = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();
    const { data: rows, error } = await supabase
      .from('requirements')
      .select(
        'id, title, status, created_at, completed_at, expected_release_date, ' +
          'assignee:team_members!requirements_assignee_fkey(id, name), ' +
          'requester:team_members!requirements_requester_fkey(id, name)'
      )
      .eq('brand_id', brandId)
      // 미종결 + 지난 7일 안에 완료된 것.
      //
      // 종결 전체를 가져오면 완료 11건이 다 딸려와 목록이 흐려진다. 회의는
      // "이번 주에 뭘 끝냈나"를 보는 자리이지 완료 이력을 보는 자리가 아니다.
      //
      // 반려·취소·중복은 넣지 않는다. 끝낸 것이 아니라 안 하기로 한 것이라,
      // 성과 칸에 섞이면 숫자가 거짓말을 한다.
      .or(
        `status.not.in.(${CLOSED_STATUSES.join(',')}),` +
          `and(status.eq.${DONE_STATUS},completed_at.gte.${doneSince})`
      );
    if (error) throw error;
```

- [ ] **Step 3: change_logs select 를 넓힌다**

완료 건의 승인 확인 내용을 만들려면 `comment` 가 필요하다. 같은 쿼리에 컬럼
셋을 더하는 것은 행이 늘지 않으므로 거의 공짜다.

```js
      const { data: logs, error: logError } = await supabase
        .from('change_logs')
        .select('requirement_id, created_at, field_name, new_value, comment')
        .in('requirement_id', ids);
```

- [ ] **Step 4: 항목에 완료 정보를 실는다**

`items` 를 만드는 `.map()` 안에 세 줄을 더한다.

```js
    const items = (rows ?? [])
      .map((r) => {
        const rowLogs = logsBy.get(r.id) ?? [];
        return {
          id: r.id,
          title: r.title,
          status: r.status,
          expectedDate: r.expected_release_date,
          assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name } : null,
          requester: r.requester ? { id: r.requester.id, name: r.requester.name } : null,
          stalledDays: stalledDays({
            requirement: r,
            changeLogs: rowLogs,
            comments: commentsBy.get(r.id) ?? [],
            now,
          }),
          isNew: (r.created_at ?? '') >= since,
          // 완료 건은 며칠 걸렸는지를 말한다. 상세 머리 줄과 같은 규칙이다.
          isDone: r.status === DONE_STATUS,
          tookDays:
            r.status === DONE_STATUS && r.created_at && r.completed_at
              ? Math.floor(
                  (Date.parse(r.completed_at) - Date.parse(r.created_at)) / 86400000
                )
              : null,
          // 승인 확인 내용. 상세 배너와 같은 함수를 쓰므로 문구가 갈리지 않는다.
          closure: closureReason({ requirement: r, changeLogs: rowLogs }),
        };
      })
      .sort((a, b) => (b.stalledDays ?? 0) - (a.stalledDays ?? 0));
```

- [ ] **Step 5: 요약에 완료 수를 더한다**

```js
      summary: {
        stalled: items.filter((i) => (i.stalledDays ?? 0) >= STALL_DAYS).length,
        unassigned: items.filter((i) => !i.assignee && !i.isDone).length,
        incoming: items.filter((i) => i.isNew).length,
        done: items.filter((i) => i.isDone).length,
      },
```

`unassigned` 에 `!i.isDone` 을 더하는 이유: 완료 건이 목록에 들어오면서
담당자 없이 끝난 건이 "담당 없음"으로 세어진다. 그건 지금 손볼 일이 아니다.

- [ ] **Step 6: 실제 응답을 확인한다**

```bash
npm run build
```

Expected: 빌드 성공

`.or()` 안의 `and(...)` 문법은 PostgREST 고유라 오타가 나면 런타임에만
드러난다. 임시 점검 파일로 실제 데이터를 확인한다.

`lib/__meeting.test.js` 를 만들어 아래를 넣고 돌린 뒤 **바로 지운다**.

```js
import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { CLOSED_STATUSES, DONE_STATUS } from './statuses';

function env() {
  const raw = readFileSync('.env.local', 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

test('meeting scope', async () => {
  const e = env();
  const db = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: brands } = await db.from('brands').select('id, name').eq('is_active', true);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const L = [];
  for (const b of brands ?? []) {
    const { data, error } = await db
      .from('requirements')
      .select('id, title, status, completed_at')
      .eq('brand_id', b.id)
      .or(
        `status.not.in.(${CLOSED_STATUSES.join(',')}),` +
          `and(status.eq.${DONE_STATUS},completed_at.gte.${since})`
      );
    L.push(`${b.name}: ${error ? '오류 ' + error.message : (data ?? []).length + '건'}`);
    for (const r of (data ?? []).filter((r) => r.status === DONE_STATUS)) {
      L.push(`  [완료] ${r.title} · ${String(r.completed_at).slice(0, 10)}`);
    }
  }
  writeFileSync('__meeting.txt', L.join('\n'), 'utf8');
}, 120000);
```

```bash
npx vitest run lib/__meeting.test.js && cat __meeting.txt && rm -f lib/__meeting.test.js __meeting.txt
```

Expected: 오류 없이 건수가 나오고, 완료 건은 지난 7일 안의 것만 나온다.

- [ ] **Step 7: 커밋**

```bash
git add app/api/meeting/route.js
git commit -m "feat: 회의 API 가 이번 주 완료 건을 함께 가져온다"
```

---

## Task 2: 화면에 완료를 보여준다

**Files:**
- Modify: `components/MeetingBoard.jsx`

- [ ] **Step 1: 보기 칩을 더한다**

```jsx
const FILTERS = [
  { key: 'all', label: '오래 멈춘 순' },
  { key: 'unassigned', label: '담당 없는 것만' },
  { key: 'incoming', label: '이번 주 신규' },
  { key: 'done', label: '이번 주 완료' },
];
```

- [ ] **Step 2: 거르는 규칙을 더한다**

```jsx
  const rows = data.items.filter((item) => {
    // 완료는 따로 볼 때만 나온다. 기본 보기에 섞이면 "지금 손볼 것"이 흐려진다 —
    // 이 화면은 회의에서 밀린 것을 훑는 자리가 먼저다.
    if (filter === 'done') return item.isDone;
    if (item.isDone) return false;
    if (filter === 'unassigned') return !item.assignee;
    if (filter === 'incoming') return item.isNew;
    return true;
  });
```

- [ ] **Step 3: 요약 칩을 넷으로 늘린다**

```jsx
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={`${stallDays}일+ 멈춤`} value={data.summary.stalled} tone="rose" />
        <Stat label="담당 없음" value={data.summary.unassigned} tone="amber" />
        <Stat label="이번 주 신규" value={data.summary.incoming} tone="slate" />
        {/* 넷 중 하나는 좋은 소식이어야 한다. 나머지 셋이 전부 문제를 세는
            숫자라, 회의가 나쁜 소식으로만 시작하고 있었다. */}
        <Stat label="이번 주 완료" value={data.summary.done} tone="emerald" />
      </div>
```

`Stat` 의 `tones` 에 한 줄 더한다.

```jsx
  const tones = {
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-800',
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
```

- [ ] **Step 4: 완료 줄을 다르게 그린다**

행 안의 뱃지와 컨트롤을 완료 여부로 가른다.

```jsx
            <div className="min-w-0 flex-1">
              <Link href={`/requirements/${item.id}`} className="text-sm hover:underline">
                {item.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {item.isDone ? (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                    {item.tookDays === null ? '완료' : `${item.tookDays}일 걸림`}
                  </span>
                ) : item.stalledDays >= stallDays ? (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">
                    {item.stalledDays}일 멈춤
                  </span>
                ) : item.isNew ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">신규</span>
                ) : null}
                <span className="text-slate-500">
                  {item.status} · {item.requester?.name ?? '요청자 없음'} 요청
                </span>
                {/* 승인 확인 내용. 회의에서 "그래서 뭘 확인했나"가 바로 보인다. */}
                {item.isDone && item.closure && (
                  <span className="truncate text-slate-400">· {item.closure.reason}</span>
                )}
              </div>
              {rowError[item.id] && (
                <p className="mt-1 text-xs text-red-600">{rowError[item.id]}</p>
              )}
            </div>
```

담당자·예상일 컨트롤은 완료 건에서 감춘다. 끝난 건의 담당자를 바꿀 일이 없고,
바꾸면 `PATCH .../assignee` 가 통과해 버려 완료된 건의 담당자가 조용히 달라진다.

```jsx
            {item.isDone ? (
              <span className="shrink-0 text-xs text-slate-400">
                {item.assignee?.name ?? '담당자 없음'}
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                {/* 지금 있는 셀렉트와 날짜 입력을 그대로 둔다 */}
              </div>
            )}
```

- [ ] **Step 5: 왼쪽 막대도 가른다**

지금은 담당자 유무로만 가른다. 완료 건은 초록이어야 한다.

```jsx
            className={`flex flex-wrap items-start gap-3 border-b border-l-2 border-slate-100 py-3 pl-3 ${
              item.isDone
                ? 'border-l-emerald-400'
                : item.assignee
                  ? 'border-l-slate-200'
                  : 'border-l-rose-400'
            }`}
```

- [ ] **Step 6: 빈 화면 문구를 가른다**

`이번 주 완료` 를 골랐는데 0건이면 "조건에 해당하는 건이 없습니다"는 나쁜
문구다. 그 주에 아무것도 못 끝냈다는 뜻이고, 회의가 알아야 할 사실이다.

```jsx
        {rows.length === 0 && (
          <li className="py-6 text-sm text-slate-500">
            {filter === 'done'
              ? '이번 주에 완료된 건이 없습니다.'
              : '이 조건에 해당하는 건이 없습니다.'}
          </li>
        )}
```

- [ ] **Step 7: 전체 검사**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: 전부 통과

- [ ] **Step 8: 손으로 확인한다**

개발 서버에서 `/meeting` 을 연다.

1. 요약 칩이 넷이고 마지막이 초록인가
2. `이번 주 완료` 를 누르면 완료 건만 나오는가
3. 완료 줄에 `8일 걸림` 과 승인 확인 내용이 붙는가
4. 완료 줄에 담당자 셀렉트·날짜 입력이 없는가
5. 기본 보기에 완료 건이 섞이지 않는가
6. `회의 마치기` 가 그대로 도는가

- [ ] **Step 9: 커밋**

```bash
git add components/MeetingBoard.jsx
git commit -m "feat: 회의 화면에 이번 주 완료"
```

---

## Task 3: 배포

**Files:** 없음

- [ ] **Step 1: 배포 ZIP**

```bash
npm run package:src
```

`package:src` 여야 한다. `npm run package` 는 빌드 완료본이라 플랫폼이 소스에서
다시 빌드하는 지금 방식에서는 실패한다.

- [ ] **Step 2: 배포**

마이그레이션은 없다. ZIP 만 올린다.

- [ ] **Step 3: 다음 회의 전에 확인한다**

다음 목요일 회의 전에 `이번 주 완료` 숫자가 수요일 안건 메일의
`이번 주 움직인 것` 과 어긋나지 않는지 본다. 둘의 기준이 다르므로 숫자는
다를 수 있다 — 메일은 **상태가 바뀐 것** 전부이고 화면은 **완료된 것**만이다.
다르다고 틀린 것이 아니지만, 회의에서 두 숫자를 나란히 보게 되므로 알고 있어야
한다.

---

## 자체 점검

**스펙 대응**

| 스펙 6절 | 태스크 |
|---|---|
| 조회 범위를 미종결 + 지난 7일 완료로 | 1 (Step 2) |
| 요약 칩 넷째(초록) | 2 (Step 3) |
| 보기 칩 넷째 | 2 (Step 1·2) |
| 완료 줄에 `8일 걸림` + 승인 확인 내용 | 1 (Step 4) · 2 (Step 4) |
| 담당자·예상일 감추기 | 2 (Step 4) |

**스펙에 없었으나 더한 것 셋**

- **왼쪽 막대를 초록으로**(Task 2 Step 5). 스펙은 요약 칩만 초록이라 했는데,
  줄 자체가 붉거나 노란 채로 남으면 완료 건이 문제처럼 보인다.
- **`unassigned` 에서 완료 건을 뺀다**(Task 1 Step 5). 완료 건이 목록에 들어오면서
  담당자 없이 끝난 건이 "담당 없음"으로 세어진다.
- **빈 화면 문구를 가른다**(Task 2 Step 6). "이번 주에 완료된 건이 없습니다"는
  조건이 안 맞는 것이 아니라 그 주의 사실이다.

**남는 위험**

`.or()` 안의 `and(...)` 는 PostgREST 고유 문법이라 오타가 빌드에서 안 잡힌다.
Task 1 Step 6 에서 실제 데이터로 확인한다. 실패하면 두 번 조회해 합치는 쪽으로
바꾼다 — 미종결 한 번, 지난 7일 완료 한 번. 그쪽이 읽기는 쉽지만 쿼리가 하나
늘고, 지금 규모에서는 어느 쪽이든 값싸다.
