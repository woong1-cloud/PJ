import { dueDate, dDay } from './launchDate';

// 런칭 보드를 묶는 기준.
//
// 지금까지는 워크스트림 하나뿐이었다. "담당자별로, 시간별로 내가 할 일을
// 보고 싶다"는 말은 워크스트림을 넘나들며 "다음에 뭐 하지"를 보고 싶다는
// 뜻이라, 묶는 축 자체를 고를 수 있어야 한다.
//
// 세는 규칙(late·thisWeek 등)은 여전히 lib/launchTask.js 하나다. 여기서는
// 이미 걸러진 목록을 어떤 순서로 늘어놓을지만 정한다 — 필터와 정렬을
// 섞으면 "이 항목이 왜 안 보이지"와 "이 항목이 왜 여기 있지"가 같은
// 자리에서 헷갈린다.
export const GROUP_MODES = [
  { key: 'workstream', label: '워크스트림' },
  { key: 'assignee', label: '담당자' },
  { key: 'week', label: '기한(주)' },
  { key: 'none', label: '안 묶음' },
];

const NO_ASSIGNEE = '담당자 없음';
const LATE_KEY = '__late__';
const LATE_LABEL = '지남';
const NO_DATE_KEY = '__nodate__';
const NO_DATE_LABEL = '기한 없음';

const MS_PER_DAY = 86400000;

function byDayOffset(a, b) {
  return (a.day_offset ?? 0) - (b.day_offset ?? 0);
}

function toGroup(key, label, tasksInGroup) {
  // 그룹 안은 늘 기한(day_offset)순 — 워크스트림의 sort_order 는 시트의
  // 줄 순서일 뿐이고, 회의에서 궁금한 건 언제까지인가다. (LaunchBoard 의
  // 기존 워크스트림 묶기와 같은 규칙이다.)
  const sorted = [...tasksInGroup].sort(byDayOffset);
  return { key, label, count: sorted.length, tasks: sorted };
}

// tasks → [{ key, label, count, tasks }]
export function groupTasks({ tasks, mode, openDate, today } = {}) {
  const list = tasks ?? [];
  // 빈 입력은 빈 화면이다. 그룹 하나를 0건으로 만들어 돌려주면 '안 묶음'
  // 모드에서 빈 제목의 접기 상자가 뜬다 — 아무 그룹도 없는 게 맞다.
  if (list.length === 0) return [];

  if (mode === 'assignee') return groupByAssignee(list);
  if (mode === 'week') return groupByWeek(list, openDate, today);
  if (mode === 'none') return [toGroup('all', '전체', list)];
  return groupByWorkstream(list);
}

function groupByWorkstream(list) {
  const map = new Map();
  for (const task of list) {
    const key = task.workstream ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    .map(([key, tasksInGroup]) => toGroup(key, key, tasksInGroup));
}

function groupByAssignee(list) {
  const map = new Map();
  for (const task of list) {
    const name = String(task.assignee_name ?? '').trim();
    const key = name || NO_ASSIGNEE;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }
  return [...map.entries()]
    .sort((a, b) => {
      // 담당자 없음은 늘 맨 뒤 — 방금 생긴 항목이라 대부분 비어 있다.
      // 이름순 맨 앞에 섞이면 "이 사람이 뭘 할지" 보다 "빈 자리"가 먼저
      // 보인다.
      if (a[0] === NO_ASSIGNEE) return 1;
      if (b[0] === NO_ASSIGNEE) return -1;
      return a[0].localeCompare(b[0], 'ko');
    })
    .map(([key, tasksInGroup]) => toGroup(key, key, tasksInGroup));
}

// 'YYYY-MM-DD' → UTC 자정. launchDate.js 와 같은 이유로 UTC 로만 센다 —
// 시간대를 태우면 월요일 경계가 403건에서 하루씩 어긋난다.
function parseUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtUTC(dt) {
  return dt.toISOString().slice(0, 10);
}

function fmtShort(dt) {
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

// 기한이 속한 주의 월요일(ISO). 일요일(getUTCDay()===0)은 6일 전이 월요일.
function mondayOf(dateStr) {
  const dt = parseUTC(dateStr);
  const dow = dt.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return fmtUTC(new Date(dt.getTime() - back * MS_PER_DAY));
}

// '9월 2주 (9/7~9/13)' 같은 표기.
//
// 그 주가 어느 달 소속인지는 월요일이 아니라 일요일(주가 끝나는 날) 기준
// 이다 — 월요일 기준이면 월말에 걸친 주가 늘 앞 달 것으로 붙어, 회의에서
// "이번 달 몇 주째"라는 감각과 어긋난다. 몇 째 주인지는 그 일요일이 달의
// 며칠인지를 7로 나눠 올림한다(1~7일 → 1주, 8~14일 → 2주 …).
function weekLabel(monday) {
  const mon = parseUTC(monday);
  const sun = new Date(mon.getTime() + 6 * MS_PER_DAY);
  const month = sun.getUTCMonth() + 1;
  const weekNum = Math.ceil(sun.getUTCDate() / 7);
  return `${month}월 ${weekNum}주 (${fmtShort(mon)}~${fmtShort(sun)})`;
}

// 그룹 정렬 순서 — 지남(0) → 주차(1, 월요일 오름차순) → 기한 없음(2).
// 문자열(월요일 ISO)과 무한대를 한 번에 비교할 수 없어 (등급, 보조키)
// 튜플로 나눈다.
function weekOrderKey(key) {
  if (key === LATE_KEY) return [0, ''];
  if (key === NO_DATE_KEY) return [2, ''];
  return [1, key];
}

// 'week' 묶기.
//
// 기한은 여기서 새로 계산하지 않는다 — lib/launchDate.js 의 dueDate 하나로만
// 잰다(두 군데서 계산하면 하루가 어긋났을 때 원인을 못 찾는다, 그 파일의
// 주석과 같은 이유). openDate 가 없거나 day_offset 을 못 읽으면 dueDate 가
// null 을 주는데, 그런 항목은 주를 못 정하니 '기한 없음' 한 묶음으로 보낸다
// — 죽거나 사라지면 안 된다.
function groupByWeek(list, openDate, today) {
  const map = new Map();
  const labels = new Map();

  for (const task of list) {
    const due = dueDate(openDate, task.day_offset);
    if (!due) {
      addTo(map, NO_DATE_KEY, task);
      labels.set(NO_DATE_KEY, NO_DATE_LABEL);
      continue;
    }
    const days = dDay(due, today);
    // 기한이 오늘보다 이르면(음수) 전부 '지남' 한 묶음 — 어느 주였는지는
    // 여기서는 중요하지 않다, 지금 당장 봐야 한다는 사실만 중요하다.
    if (days !== null && days < 0) {
      addTo(map, LATE_KEY, task);
      labels.set(LATE_KEY, LATE_LABEL);
      continue;
    }
    const monday = mondayOf(due);
    addTo(map, monday, task);
    if (!labels.has(monday)) labels.set(monday, weekLabel(monday));
  }

  return [...map.entries()]
    .sort((a, b) => {
      const [ta, ka] = weekOrderKey(a[0]);
      const [tb, kb] = weekOrderKey(b[0]);
      if (ta !== tb) return ta - tb;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
    .map(([key, tasksInGroup]) => toGroup(key, labels.get(key), tasksInGroup));
}

function addTo(map, key, task) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(task);
}
