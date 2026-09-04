import { dueDate } from './launchDate';
import { NA_STATUS } from './launchTask';

// 브랜드에게 줄 엑셀 양식 — 무엇을 어느 시트에 넣을지만 정한다.
//
// 엑셀을 만들지 않는다(exceljs 는 route.js 가 부른다). 여기는 값만 계산해서
// 순수 함수로 둔다 — 그래야 DOM 도 워크북도 없이 vitest(node 환경)에서 검사할
// 수 있다.
//
// 451줄을 훑게 하면 안 훑는다. 브랜드가 실제로 바꿀 것은 30~50건이고
// 나머지 400건은 아무것도 안 한다. 그래서 첫 시트를 ★(is_critical) 이면서
// 결정권이 브랜드인 것만으로 줄인다 — 57줄은 한 시간에 보고, 451줄은 안 본다.

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// ★ 이면서 결정권이 브랜드인 것 — 브랜드가 먼저 볼 것.
function isFirstLook(task) {
  return task?.is_critical === true && text(task?.decision_org) === '브랜드';
}

// 브랜드가 먼저 볼 것.
//
// 451줄을 훑게 하면 안 훑는다. 브랜드가 실제로 바꿀 것은 30~50건이고
// 나머지 400건은 아무것도 안 한다.
export function firstLookRows(tasks) {
  return (Array.isArray(tasks) ? tasks : []).filter(isFirstLook);
}

// 나머지 전부(먼저 볼 것에 든 것 제외).
//
// isFirstLook 을 그대로 뒤집어서 만든다 — firstLookRows 와 기준이 갈리면
// 두 시트 사이에 겹치거나 빠지는 줄이 생긴다.
export function restRows(tasks) {
  return (Array.isArray(tasks) ? tasks : []).filter((t) => !isFirstLook(t));
}

// 한 줄 → 양식의 한 행.
//
// 열 이름은 lib/launchImport.js 의 COL 과 정확히 같아야 한다. 안 그러면
// 내보낸 파일을 다시 올렸을 때 파서가 못 읽는다.
export function templateRow({ task, openDate } = {}) {
  if (!task) return null;

  // status 는 DB 의 다섯 상태 중 하나다(lib/launchTask.js). 양식에는 '해당'
  // 또는 '해당없음' 둘 뿐이다 — 진행 상태(하는 중·막힘 등)는 모아에서만
  // 다루고, 엑셀 왕복은 '범위'(할 일이냐 아니냐)만 다룬다.
  const isNa = task.status === NA_STATUS;
  const deps = Array.isArray(task.depends_on) ? task.depends_on : [];

  return {
    ID: text(task.code),
    결정권: text(task.decision_org),
    소속: text(task.owner_org),
    주관: text(task.owner_role),
    지원: text(task.support_role),
    대분류: text(task.category),
    '체크 항목': text(task.title),
    채널: text(task.channel),
    선행조건: deps.filter(Boolean).join(', '),
    'D-day': Number.isFinite(task.day_offset) ? task.day_offset : '',
    // 파서는 이 열을 안 읽는다(오픈일이 바뀌면 다시 계산해야 하므로) — 그래도
    // 넣는 이유는 브랜드가 읽는 것이 D-90 이 아니라 이 날짜이기 때문이다.
    기한: dueDate(openDate, task.day_offset) ?? '',
    상태: isNa ? NA_STATUS : '해당',
    '산출물/증빙': text(task.deliverable),
    // 해당없음이면 사유가 여기 들어간다 — parseRow 가 '비고' 를 그대로
    // excluded_reason 으로 읽는다(lib/launchImport.js). excluded_reason 이
    // 이미 있으면 그것을, 없으면 note 를 대신 넣는다.
    비고: isNa ? text(task.excluded_reason || task.note) : text(task.note),
  };
}

// 현황 한 줄. 양식(templateRow)과 달리 진행을 전부 담는다 —
// 이건 브랜드가 채울 것이 아니라 지금 상태를 그대로 찍어 내는 것이다.
//
// 양식의 열 이름을 그대로 재사용한다(COL 과 겹치는 부분). 다만 '상태'의
// 뜻은 다르다 — 양식은 '범위'(해당/해당없음)만 담지만, 여기는 진행까지
// 담는 다섯 상태 그대로를 찍는다(lib/launchTask.js 의 LAUNCH_STATUSES).
// '비고'도 마찬가지로 원본 그대로다 — 해당없음 사유는 별도 열이 있어서
// templateRow 처럼 비고 자리에 끼워 넣을 필요가 없다.
//
// decisionsById 는 Map(id → decision) 이다. 매번 새로 찾지 않고 호출부가
// 한 번만 만들어 넘긴다 — 항목이 수백 건이라 항목마다 결정 목록을 훑으면
// 안 된다.
export function statusRow({ task, openDate, decisionsById } = {}) {
  if (!task) return null;

  const deps = Array.isArray(task.depends_on) ? task.depends_on : [];
  const decisions = decisionsById instanceof Map ? decisionsById : new Map();
  const waitingOn = task.blocked_decision_id ? decisions.get(task.blocked_decision_id) : null;

  return {
    ID: text(task.code),
    결정권: text(task.decision_org),
    소속: text(task.owner_org),
    주관: text(task.owner_role),
    지원: text(task.support_role),
    대분류: text(task.category),
    '체크 항목': text(task.title),
    채널: text(task.channel),
    선행조건: deps.filter(Boolean).join(', '),
    'D-day': Number.isFinite(task.day_offset) ? task.day_offset : '',
    기한: dueDate(openDate, task.day_offset) ?? '',
    '산출물/증빙': text(task.deliverable),
    비고: text(task.note),
    상태: text(task.status),
    담당자: text(task.assignee_name),
    // 시각(timestamptz)이 아니라 날짜만 남긴다. 보고서 받는 사람이 볼 것은
    // '언제 끝났나'이지 몇 시 몇 분이 아니다.
    완료일: text(task.done_at).slice(0, 10),
    '막힌 이유': text(task.blocked_reason),
    '기다리는 결정': text(waitingOn?.title),
    '해당없음 사유': text(task.excluded_reason),
    // 손으로 넣은 항목은 다음 엑셀 가져오기가 안 건드린다(source='manual',
    // lib/launchImport.js). 보고서를 받는 사람이 "이건 시트에 없는 건데?"
    // 할 때 답이 이 칸에 있어야 한다.
    출처: task.source === 'manual' ? '손으로 넣음' : '엑셀',
    '쉬운 설명': text(task.plain_text),
  };
}

// 값 하나를 후보 목록에 더한다. 비었으면 버리고, 이미 있으면 다시 안 넣는다.
function collect(set, value) {
  const v = text(value);
  if (v) set.add(v);
}

// 드롭다운 후보. 현재 항목에서 뽑는다 — 못 박으면(고정 목록) 새 역할이나
// 새 조직이 다음 런칭에서 생겨도 양식이 못 따라간다.
//
// orgs 는 결정권·소속 둘의 후보를 겸한다 — 같은 조직 이름 세계를 쓰기
// 때문이다(예: '브랜드' 가 결정권에도 소속에도 나온다).
export function optionsFrom(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const workstreams = new Set();
  const roles = new Set();
  const orgs = new Set();
  const channels = new Set();

  for (const t of list) {
    collect(workstreams, t?.workstream);
    collect(roles, t?.owner_role);
    collect(roles, t?.support_role);
    collect(orgs, t?.owner_org);
    collect(orgs, t?.decision_org);
    collect(channels, t?.channel);
  }

  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  return {
    workstreams: sorted(workstreams),
    roles: sorted(roles),
    orgs: sorted(orgs),
    channels: sorted(channels),
  };
}
