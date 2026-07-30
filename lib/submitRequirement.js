import { INITIAL_STATUS } from './statuses';
import { canProcess } from './tiers';

// '검토 요청'을 누를 수 있는가.
//
// 기존 상태 변경(PATCH .../status)은 3차 이상만 쓸 수 있고 그 규칙은 그대로
// 둔다. 검토중·개발중·완료로 넘기는 것은 IT 의 판단이기 때문이다.
// 여기서 여는 문은 딱 하나다: "내가 올린 작성중 건을 검토대기로".
//
// 이 함수가 따로 있는 이유는 조건이 셋이나 되고, 그중 하나만 빠져도 실패가
// 조용하기 때문이다 — 남의 건을 제출할 수 있게 되거나(권한 구멍), 이미 개발중인
// 건을 작성중으로 되돌리거나(이력 오염), 아무도 제출할 수 없게 된다.
//
// requirement: { status, requester }
// actor: { memberId, tier, isGlobalAdmin }
export function canSubmitForReview(requirement, actor) {
  if (!requirement || !actor) return false;
  // 작성중이 아니면 제출할 것이 없다. 이미 검토대기면 두 번 눌러도 아무 일이
  // 없어야 하고, 검토중 이후를 여기로 되돌려서는 안 된다.
  if (requirement.status !== INITIAL_STATUS) return false;
  // 3차 이상은 어차피 상태를 직접 움직일 수 있으므로 여기도 허용한다.
  if (canProcess(actor)) return true;
  // 그 외에는 본인이 올린 건만. requester 가 비어 있으면(과거 데이터) 통과시키지
  // 않는다 — undefined === undefined 로 아무나 통과하는 것을 막는다.
  return Boolean(requirement.requester) && requirement.requester === actor.memberId;
}
