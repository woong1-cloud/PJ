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
// requirement: { status }
// actor: { memberId, isGlobalAdmin }  — 지금은 등급을 안 보지만, 라우트가
//   requireBrandAccess('4차') 로 이미 거르고 있어 인자는 그대로 둔다.
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

  // 담당자 본인도 승인할 수 있다.
  //
  // 예전에는 막았다 — "개발 → QA → 본인 승인이 되면 도장 찍기가 된다"는
  // 이유였고, 원칙으로는 맞다. 그런데 운영 3주 데이터가 다르게 말했다.
  //
  //   · 완료 12건 중 담당자 본인이 끝낸 것이 5건. 규칙이 있는데도 그랬다.
  //   · 전체 관리자(셋)에게는 애초에 안 걸렸고, 나머지는 담당자를 나중에
  //     지정하는 순서 때문에 빠져나갔다.
  //   · 완료 12건 중 7건은 승인대기를 아예 안 거쳤다(검토대기·개발중에서
  //     바로 완료). approve 가 출발 상태를 안 가리기 때문이다.
  //
  // 즉 이 규칙은 절반만 작동했다. 어떤 날은 막히고 어떤 날은 안 막히는
  // 규칙은 없느니만 못하다 — 막힌 사람은 우회로를 찾고, 안 막힌 사람은
  // 규칙이 있는 줄도 모른다.
  //
  // 점검이 사라지는 것이 아니라 자리를 옮긴다. 주간회의의 '확인할 완료'가
  // 그 자리다(0030). 승인 시점에 한 사람이 보는 것보다, 확인할 때까지 남아
  // 회의에서 팀이 함께 훑는 쪽이 실제로 빠져나가기 어렵다.
  //
  // VOC 성 요구사항에서 실무자가 승인을 못 챙겨 승인대기에 머무는 일이
  // 있었고, 그때 요청자도 담당자도 누를 수 없어 아무도 못 끝냈다.
  return { allowed: true, reason: null };
}
