import { BOARD_STATUSES, CLOSED_STATUSES, DONE_STATUS } from './statuses';
import { STATUS_META } from './statusMeta';
import { canProcess } from './tiers';

// '⋯' 메뉴에 들어갈 상태 전이 목록.
//
// 여기에는 '상태를 바로 옮기는 것'만 담는다. 반려(사유 필수)와 중복 병합(창)과
// 삭제(전체 관리자)는 성격이 다른 행동이라 부르는 쪽이 따로 붙인다 — 각자
// 권한과 절차가 다르고, 한 목록에 섞으면 "고르면 바로 바뀌는 것"과 "창이 뜨는
// 것"이 다시 한 덩어리가 된다. 그게 지금 셀렉트의 문제다.
//
// 메뉴가 필요한 이유: 실제 전이 26건에서 검토대기를 떠난 길이 여덟 가지였고
// 다음 단계(검토중)는 33%였다. 다음 걸음만 버튼으로 꺼내고 나머지를 잠그면
// 절반 이상의 경우에 길이 없어진다.
export function menuTransitions({ status, identity } = {}) {
  if (!status) return [];
  // 종결 상태(완료·반려·취소·중복)에서는 비어 있다. 주 버튼 '재개'가 어디로
  // 되돌릴지 묻는 창을 띄우므로, 같은 목록을 메뉴에도 두면 두 벌이 된다.
  // 중복은 서버가 상태 변경 자체를 막는다.
  if (CLOSED_STATUSES.includes(status)) return [];
  // 4차는 상태를 바꿀 수 없다(서버도 3차 이상만 받는다). 열어 두면 눌렀을 때
  // 403 이 난다 — 누를 수 있어 보이는데 안 되는 것이 이 화면의 원래 병이다.
  if (!canProcess(identity)) return [];

  const primaryTo = STATUS_META[status]?.primary?.to ?? null;
  return BOARD_STATUSES.filter(
    // 완료는 승인 절차로만 도달한다. BOARD_STATUSES 에는 들어 있으므로
    // 여기서 명시적으로 뺀다.
    (s) => s !== DONE_STATUS && s !== status && s !== primaryTo
  );
}
