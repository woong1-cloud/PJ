import { dDay, dueDate } from './launchDate';

// 런칭 항목의 판정.
//
// 상태가 넷인 것이 요점이다. 요구사항의 열 개를 쓰면 흐름이 안 맞고, 열 개를
// 고르게 하면 아무도 안 바꾼다.
export const LAUNCH_STATUSES = ['할 것', '하는 중', '완료', '막힘'];

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

// 기한이 지났나.
//
// 완료는 지남이 아니다. 끝난 일에 붉은 표시를 다는 것이 가장 나쁜 오답이고,
// 403건에서 그게 쌓이면 화면이 통째로 붉어진다.
//
// 기한 당일은 아직 안 지났다. 오늘까지가 기한이다.
export function isLate({ task, openDate, today } = {}) {
  if (!task || isDone(task)) return false;
  const days = dDay(dueDate(openDate, task.day_offset), today);
  return Number.isFinite(days) && days < 0;
}

// 이번 주에 마감인가. 오늘부터 7일 안(오늘 포함).
export function isThisWeek({ task, openDate, today } = {}) {
  if (!task || isDone(task)) return false;
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
  if (isDone(task)) return false;
  return deps.some((code) => {
    const dep = (tasks ?? []).find((t) => t.code === code);
    return dep ? !isDone(dep) : false;
  });
}

// 화면 색 하나로. 순서가 곧 우선순위다.
export function taskTone({ task, openDate, today, tasks } = {}) {
  if (!task) return 'flat';
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
  const list = tasks ?? [];
  const total = list.length;
  const done = list.filter(isDone).length;
  return {
    total,
    done,
    late: list.filter((task) => isLate({ task, openDate, today })).length,
    blocked: list.filter(isBlocked).length,
    thisWeek: list.filter((task) => isThisWeek({ task, openDate, today })).length,
    // 0건짜리 묶음에서 NaN 이 나오면 화면에 그대로 찍힌다.
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
