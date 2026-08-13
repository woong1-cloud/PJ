import { canProcess } from './tiers';
import { INITIAL_STATUS } from './statuses';
import { isOverdue } from './overdue';

// 빠른 필터 칩.
//
// 셀렉트 일곱 개를 조합하는 대신 "지금 어느 덩어리를 볼까"를 한 번에 고르게
// 한다. 실사용을 보면 그 조합이 몇 개 안 된다 — IT 는 아직 안 맡은 것과 내가
// 맡은 것, 요청자는 내가 올린 것과 아직 안 올린 것이다.
//
// 등급별로 다르게 준다. 못 하는 일을 칩으로 보여주면 그 사람은 칩 줄 전체를
// 자기 것이 아니라고 판단한다 — 온보딩 안내도 같은 이유로 갈랐다.
//
// 칩은 하나만 켜진다(라디오). '담당자 없음'과 '내 담당'은 서로 배타적이라
// 자유 토글로 두면 반드시 0건이 되는 조합에 빠지고, 사용자는 그걸 고장으로
// 본다. 대신 셀렉트 필터와는 함께 걸린다 — 칩이 덩어리를 고르고 셀렉트가
// 그 안에서 좁힌다.

// 칩이 주소에 쓰는 값. 모든 칩이 같은 키 집합을 건드려야 서로를 확실히 끈다.
const CHIP_PARAM_KEYS = ['missing', 'assignee', 'mine', 'status', 'overdue'];

const EMPTY_CHIP_PARAMS = Object.freeze(
  Object.fromEntries(CHIP_PARAM_KEYS.map((k) => [k, '']))
);

// memberId 가 필요한 칩이 있어서(내 담당·내 요청) 함수로 만든다.
function processorChips(memberId) {
  return [
    {
      key: 'unassigned',
      label: '담당자 없음',
      params: { ...EMPTY_CHIP_PARAMS, missing: 'assignee' },
      count: (reqs) => reqs.filter((r) => !r.assignee).length,
    },
    {
      key: 'mineAssigned',
      label: '내 담당',
      params: { ...EMPTY_CHIP_PARAMS, assignee: memberId ?? '' },
      count: (reqs, me) => (me ? reqs.filter((r) => idOf(r.assignee) === me).length : 0),
    },
    {
      key: 'overdue',
      label: '지연',
      params: { ...EMPTY_CHIP_PARAMS, overdue: 'true' },
      count: (reqs, _me, today) =>
        reqs.filter((r) => isOverdue(r.expected_release_date, r.status, today)).length,
    },
  ];
}

function requesterChips() {
  return [
    {
      key: 'mineRequested',
      label: '내 요청',
      params: { ...EMPTY_CHIP_PARAMS, mine: 'true' },
      count: (reqs, me) => (me ? reqs.filter((r) => idOf(r.requester) === me).length : 0),
    },
    {
      // 올린 사람만 아는 덩어리다. 실제로 세 건이 몇 주째 임시저장인 채로
      // 남아 있었는데, 올린 사람도 목록에서 그것만 따로 볼 방법이 없었다.
      key: 'draft',
      label: '작성중',
      params: { ...EMPTY_CHIP_PARAMS, mine: 'true', status: INITIAL_STATUS },
      count: (reqs, me) =>
        me
          ? reqs.filter((r) => r.status === INITIAL_STATUS && idOf(r.requester) === me).length
          : 0,
    },
  ];
}

// 조인해서 온 { id, name } 과 uuid 문자열을 둘 다 받는다. 목록 API 는 객체로
// 주고 저장값은 문자열이라, 한쪽만 다루면 개수가 조용히 0 이 된다.
function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

export function quickFilterChips(identity) {
  return canProcess(identity)
    ? processorChips(identity?.memberId)
    : requesterChips();
}

// 지금 어떤 칩이 켜져 있는지. 주소가 원본이므로 주소에서 되읽는다.
//
// 칩 상태를 따로 들고 있지 않는 이유: 뒤로가기나 링크 공유로 들어왔을 때
// 화면과 주소가 어긋난다. 주소 하나만 진실로 둔다.
export function activeChipKey(identity, { filters = {}, mine = false, overdue = false } = {}) {
  for (const chip of quickFilterChips(identity)) {
    const p = chip.params;
    const matches =
      (p.missing ? filters.missing === p.missing : !filters.missing) &&
      (p.assignee ? filters.assignee === p.assignee : !filters.assignee) &&
      (p.status ? filters.status === p.status : !filters.status) &&
      Boolean(p.mine) === Boolean(mine) &&
      Boolean(p.overdue) === Boolean(overdue);
    if (matches) return chip.key;
  }
  return null;
}

// 칩을 눌렀을 때 주소에 쓸 패치. 이미 켜져 있으면 끈다(전체로 돌아간다).
export function chipParams(identity, chipKey, currentActiveKey) {
  if (!chipKey || chipKey === currentActiveKey) return { ...EMPTY_CHIP_PARAMS };
  const chip = quickFilterChips(identity).find((c) => c.key === chipKey);
  return chip ? { ...chip.params } : { ...EMPTY_CHIP_PARAMS };
}

// 칩마다 몇 건인지. 필터가 걸리지 않은 목록을 받아 화면에서 센다.
//
// 서버에 개수 전용 라우트를 두지 않은 이유: 그러면 비공개·작성중 가시성 규칙을
// 두 곳에 복제하게 된다. 목록 API 를 필터 없이 한 번 더 불러 세면 그 규칙이
// 공짜로 따라온다.
export function quickFilterCounts(identity, requirements = [], today) {
  const me = identity?.memberId ?? null;
  const counts = {};
  for (const chip of quickFilterChips(identity)) {
    counts[chip.key] = chip.count(requirements, me, today);
  }
  return counts;
}
