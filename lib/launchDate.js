// 런칭의 날짜 셈.
//
// 기한을 저장하지 않는 것이 이 파일이 있는 이유다. 항목은 오픈일 기준 상대일
// (D-120)만 갖고, 실제 날짜는 여기서 계산한다.
//
// 왜 저장하지 않나: 오픈일이 한 번 밀리면 403건의 기한을 다시 써야 하고,
// 하나라도 빠지면 그때부터 화면이 거짓말을 한다. 시트의 00_사용법 이
// "여기만 바꾸면 전 시트 기한이 바뀐다"고 약속하는 것과 같은 규칙이다.
//
// UTC 로만 센다. 시간대를 태우면 하루가 어긋나는데, 403건에서 그 하루가
// 여기저기 다르게 나타나면 원인을 못 찾는다.

const MS_PER_DAY = 86400000;

// 'YYYY-MM-DD' → UTC 자정. 형식이 틀리거나 없는 날짜면 null.
function parse(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 2026-02-30 같은 값은 3월로 넘어간다. 넘어갔다는 것은 그런 날이 없다는 뜻이다.
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function fmt(dt) {
  return dt.toISOString().slice(0, 10);
}

// 오픈일 + 상대일 → 기한. 'YYYY-MM-DD' 또는 null.
export function dueDate(openDate, dayOffset) {
  const open = parse(openDate);
  if (!open || !Number.isFinite(dayOffset)) return null;
  return fmt(new Date(open.getTime() + dayOffset * MS_PER_DAY));
}

// dueDate 의 반대. 기한 → 오픈일 기준 상대일.
//
// 사람은 'D-90'으로 생각하지 않고 '11월 3일까지'로 생각한다. 그래서 항목
// 창에서 달력으로 날짜를 찍게 하고, 저장은 여전히 상대일로 한다.
//
// 날짜를 저장하지 않는 이유는 이 파일 맨 위와 같다 — 오픈일이 하루 밀리면
// 487건이 통째로 따라 움직여야 하는데, 날짜를 저장하면 그때 화면이
// 거짓말을 시작한다.
//
// dueDate 와 왕복이 되어야 한다: offsetFromDate(open, dueDate(open, n)) === n.
export function offsetFromDate(openDate, dateStr) {
  const open = parse(openDate);
  const to = parse(dateStr);
  if (!open || !to) return null;
  return Math.round((to.getTime() - open.getTime()) / MS_PER_DAY);
}

// 오늘부터 그날까지 며칠. 지났으면 음수.
export function dDay(dateStr, today) {
  const to = parse(dateStr);
  const from = parse(today);
  if (!to || !from) return null;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// 사람이 읽는 표기.
//
// 0 은 'D-DAY' 다. 'D-0' 이라고 쓰면 아직 하루 남은 것처럼 읽힌다.
export function dDayLabel(days) {
  if (!Number.isFinite(days)) return null;
  if (days === 0) return 'D-DAY';
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

// 런칭 전체의 D-N. 화면 머리에 붙는 것.
export function launchDDay(openDate, today) {
  return dDayLabel(dDay(openDate, today));
}
