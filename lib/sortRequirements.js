import { BOARD_STATUSES, CLOSED_STATUSES } from './statuses';

const PRIORITY_RANK = { 상: 0, 중: 1, 하: 2 };
// 보드 순서를 그대로 쓴다.
const STATUS_RANK = Object.fromEntries(BOARD_STATUSES.map((s, i) => [s, i]));
// 보드 밖의 종결 상태(반려·취소·중복)는 전부 맨 뒤에 둔다. 하나라도 빠지면
// rankOf 의 `?? 99` 폴백으로 떨어져 그 상태만 다른 자리에 정렬된다.
for (const s of CLOSED_STATUSES) {
  if (!(s in STATUS_RANK)) STATUS_RANK[s] = BOARD_STATUSES.length;
}

// 컬럼을 처음 눌렀을 때의 방향.
//
// 전부 desc 로 시작하면 우선순위를 눌렀을 때 '하'와 빈 값이 위로 올라온다.
// 우선순위를 누르는 사람은 급한 것부터 보려는 것이므로 정반대다. 컬럼마다
// "사람이 그걸 누른 이유"에 맞는 방향을 기본으로 준다.
export const DEFAULT_SORT_DIR = {
  request_date: 'desc', // 최근에 들어온 것부터
  priority: 'asc', // 상 → 중 → 하
  status: 'asc', // 작성중 → ... → 완료 (보드 순서)
  expected_release_date: 'asc', // 임박한 것부터
};

function rankOf(row, key) {
  if (key === 'priority') return PRIORITY_RANK[row.priority] ?? 99;
  if (key === 'status') return STATUS_RANK[row.status] ?? 99;
  return null;
}

export function sortRequirements(rows, key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ra = rankOf(a, key);
    if (ra !== null) return (ra - rankOf(b, key)) * sign;

    // 날짜 계열. 빈 값은 정렬 방향과 무관하게 항상 뒤로 보낸다 —
    // "예상일 순으로 보고 싶다"는 요구에 빈 행이 먼저 나오면 쓸모가 없다.
    const va = a[key] ?? '';
    const vb = b[key] ?? '';
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return va < vb ? -sign : va > vb ? sign : 0;
  });
}
