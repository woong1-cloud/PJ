import { DONE_STATUS, CLOSED_STATUSES } from './statuses';

// 이 요구사항을 승인해서 완료로 보낼 수 있는가.
//
// 브랜드 접근 권한은 여기서 보지 않는다. 라우트가 requireBrandAccess(brandId,
// '4차') 로 이미 판정하므로 같은 규칙을 두 벌로 갖지 않는다. 이 함수가 답하는
// 것은 "접근할 수 있는 사람이라면, 이 건을 승인해도 되는가" 하나다.
//
// 소속(브랜드/본부)으로 가르지 않는 이유: team_members.affiliation 은 가입 시
// 자기 신고값이라 권한 판단에 쓰지 않기로 되어 있다. 본부 사람도 실제로는
// 브랜드 배치나 전체관리자 권한으로 그 건에 접근한다. 그래서 "접근할 수
// 있는가" 하나가 브랜드·본부 양쪽을 자연히 포괄한다.
//
// requirement: { status, assignee }  — assignee 는 id 문자열
// actor: { memberId, isGlobalAdmin }
// 반환: { allowed: boolean, reason: string|null }
export function canApprove({ requirement, actor } = {}) {
  if (!requirement || !actor) {
    return { allowed: false, reason: '승인할 수 없습니다.' };
  }

  // 상태 검사가 권한 검사보다 먼저다. 전체 관리자라도 이미 끝난 건을 두 번
  // 완료시킬 수는 없다 — 그러면 change_logs 에 '완료 → 완료' 가 쌓이고,
  // 상태 구간 계산에 0초짜리 구간이 섞인다.
  if (requirement.status === DONE_STATUS) {
    return { allowed: false, reason: '이미 완료된 요구사항입니다.' };
  }
  if (CLOSED_STATUSES.includes(requirement.status)) {
    return { allowed: false, reason: '종결된 요구사항은 승인할 수 없습니다.' };
  }

  if (actor.isGlobalAdmin) return { allowed: true, reason: null };

  // 담당자 본인 제외가 이 함수의 존재 이유다. 이것이 없으면 개발 → QA →
  // 본인 승인이 되어 도장 찍기가 되고, 점검 단계를 만든 목적과 정면으로
  // 충돌한다.
  //
  // Boolean(assignee) 가드가 필요하다. 담당자가 없는 건에서 assignee 와
  // memberId 가 둘 다 undefined 면 undefined === undefined 로 참이 되어,
  // 아무 관계 없는 사람이 "담당자 본인"으로 걸린다.
  if (Boolean(requirement.assignee) && requirement.assignee === actor.memberId) {
    return { allowed: false, reason: '담당자 본인은 승인할 수 없습니다.' };
  }

  return { allowed: true, reason: null };
}
