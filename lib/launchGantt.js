import { dueDate } from './launchDate';
import { isDone, isLate, isBlocked, isNotApplicable } from './launchTask';

// 워크스트림별 막대. 463줄을 한 줄씩 그리면 아무도 못 읽는다 —
// 원본 시트의 02_간트 도 과업 90줄로 묶었고, 우리는 그 층이 없으니
// 워크스트림이 그 자리다.
//
// 세는 규칙(done·late·blocked)은 새로 만들지 않는다. lib/launchTask.js 를
// 그대로 쓴다 — 여기서 다시 판정하면 보드와 숫자가 갈린다.

const MS_PER_DAY = 86400000;

// 'YYYY-MM-DD' → UTC 자정. launchDate.js 의 parse 와 같은 규칙(UTC 로만
// 센다)이지만 그쪽은 내보내지 않아서 여기서 다시 둔다 — monthTicks 가
// 날짜에서 거꾸로 상대일을 구해야 해서(offsetOf), dueDate 하나로는 안 된다.
function parseDate(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

// dueDate 의 반대 방향: 날짜 → 오픈일 기준 상대일. monthTicks 에서 달의
// 1일이 상대일 몇 째인지 알아야 % 위치를 잡을 수 있어 여기서만 쓴다.
function offsetOf(openDate, dateStr) {
  const open = parseDate(openDate);
  const dt = parseDate(dateStr);
  if (!open || !dt) return null;
  return Math.round((dt.getTime() - open.getTime()) / MS_PER_DAY);
}

// tasks → [{ workstream, minOffset, maxOffset, from, to, total, done,
//            notApplicable, late, blocked, percent }]
export function ganttRows({ tasks, openDate, today } = {}) {
  const list = tasks ?? [];
  const map = new Map();
  for (const task of list) {
    const key = task?.workstream ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }
  return [...map.entries()]
    // 이름순. launchGroup.js 의 groupByWorkstream 과 같은 규칙 —
    // 워크스트림에는 sort_order 가 없고, 코드가 D01·D02··· 순으로 이미
    // 이름에 박혀 있어서 이름순이 곧 원본 시트 순서다.
    .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    .map(([workstream, tasksInGroup]) => buildRow(workstream, tasksInGroup, openDate, today));
}

function buildRow(workstream, tasksInGroup, openDate, today) {
  const notApplicable = tasksInGroup.filter(isNotApplicable).length;
  // 해당없음은 기간 계산에서 뺀다 — 안 하는 일이 막대를 늘리면 안 된다.
  const applicable = tasksInGroup.filter((t) => !isNotApplicable(t));
  const total = applicable.length;
  const done = applicable.filter(isDone).length;
  const late = applicable.filter((t) => isLate({ task: t, openDate, today })).length;
  const blocked = applicable.filter(isBlocked).length;

  let minOffset = null;
  let maxOffset = null;
  for (const t of applicable) {
    const offset = t?.day_offset;
    if (!Number.isFinite(offset)) continue;
    if (minOffset === null || offset < minOffset) minOffset = offset;
    if (maxOffset === null || offset > maxOffset) maxOffset = offset;
  }

  return {
    workstream,
    minOffset,
    maxOffset,
    from: minOffset === null ? null : dueDate(openDate, minOffset),
    to: maxOffset === null ? null : dueDate(openDate, maxOffset),
    total,
    done,
    notApplicable,
    late,
    blocked,
    // total 이 0(전부 해당없음)이면 화면이 막대를 안 그리게 total 로 판단
    // 시키고, 퍼센트는 0으로 둔다 — 0/0 이 NaN 으로 찍히면 안 된다.
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// 막대를 놓을 자리. 전체 기간을 0~100 으로 본다.
//
// total 이 0인 행(전부 해당없음)은 막대가 없으니 자리 계산에서 뺀다 —
// 안 그릴 막대 때문에 그리는 막대들이 좁아지면 안 된다.
export function ganttScale(rows) {
  const list = (rows ?? []).filter(
    (r) => r && r.total > 0 && Number.isFinite(r.minOffset) && Number.isFinite(r.maxOffset),
  );
  if (list.length === 0) {
    // 그릴 막대가 하나도 없어도(빈 런칭) 눈금 축은 있어야 화면이 안 죽는다.
    return { minOffset: -5, maxOffset: 5 };
  }
  const minOffset = Math.min(...list.map((r) => r.minOffset));
  const maxOffset = Math.max(...list.map((r) => r.maxOffset));
  // 양 끝 막대가 화면 가장자리에 딱 붙으면 안 보인다 — 앞뒤로 5일씩 여유.
  return { minOffset: minOffset - 5, maxOffset: maxOffset + 5 };
}

export function offsetPercent(offset, scale) {
  if (!scale || !Number.isFinite(offset)) return 0;
  const { minOffset, maxOffset } = scale;
  if (!Number.isFinite(minOffset) || !Number.isFinite(maxOffset)) return 0;
  // 폭이 0(막대가 하루뿐)이면 나눗셈이 NaN 이 된다 — 가운데로 둔다.
  if (maxOffset === minOffset) return 50;
  const pct = ((offset - minOffset) / (maxOffset - minOffset)) * 100;
  return Math.min(100, Math.max(0, pct));
}

// 세로선 · 눈금. 구간에 걸치는 달의 1일 위치만 찍는다 — 주 단위 눈금은
// 19줄짜리 화면에 촘촘해서 오히려 못 읽는다.
export function monthTicks(scale, openDate) {
  const fromStr = scale ? dueDate(openDate, scale.minOffset) : null;
  const toStr = scale ? dueDate(openDate, scale.maxOffset) : null;
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  const open = parseDate(openDate);
  if (!from || !to || !open) return [];

  const openYear = open.getUTCFullYear();
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  // 구간 시작일이 1일이 아니면 그 달의 1일은 화면 왼쪽 밖이다 — 다음 달부터.
  if (from.getUTCDate() > 1) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  const ticks = [];
  while (y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m <= to.getUTCMonth())) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const offset = offsetOf(openDate, dateStr);
    if (offset !== null) {
      // 해가 바뀌면 연도를 붙인다 — '10월'만 있으면 올해인지 내년인지
      // 안 보인다. 오픈일과 같은 해면 굳이 안 붙인다.
      const label = y === openYear ? `${m + 1}월` : `${String(y).slice(2)}년 ${m + 1}월`;
      ticks.push({ label, percent: offsetPercent(offset, scale) });
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return ticks;
}
