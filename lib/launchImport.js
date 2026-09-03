import { findHeaderRow, toObjects } from './sheetHeader';

// 체크리스트 시트 → 가이드 항목.
//
// 파일을 읽지 않는다. 파싱은 화면이 하고(브라우저에서 xlsx 를 동적으로 부른다)
// 이 파일은 뽑아낸 행 배열만 다룬다. 그래야 순수 함수로 검사할 수 있고, 서버가
// 화면이 보낸 것을 같은 함수로 다시 검증할 수 있다.
//
// 기준 자료: 온라인_오픈WBS_통합_260902.xlsx (세부 476건 / 19 시트)
//
// 행은 배열로 받는다(`header: 1`). 머리 행의 위치를 가정하지 않기 위해서다 —
// v10 의 24_R&R분배 는 1행이 제목이고 2행이 머리였다. 통합 WBS 의 워크스트림
// 시트에도 언젠가 그런 제목 줄이 붙을 수 있다. 그때 476건이 통째로 0이
// 되면 안 된다.

// v10 의 열 순서. 이름이 아니라 순서로 읽지 않는다 — 열이 하나 늘면 그 뒤가
// 통째로 밀리고, 밀린 채로 403건이 들어간다.
export const COL = {
  code: 'ID',
  decisionOrg: '결정권',
  ownerOrg: '소속',
  ownerRole: '주관',
  supportRole: '지원',
  category: '대분류',
  title: '체크 항목',
  channel: '채널',
  dependsOn: '선행조건',
  dayOffset: 'D-day',
  // '기한'은 일부러 안 읽는다. 아래 주석 참고.
  deliverable: '산출물/증빙',
  note: '비고',
};

// 머리 행을 알아보는 데 쓰는 열. 이 셋이 다 있는 행이 머리다.
const REQUIRED = [COL.code, COL.title, COL.dayOffset];

// 항목 코드. 통합 WBS 가 07B-01 · 10A-03 을 쓴다 — 앞자리에 한 글자가
// 붙는다. \d{2}-\d{2} 로만 받으면 그런 51건이 조용히 버려지고, 그것을
// 가리키는 선행조건도 함께 끊긴다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;

// 항목 시트인가 — 이름이 아니라 머리 행이 정한다.
//
// 이름 규칙(/^(0[1-9]|1[0-8])_/)이 통합 WBS 에서 두 번 틀렸다. 01_WBS 와
// 02_간트 를 항목 시트로 오인했고, 정작 항목이 있는 D01~D19 를 건너뛰었다.
// 'D' 를 정규식에 더하는 것은 같은 실수를 한 번 더 하는 것이다 — 다음
// 파일은 또 다른 이름을 쓴다.
//
// 세 열(ID · 체크 항목 · D-day)이 다 있는 행을 가진 시트만 항목 시트다.
// 01_WBS 는 '체크 항목' 도 'D-day' 도 없어서 저절로 빠진다.
export function isTaskSheet({ name, rows } = {}) {
  if (typeof name !== 'string' || !name.trim()) return false;
  return findHeaderRow(rows ?? [], REQUIRED) >= 0;
}

// 시트 이름이 그대로 워크스트림이 된다. '01_신규법인' 처럼.
export function workstreamOf(sheetName) {
  return typeof sheetName === 'string' ? sheetName.trim() : '';
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// 선행조건은 하나일 수도 여럿일 수도 있다. 쉼표·슬래시·공백으로 나뉜다.
export function parseDeps(value) {
  return text(value)
    .split(/[,/\s]+/)
    .map((s) => s.trim())
    .filter((s) => CODE.test(s));
}

// D-day 는 숫자여야 한다. '-120' 같은 문자열도 받는다.
//
// 빈 칸을 먼저 걸러야 한다. Number('') 는 0 이라, 안 거르면 D-day 가 비어
// 있는 행이 조용히 D0(오픈일)으로 들어간다.
function parseOffset(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const raw = text(value);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// 행 하나 → 가이드 항목. 못 읽으면 null.
export function parseRow({ sheetName, row, index = 0 }) {
  const code = text(row?.[COL.code]);
  const title = text(row?.[COL.title]);
  // 머리 행과 빈 행은 여기서 걸린다. 코드가 '01-01' 모양이 아니면 항목이 아니다.
  if (!CODE.test(code) || !title) return null;

  const dayOffset = parseOffset(row?.[COL.dayOffset]);
  // D-day 가 없으면 기한을 셀 수 없다. 기한 없는 항목은 보드에서 아무 데도
  // 놓을 자리가 없으므로 버린다 — 조용히 D0 으로 두면 오픈일에 몰린다.
  if (dayOffset === null) return null;

  return {
    code,
    workstream: workstreamOf(sheetName),
    category: text(row?.[COL.category]) || null,
    title,
    channel: text(row?.[COL.channel]) || null,
    decision_org: text(row?.[COL.decisionOrg]) || null,
    owner_org: text(row?.[COL.ownerOrg]) || null,
    owner_role: text(row?.[COL.ownerRole]) || null,
    support_role: text(row?.[COL.supportRole]) || null,
    depends_on: parseDeps(row?.[COL.dependsOn]),
    // '기한' 열은 읽지 않는다.
    //
    // 기한은 오픈일 + day_offset 으로 계산한다(lib/launchDate.js). 시트의
    // 기한 값을 저장하면 오픈일이 바뀔 때 403건이 안 따라오고, 그때부터
    // 화면이 거짓말을 한다. 시트의 00_사용법 도 같은 약속을 하고 있다.
    day_offset: dayOffset,
    deliverable: text(row?.[COL.deliverable]) || null,
    note: text(row?.[COL.note]) || null,
    // ★ 는 비고 안에 있다. 시트에서 위험을 표시하는 관습이라 그대로 읽는다.
    is_critical: text(row?.[COL.note]).includes('★'),
    sort_order: index,
  };
}

// 시트 하나 → 항목 배열.
//
// rows 는 배열 행이다. 객체 행을 넘겨도 되도록 만들지 않는다 — 두 모양을 다
// 받으면 어느 쪽으로 왔는지에 따라 결과가 달라지는 자리가 생긴다.
export function parseSheet({ sheetName, rows = [] }) {
  if (!isTaskSheet({ name: sheetName, rows })) return [];
  return toObjects({ rows, required: REQUIRED })
    .map((row, index) => parseRow({ sheetName, row, index }))
    .filter(Boolean);
}

// 워크북 전체 → 항목 배열.
//
// sheets: [{ name, rows }] — 화면이 xlsx 에서 뽑아 넘긴다.
export function parseWorkbook(sheets = []) {
  const items = [];
  const skipped = [];
  for (const sheet of sheets ?? []) {
    if (!isTaskSheet({ name: sheet?.name, rows: sheet?.rows })) {
      if (sheet?.name) skipped.push(sheet.name);
      continue;
    }
    items.push(...parseSheet({ sheetName: sheet.name, rows: sheet.rows }));
  }
  // 같은 코드가 두 번 오면 뒤엣것이 이긴다. 시트를 손보다 행을 복사한 흔적이
  // 남을 수 있고, 그때 앞엣것이 이기면 고친 쪽이 버려진다.
  const byCode = new Map();
  for (const item of items) byCode.set(item.code, item);
  return { items: [...byCode.values()], skipped, duplicates: items.length - byCode.size };
}

// 가져오기 계획. 무엇이 새로 들어가고 무엇이 갱신되는지 사람에게 보여준다.
//
// 403건이 확인 없이 그냥 들어가면 무섭다.
//
// existing: 이미 있는 항목 [{ code, ... }]
export function planImport({ incoming = [], existing = [] } = {}) {
  const have = new Map((existing ?? []).map((e) => [e.code, e]));
  const create = [];
  const update = [];
  for (const item of incoming ?? []) {
    if (have.has(item.code)) update.push(item);
    else create.push(item);
  }
  // 시트에서 빠진 것은 지우지 않는다. 사람이 시트에서 한 줄을 지웠다고 해서
  // 진행 중인 런칭의 항목까지 사라지면 안 된다 — 지우는 것은 손으로 한다.
  const missing = (existing ?? [])
    .filter((e) => !(incoming ?? []).some((i) => i.code === e.code))
    .map((e) => e.code);
  return { create, update, missing };
}
