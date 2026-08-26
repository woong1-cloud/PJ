function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 회의에서 배정된 건들을 요청자별로 묶는다.
//
// 건별 즉시 발송이면 10건을 올린 사람이 회의 한 번에 10통을 받는다. 실제로
// 한 사람이 10건, 다른 한 사람이 5건을 올렸다. 그 순간부터 이 메일은 규칙으로
// 걸러지고, 그러면 요청자가 돌아올 마지막 고리가 끊긴다.
//
// assignmentLogs: change_type='담당자지정' 로그. new_value 는 담당자 이름이고
//   해제면 null 이다. 순서는 오래된 것부터여야 한다.
// requirements: 그 브랜드의 요구사항. 제목·요청자·예상일을 여기서 가져온다.
//
// 반환: [{ requesterId, items: [{ id, title, assigneeName, expectedDate }] }]
export function groupAssignmentsByRequester({ assignmentLogs = [], requirements = [] } = {}) {
  const byId = new Map((requirements ?? []).map((r) => [r.id, r]));

  // 건별로 마지막 값만 남긴다.
  //
  // 해제(new_value=null)도 여기서 덮어쓴다. 건너뛰면 "배정했다가 회의 중에
  // 다시 뺀" 건이 앞 값으로 남아, 담당자가 없는데 "담당자가 정해졌습니다"
  // 메일이 나간다. 최종값이 없는 건은 아래에서 통째로 빠진다.
  //
  // Map 은 넣은 순서를 지키므로 회의 중 배정된 순서가 그대로 나온다.
  const latest = new Map();
  for (const log of assignmentLogs ?? []) {
    if (!log?.requirement_id || !byId.has(log.requirement_id)) continue;
    latest.set(log.requirement_id, log.new_value ?? null);
  }

  const groups = new Map();
  for (const [requirementId, assigneeName] of latest) {
    if (!assigneeName) continue;
    const requirement = byId.get(requirementId);
    const requesterId = idOf(requirement.requester);
    // 요청자가 없는 건은 보낼 곳이 없다. 운영 데이터에 실제로 1건 있다.
    if (!requesterId) continue;
    if (!groups.has(requesterId)) groups.set(requesterId, []);
    groups.get(requesterId).push({
      id: requirementId,
      title: requirement.title,
      assigneeName,
      expectedDate: requirement.expected_release_date ?? null,
    });
  }

  return [...groups].map(([requesterId, items]) => ({ requesterId, items }));
}
