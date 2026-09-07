import { isDone, isNotApplicable } from './launchTask';
import { matchesItem } from './launchSearch';

// 항목 사이의 연결.
//
// 세는 규칙(착수 가능·선행 대기)은 lib/launchTask.js 에 있다. 여기는
// "무엇이 무엇에 매달려 있는가"를 읽어내는 자리다 — 화면에 줄을 그리려면
// 코드 문자열을 항목으로 바꾸고, 위아래로 걸어야 한다.
//
// 실제 자료(호카 457건)의 모양:
//   · 선행이 있는 것 312건, 그리고 **전부 1개씩**이다. 2개짜리가 없다.
//   · 그래서 위로는 한 줄이고 아래로만 갈라진다. 그물이 아니라 나무다.
//   · 가장 긴 줄은 9단(14-01 → … → 14-13).
//   · 목록에 없는 코드를 가리키는 것이 4건 있다.
//
// 다만 열은 text[] 이라 2개짜리가 언제든 들어올 수 있다. 1개를 전제한
// 코드를 쓰지 않는다 — 대신 갈라지는 자리를 화면에 알린다(chainUp 의
// branched).

export function depCodes(task) {
  const deps = task?.depends_on;
  return Array.isArray(deps) ? deps.filter(Boolean) : [];
}

// code → task. 457건에서 선행을 찾을 때마다 find 를 돌면 O(n²) 이 된다.
export function byCode(tasks = []) {
  const map = new Map();
  for (const task of tasks ?? []) {
    // 같은 코드가 둘이면 먼저 온 것을 쓴다. 서버가 코드에 unique 를 걸어
    // 두었으니 실제로는 안 생기지만, 여기서 죽지는 않아야 한다.
    if (task?.code && !map.has(task.code)) map.set(task.code, task);
  }
  return map;
}

// 목록에 없는 선행 코드.
//
// 조용히 무시하면 안 된다 — isWaitingOnDep 이 없는 코드를 대기로 안 치는
// 것은 맞지만(런칭 유형에 따라 안 가져온 워크스트림이 있다), 그 사실이
// 화면 어디에도 안 나오면 오타로 끊긴 줄과 구별할 수 없다.
export function missingDeps({ task, tasks = [] } = {}) {
  const index = tasks instanceof Map ? tasks : byCode(tasks);
  return depCodes(task).filter((code) => !index.has(code));
}

// 이 항목의 선행들. 목록에 있는 것만 항목으로, 없는 것은 null 로.
export function prevTasks({ task, tasks = [] } = {}) {
  const index = tasks instanceof Map ? tasks : byCode(tasks);
  return depCodes(task).map((code) => ({ code, task: index.get(code) ?? null }));
}

// 이 항목을 기다리는 것들.
//
// 해당없음은 뺀다. 안 하기로 한 일이 "풀림"에 잡히면 그 숫자가 우선순위를
// 잘못 가리킨다 — 5건을 푼다고 나오는데 실제로는 3건인 식이다.
export function nextTasks({ task, tasks = [] } = {}) {
  const code = task?.code;
  if (!code) return [];
  return (tasks ?? [])
    .filter((t) => !isNotApplicable(t) && depCodes(t).includes(code))
    .sort(
      (a, b) =>
        (a.day_offset ?? 0) - (b.day_offset ?? 0) ||
        String(a.code ?? '').localeCompare(String(b.code ?? '')),
    );
}

// 이걸 끝내면 몇 건이 풀리나.
//
// 이미 끝난 후행은 안 센다 — 끝난 일을 풀어 줄 수는 없다.
export function unlockCount({ task, tasks = [] } = {}) {
  return nextTasks({ task, tasks }).filter((t) => !isDone(t)).length;
}

// 위로 거슬러 올라간 줄. 뿌리 → 바로 위 선행 순서로 준다.
//
// 선행이 둘 이상인 자리에서는 멈춘다. 한 줄로 그릴 수 없는 것을 한 줄로
// 그리면 나머지 선행이 화면에서 사라지고, 사라진 것을 사람이 알 방법이
// 없다. 대신 branched 로 알린다 — 화면은 "선행이 2건이라 여기서 멈춤"을
// 쓴다.
//
// 없는 코드에서도 멈춘다. 그 자리는 task: null 로 줄 맨 앞에 남는다 —
// 끊긴 것을 안 보여주면 왜 줄이 거기서 끝나는지 알 수 없다.
//
// max 는 고리(A→B→A)를 대비한 것이다. 서버가 막지 않으니 여기서 끝난다.
export function chainUp({ task, tasks = [], max = 30 } = {}) {
  const index = tasks instanceof Map ? tasks : byCode(tasks);
  const line = [];
  const seen = new Set([task?.code].filter(Boolean));
  let cursor = task;
  let branched = false;

  while (cursor && line.length < max) {
    const codes = depCodes(cursor);
    if (codes.length === 0) break;
    if (codes.length > 1) {
      branched = true;
      break;
    }
    const code = codes[0];
    if (seen.has(code)) break; // 고리
    seen.add(code);
    const found = index.get(code) ?? null;
    line.unshift({ code, task: found });
    if (!found) break; // 끊긴 자리에서 더 갈 곳이 없다
    cursor = found;
  }

  return { line, branched };
}

// 창 하나에 필요한 것을 한 번에.
//
// 화면이 함수를 넷 따로 부르면 tasks 를 넷 다 넘겨야 하고, 한 군데서
// 빠뜨리면 조용히 빈 목록이 된다.
export function linksOf({ task, tasks = [] } = {}) {
  const index = byCode(tasks);
  const next = nextTasks({ task, tasks });
  return {
    prev: prevTasks({ task, tasks: index }),
    missing: missingDeps({ task, tasks: index }),
    up: chainUp({ task, tasks: index }),
    next,
    unlock: next.filter((t) => !isDone(t)).length,
  };
}

// 기한이 선행·후행과 어긋나나.
//
// 막지 않고 알리기만 한다. 일부러 그렇게 두는 경우가 있다 — 실제로
// 01-05 를 D-95 에서 D-90 으로 미루면서 후행 01-06(D-95)보다 늦어진
// 것이 그런 경우일 수 있고, 그 판단은 담당자 몫이다.
//
// 생기는 자리에서 알리는 것이 요점이다. 저장한 뒤에는 아무도 안 본다 —
// 이 흠 19건이 그렇게 쌓였고, 찾아내는 데 쿼리 한 판이 필요했다.
//
// 해당없음은 양쪽 다 뺀다. 안 할 일과의 앞뒤는 따질 것이 없다.
export function scheduleConflicts({ code, dayOffset, dependsOn = [], tasks = [] } = {}) {
  if (!Number.isFinite(dayOffset)) return { lateDeps: [], earlyFollowers: [] };
  const index = byCode(tasks);

  const lateDeps = (dependsOn ?? [])
    .map((c) => index.get(c))
    .filter((p) => p && !isNotApplicable(p) && p.day_offset > dayOffset);

  // 후행은 코드가 있어야 찾는다 — 만들기 중인 항목은 아직 아무도 안 기다린다.
  const earlyFollowers = !code
    ? []
    : (tasks ?? []).filter(
        (t) =>
          t.code !== code &&
          !isNotApplicable(t) &&
          depCodes(t).includes(code) &&
          t.day_offset < dayOffset,
      );

  return { lateDeps, earlyFollowers };
}

// 이 항목을 (건너건너라도) 기다리는 것 전부.
//
// 선행 후보에서 빼려고 있다. A 의 선행으로 B 를 걸었는데 B 가 이미 A 를
// 기다리고 있으면 고리가 된다 — 그러면 둘 다 영영 '착수 가능'이 안 된다.
// 자기 자신도 여기 든다(07-33 이 실제로 자기를 기다리고 있었다).
export function descendants({ code, tasks = [] } = {}) {
  const out = new Set();
  if (!code) return out;
  out.add(code);
  // 코드 → 그 코드를 기다리는 것들. 한 번만 만든다.
  const followersOf = new Map();
  for (const t of tasks ?? []) {
    for (const d of depCodes(t)) {
      if (!followersOf.has(d)) followersOf.set(d, []);
      followersOf.get(d).push(t.code);
    }
  }
  const queue = [code];
  while (queue.length > 0) {
    for (const next of followersOf.get(queue.shift()) ?? []) {
      if (next && !out.has(next)) {
        out.add(next);
        queue.push(next);
      }
    }
  }
  return out;
}

// 선행으로 고를 수 있는 후보.
//
// 501건에서 코드를 외워 치는 것은 애초에 무리다 — 실제로 자기 참조 1건,
// 없는 코드 4건, 방향이 거꾸로 걸린 것 7건이 그렇게 쌓였다. 셋 다 여기서
// 미리 걸러 낸다:
//
//   · 자기 자신과, 이 항목을 (건너건너라도) 기다리는 것  → 고리
//   · 이미 고른 것                                    → 중복
//   · 해당없음                                        → 안 할 일 기다리기
//   · 목록에 없는 코드                                 → 애초에 못 고름
//
// 찾는 규칙은 lib/launchSearch.js 하나다. 보드·가이드와 같은 함수라
// 코드를 아는 사람이 '01-05' 라고 쳐도 그대로 찾힌다 — 손으로 치던
// 방식을 잃지 않는다.
//
// limit 은 화면에 보일 만큼만. total 을 같이 주어 "외 N건"을 쓸 수 있게 한다.
export function depCandidates({ code, tasks = [], chosen = [], query = '', limit = 8 } = {}) {
  const blocked = descendants({ code, tasks });
  const picked = new Set(chosen ?? []);
  const hits = (tasks ?? [])
    .filter(
      (t) =>
        t?.code &&
        !blocked.has(t.code) &&
        !picked.has(t.code) &&
        !isNotApplicable(t) &&
        matchesItem(t, query),
    )
    .sort(
      (a, b) =>
        (a.day_offset ?? 0) - (b.day_offset ?? 0) ||
        String(a.code).localeCompare(String(b.code)),
    );
  return { hits: hits.slice(0, limit), total: hits.length };
}
