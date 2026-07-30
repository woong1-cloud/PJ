import { isOverdue } from './overdue';

// 로드맵의 자리 계산.
//
// 날짜는 전부 'YYYY-MM-DD' 문자열로 다루고, Date 객체는 이 파일 안에서만
// UTC 로 만들어 쓴다. 지역 시간으로 파싱하면 KST 에서 자정 근처에 하루가
// 밀려 막대가 통째로 옆으로 이동한다 — 화면은 아무 불평 없이 예쁘게 그려지므로
// 이런 오차는 눈으로 못 잡는다.
const MS_PER_DAY = 86400000;
// 가로축 최소 길이. 2주짜리 프로젝트 하나만 있으면 창이 한 달이 되고,
// 막대가 화면을 꽉 채워서 '기간'으로 안 보인다.
const MIN_WINDOW_MONTHS = 3;

function toUtc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// 끝일을 포함한 일수. 7/1~7/1 은 0 일이 아니라 1 일이다 —
// 이걸 틀리면 하루짜리 일정이 화면에서 사라진다.
function inclusiveDays(startIso, endIso) {
  return (toUtc(endIso) - toUtc(startIso)) / MS_PER_DAY + 1;
}

function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function monthEnd(iso) {
  const [y, m] = iso.split('-').map(Number);
  // 다음 달 0 일 = 이번 달 마지막 날. 말일이 28/29/30/31 중 무엇인지
  // 직접 따지지 않아도 된다.
  return fromUtc(Date.UTC(y, m, 0));
}

function addMonths(iso, n) {
  const [y, m] = iso.split('-').map(Number);
  return fromUtc(Date.UTC(y, m - 1 + n, 1));
}

// 프로젝트의 날짜 두 칸에서 그릴 수 있는 것을 뽑는다.
//
// 한쪽만 채워진 경우가 실무에서 가장 흔하다 — 목표일만 먼저 잡히고 착수일은
// 나중에 정해진다. 이때 막대를 '오늘부터 목표일까지'로 늘리면, 아무도 정하지
// 않은 착수일을 시스템이 정해 준 것처럼 보인다. 점 하나로만 찍는다.
export function projectSpan(project) {
  const start = project?.start_date ?? null;
  const target = project?.target_date ?? null;
  if (start && target) {
    // DB CHECK 로 막았지만 기존 데이터나 API 직접 호출로 뒤집힌 값이 들어올 수
    // 있다. 폭이 음수가 되면 CSS 가 조용히 0 으로 만들어 막대가 사라진다.
    const [a, b] = start <= target ? [start, target] : [target, start];
    return { kind: 'range', start: a, end: b };
  }
  const only = start ?? target;
  if (!only) return null;
  return { kind: 'milestone', start: only, end: only };
}

// 가로축 범위. 주어진 날짜 전부와 오늘을 담고, 월 경계로 맞춘다.
//
// 오늘을 반드시 포함하는 이유: 오늘이 안 보이는 로드맵은 "지금 어디쯤인지"를
// 답하지 못한다. 그게 로드맵을 여는 첫 번째 이유다.
export function roadmapWindow(dates, todayIso) {
  const all = [todayIso, ...(dates ?? []).filter(Boolean)];
  let min = all[0];
  let max = all[0];
  for (const d of all) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const start = monthStart(min);
  let end = monthEnd(max);
  // 월 수가 부족하면 뒤로 넓힌다. 앞으로 넓히면 이미 지난 달이 늘어나
  // 쓸모없는 여백만 생긴다.
  while (monthCount(start, end) < MIN_WINDOW_MONTHS) {
    end = monthEnd(addMonths(end, 1));
  }
  return { start, end };
}

function monthCount(startIso, endIso) {
  const [sy, sm] = startIso.split('-').map(Number);
  const [ey, em] = endIso.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

// 월 구분선. 각 월이 창에서 차지하는 몫은 일수에 비례한다 — 2월과 7월을
// 같은 폭으로 그리면 막대와 축이 최대 사흘까지 어긋난다.
export function monthTicks(win) {
  const total = inclusiveDays(win.start, win.end);
  const ticks = [];
  let cursor = win.start;
  while (cursor <= win.end) {
    const end = monthEnd(cursor);
    const [y, m] = cursor.split('-').map(Number);
    ticks.push({
      key: cursor.slice(0, 7),
      // 연도는 1월과 첫 눈금에만. 전부 붙이면 축이 글자로 꽉 차고,
      // 아무 데도 안 붙이면 12월 다음 1월이 같은 해처럼 읽힌다.
      label: m === 1 || ticks.length === 0 ? `${y}년 ${m}월` : `${m}월`,
      leftPct: ((toUtc(cursor) - toUtc(win.start)) / MS_PER_DAY / total) * 100,
      widthPct: (inclusiveDays(cursor, end < win.end ? end : win.end) / total) * 100,
    });
    cursor = addMonths(cursor, 1);
  }
  return ticks;
}

// 창 안에서 어느 날짜가 몇 %인지. 창 밖이면 null.
export function datePct(iso, win) {
  if (!iso || iso < win.start || iso > win.end) return null;
  const total = inclusiveDays(win.start, win.end);
  return ((toUtc(iso) - toUtc(win.start)) / MS_PER_DAY / total) * 100;
}

// 막대의 왼쪽과 폭. 창을 벗어나면 잘라내되 잘렸다는 사실은 남긴다 —
// 그냥 자르면 8월에 끝나는 일처럼 보인다.
export function spanGeometry(span, win) {
  if (!span) return null;
  if (span.end < win.start || span.start > win.end) return null;
  const total = inclusiveDays(win.start, win.end);
  const clippedStart = span.start < win.start;
  const clippedEnd = span.end > win.end;
  const from = clippedStart ? win.start : span.start;
  const to = clippedEnd ? win.end : span.end;
  return {
    leftPct: ((toUtc(from) - toUtc(win.start)) / MS_PER_DAY / total) * 100,
    widthPct: (inclusiveDays(from, to) / total) * 100,
    clippedStart,
    clippedEnd,
  };
}

// 화면이 그대로 받아 그릴 수 있는 형태로 만든다.
//
// 날짜 없는 프로젝트를 그냥 빼지 않고 undated 로 따로 돌려주는 것이 중요하다.
// 조용히 빠지면 "내 프로젝트가 왜 로드맵에 없지"가 되고, 그 답이 화면에
// 없으면 아무도 날짜를 채워 넣지 않는다.
export function buildRoadmap({ projects, requirements, todayIso }) {
  const list = projects ?? [];
  const reqs = requirements ?? [];

  const withSpan = [];
  const undated = [];
  for (const project of list) {
    const span = projectSpan(project);
    if (span) withSpan.push({ project, span });
    else undated.push(project);
  }

  const dates = [];
  for (const { span } of withSpan) dates.push(span.start, span.end);
  const chartedIds = new Set(withSpan.map(({ project }) => project.id));
  for (const r of reqs) {
    if (r.expected_release_date && chartedIds.has(r.project_id)) {
      dates.push(r.expected_release_date);
    }
  }

  const win = roadmapWindow(dates, todayIso);

  const rows = withSpan.map(({ project, span }) => ({
    ...project,
    kind: span.kind,
    span,
    geometry: spanGeometry(span, win),
    markers: reqs
      .filter((r) => r.project_id === project.id && r.expected_release_date)
      .sort((a, b) => a.expected_release_date.localeCompare(b.expected_release_date))
      .map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        date: r.expected_release_date,
        pct: datePct(r.expected_release_date, win),
        // 목록 화면과 같은 함수로 판정한다. 두 화면이 다른 규칙으로 빨간색을
        // 칠하면 어느 쪽을 믿어야 하는지 알 수 없다.
        overdue: isOverdue(r.expected_release_date, r.status, todayIso),
      }))
      .filter((m) => m.pct !== null),
  }));

  return { window: win, rows, undated, todayPct: datePct(todayIso, win), ticks: monthTicks(win) };
}
