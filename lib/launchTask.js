import { dDay, dueDate } from './launchDate';

export const NA_STATUS = '해당없음';

// 상태 다섯. 화면의 단추는 넷이고 해당없음은 ⋯ 메뉴에 있다 —
// 451줄에 다섯째 단추를 붙이면 줄이 넘치고, 자주 누르는 것도 아니다.
export const LAUNCH_STATUSES = ['할 것', '하는 중', '완료', '막힘', NA_STATUS];
export const BOARD_STATUSES = ['할 것', '하는 중', '완료', '막힘'];

export const TODO_STATUS = '할 것';
export const DOING_STATUS = '하는 중';
export const DONE_STATUS = '완료';
// 주간 진척 회의에서 볼 것이 정확히 이것이다. 나머지 셋은 숫자로 보면 된다.
export const BLOCKED_STATUS = '막힘';

// '이번 주'의 길이. 회의가 주 1회라 그 간격이다.
export const WEEK_DAYS = 7;

export function isDone(task) {
  return task?.status === DONE_STATUS;
}

export function isBlocked(task) {
  return task?.status === BLOCKED_STATUS;
}

// 이 브랜드에는 안 하는 일.
//
// 완료와 다르다. 하나는 끝난 것이고 하나는 애초에 할 일이 아니다.
// 그래서 지남·이번 주·선행 대기·분모 어디에도 안 든다.
export function isNotApplicable(task) {
  return task?.status === NA_STATUS;
}

// 기한이 지났나.
//
// 완료는 지남이 아니다. 끝난 일에 붉은 표시를 다는 것이 가장 나쁜 오답이고,
// 403건에서 그게 쌓이면 화면이 통째로 붉어진다.
//
// 기한 당일은 아직 안 지났다. 오늘까지가 기한이다.
export function isLate({ task, openDate, today } = {}) {
  if (!task || isDone(task) || isNotApplicable(task)) return false;
  const days = dDay(dueDate(openDate, task.day_offset), today);
  return Number.isFinite(days) && days < 0;
}

// 이번 주에 마감인가. 오늘부터 7일 안(오늘 포함).
export function isThisWeek({ task, openDate, today } = {}) {
  if (!task || isDone(task) || isNotApplicable(task)) return false;
  const days = dDay(dueDate(openDate, task.day_offset), today);
  return Number.isFinite(days) && days >= 0 && days <= WEEK_DAYS;
}

// 선행이 안 끝나 기다리는 중인가.
//
// 목록에 없는 선행 코드는 대기로 치지 않는다. 런칭 유형에 따라 안 가져온
// 워크스트림이 있어서(기존 법인이면 01·02 가 통째로 빠진다), 없는 것을
// 기다린다고 하면 그 건들이 영영 대기로 남는다.
export function isWaitingOnDep({ task, tasks = [] } = {}) {
  const deps = task?.depends_on ?? [];
  if (!Array.isArray(deps) || deps.length === 0) return false;
  if (isDone(task) || isNotApplicable(task)) return false;
  return deps.some((code) => {
    const dep = (tasks ?? []).find((t) => t.code === code);
    return dep ? !isDone(dep) : false;
  });
}

// 지금 손댈 수 있는가.
//
// '막힘'의 반대말 자리다. 선행이 다 끝났고 아직 시작 안 한 것 —
// 회의에서 "지금 뭐부터 하죠"에 답하는 유일한 목록이다.
//
// '하는 중'은 뺀다. 이미 붙어 있는 일은 착수 여부를 물을 필요가 없고,
// 넣으면 이 보기가 그냥 '안 끝난 것' 목록이 되어 쓸모가 사라진다.
// '막힘'도 뺀다 — 선행은 끝났어도 사람이 풀어야 할 것이 따로 있다.
export function isReady({ task, tasks = [] } = {}) {
  if (task?.status !== TODO_STATUS) return false;
  return !isWaitingOnDep({ task, tasks });
}

// 착수 가능이 몇 건인가.
//
// progress() 에 넣지 않는다. 그 함수는 그룹별로도 불리는데(워크스트림
// 하나의 진척), 선행은 그룹 밖에 있다 — 그룹만 넘기면 선행 코드를 못
// 찾아 전부 '없는 선행'으로 치고 착수 가능이 부풀려진다. 이 셈은 런칭
// 전체 목록에서만 뜻이 있으므로 함수를 따로 둔다.
export function readyCount(tasks = []) {
  const list = tasks ?? [];
  return list.filter((task) => isReady({ task, tasks: list })).length;
}

// 화면 색 하나로. 순서가 곧 우선순위다.
export function taskTone({ task, openDate, today, tasks } = {}) {
  if (!task) return 'flat';
  if (isNotApplicable(task)) return 'na';
  if (isDone(task)) return 'done';
  // 막힘이 지남을 이긴다. 기한이 지난 것은 시간이 해결할 수도 있지만,
  // 막힌 것은 사람이 풀어야 한다.
  if (isBlocked(task)) return 'blocked';
  if (isLate({ task, openDate, today })) return 'late';
  if (isThisWeek({ task, openDate, today })) return 'soon';
  if (isWaitingOnDep({ task, tasks })) return 'waiting';
  return 'flat';
}

// 워크스트림·역할 등으로 묶어 진척을 센다.
//
// 완료율만 주지 않는다. 지남과 막힘이 함께 보여야 "80퍼센트인데 왜 불안한가"에
// 답할 수 있다.
export function progress({ tasks = [], openDate, today } = {}) {
  const all = tasks ?? [];
  // 해당없음은 분모에서 뺀다. 476건 중 25건이 해당없음이면 분모는 451이다 —
  // 안 빼면 아무리 해도 95%가 천장이 되고, 그때 진척률이 아무 말도 안 한다.
  const list = all.filter((task) => !isNotApplicable(task));
  const total = list.length;
  const done = list.filter(isDone).length;
  return {
    total,
    done,
    late: list.filter((task) => isLate({ task, openDate, today })).length,
    blocked: list.filter(isBlocked).length,
    thisWeek: list.filter((task) => isThisWeek({ task, openDate, today })).length,
    doneThisWeek: list.filter((task) => isDoneThisWeek({ task, today })).length,
    // 화면이 "451 (+해당없음 25)"를 보여줄 수 있어야 한다. 분모만 줄이고
    // 뺀 개수를 안 주면 "전체가 몇 건이냐"에 답할 수 없다.
    notApplicable: all.length - total,
    // 0건짜리 묶음에서 NaN 이 나오면 화면에 그대로 찍힌다.
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// 이번 주에 끝난 것. 주간 진척의 마지막 칸이다 — 칭찬 자리가 아니라
// 확인 자리다. 완료로 옮겼는데 실제로는 안 끝난 것이 여기서 걸린다.
export function isDoneThisWeek({ task, today } = {}) {
  if (!isDone(task) || !task?.done_at) return false;
  const at = String(task.done_at).slice(0, 10);
  const days = dDay(at, today);
  return Number.isFinite(days) && days <= 0 && days >= -WEEK_DAYS;
}
