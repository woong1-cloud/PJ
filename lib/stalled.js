import { CLOSED_STATUSES, HOLD_STATUS } from './statuses';

// 회의 안건이 되는 기준일.
//
// 7일로 잡으면 미완료 38건 중 27건이 걸려 안건이 아니라 목록이 된다. 14일은
// "회의를 이미 한 번 그냥 지나쳤다"는 뜻이라 안건 자격이 있고, 실데이터에서
// 13건이 나온다 — 한 시간짜리 회의가 다룰 수 있는 크기다.
//
// 상수인 이유: 회의가 자리 잡으면 조정할 값이다. 지금 숫자는 2026-08 기준
// 실측에서 나왔고, 밀린 양이 줄면 더 짧게 잡아야 한다.
export const STALL_DAYS = 14;

// 보류 건의 기준. 훨씬 길다.
//
// 14일로 두면 보류한 다음 주에 다시 안건에 오른다 — 보류가 아무 일도 안 한
// 셈이다. 60일이면 두 달에 한 번 다시 묻는다. 실제 보류 사유("API 개편 예정",
// "사업자 신고", "우선순위 하향") 중 어느 것도 두 달 안에 답이 나오기 어렵다.
export const HOLD_STALL_DAYS = 60;

// 이 상태에서 며칠부터 정체인가.
export function stallThreshold(status) {
  return status === HOLD_STATUS ? HOLD_STALL_DAYS : STALL_DAYS;
}

// 정체인가.
//
// 판정을 한 함수로 모으는 이유: 이 비교가 네 곳에 흩어져 있었다(목록 줄,
// 빠른 필터, 회의 API, 상세 헤드라인). 보류만 기준이 다르므로 흩어진 채로
// 두면 보류가 어디선 정체이고 어디선 아닌 화면이 된다.
//
// stalledDays 가 null 이면 거짓이다. null 은 "정체가 아니다"라는 뜻이지
// "모른다"가 아니다.
export function isStalled({ status, stalledDays } = {}) {
  if (stalledDays === null || stalledDays === undefined) return false;
  return stalledDays >= stallThreshold(status);
}

const MS_PER_DAY = 86400000;

// requirement_id 로 묶는다.
//
// 변경 로그와 코멘트를 브랜드 단위로 한 번에 읽어 와서 건마다 나눠 주는
// 용도다. 부르는 쪽마다 같은 루프를 다시 쓰지 않게 여기 둔다.
export function groupByRequirement(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = row?.requirement_id;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

// 마지막으로 무언가 일어난 시각(ISO 문자열). 아무것도 못 읽으면 null.
//
// 세 곳을 본다: 생성 시각, 마지막 변경 로그, 마지막 코멘트.
//
// 코멘트를 빼면 안 된다. 운영 데이터에 코멘트가 42건 달려 있고, 논의가 활발한
// 건이 "아무도 안 건드린 건"으로 잡히면 안건이 오염된다 — 이미 얘기가 오가는
// 중인 건을 회의에서 "20일째 방치"라고 들이미는 셈이다.
export function lastActivityAt({ requirement, changeLogs = [], comments = [] } = {}) {
  const candidates = [
    requirement?.created_at,
    ...(changeLogs ?? []).map((l) => l?.created_at),
    ...(comments ?? []).map((c) => c?.created_at),
  ];
  let best = null;
  let bestMs = -Infinity;
  for (const value of candidates) {
    const ms = Date.parse(value ?? '');
    // 읽을 수 없는 시각은 버린다. NaN 을 비교에 넣으면 모든 비교가 false 라
    // 조용히 첫 값이 남는다 — 한 행이 망가졌을 뿐인데 결과가 통째로 틀린다.
    if (!Number.isFinite(ms) || ms <= bestMs) continue;
    best = value;
    bestMs = ms;
  }
  return best;
}

// 마지막 활동 이후 며칠 지났나. 종결 건은 null — 보류만 빼고.
//
// null 은 "정체가 아니다"라는 뜻이지 "모른다"가 아니다. 완료·반려·취소·중복은
// 멈춘 게 아니라 끝난 것이라 회의 안건이 될 수 없다. 실제로 20일 넘은 16건 중
// 3건이 반려·중복이고, 이 규칙 하나로 안건이 13건으로 줄어든다.
//
// 보류는 CLOSED_STATUSES 에 있으면서도 여기서만 예외다. 끝난 것이 아니라
// 미뤄둔 것이라 시간이 가는 것을 세야 한다 — 두 달이 지나도록 아무 진전이
// 없는 보류가 스스로 드러나게 하는 장치가 이것뿐이다(회의 안건에는 안 올린다.
// 올리면 "재촉하지 않는다"는 보류의 목적과 정면으로 어긋난다).
export function stalledDays({ requirement, changeLogs = [], comments = [], now } = {}) {
  if (!requirement) return null;
  const status = requirement.status;
  if (status !== HOLD_STATUS && CLOSED_STATUSES.includes(status)) return null;
  const from = Date.parse(lastActivityAt({ requirement, changeLogs, comments }) ?? '');
  const to = Date.parse(now ?? '');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.floor((to - from) / MS_PER_DAY);
}
