// 활동 피드: 변경 이력(change_logs)과 코멘트(requirement_comments)를 한 줄기로 섞는다.
//
// 두 출처는 테이블이 다르다. change_logs 는 감사 기록이라 고치거나 지울 수 없고,
// 코멘트는 오타도 고치고 지우기도 한다(0010 마이그레이션 주석 참고). 그래서
// 저장은 따로 하되, 읽을 때만 시간순으로 합친다 — "왜 이 상태로 갔는지"와
// "그때 무슨 얘기가 오갔는지"가 따로 놓여 있으면 둘을 눈으로 짜맞춰야 한다.
//
// 합치는 일을 API 가 아니라 여기서 하는 이유: 상세 API 는 이미 history 를
// 돌려주고, 코멘트는 따로 조회·등록·수정·삭제되므로 자기 엔드포인트를 갖는다.
// 서버에서 합쳐 내려주면 코멘트 하나 고칠 때마다 상세 전체를 다시 만들어야 한다.
//
// 정렬은 오래된 것이 위, 새 것이 아래다. 상세 API 의 history 정렬(created_at
// 오름차순)과 같게 맞춘 것이고, 대화는 위에서 아래로 읽는 것이라 새 코멘트가
// 맨 아래에 붙는 편이 자연스럽다.

// 같은 시각에 걸린 항목들의 순서.
//
// Array.prototype.sort 는 안정 정렬이므로, 아래에서 이력을 먼저 넣고 코멘트를
// 뒤에 넣는 것만으로 "같은 시각이면 이력이 먼저, 그 다음 코멘트"가 된다.
// 상태를 바꾸고 곧바로 이유를 적는 흐름이 흔해서, 시각이 같을 때는 이력이
// 위에 오는 쪽이 읽기에 맞다. 같은 종류끼리는 들어온 순서를 그대로 지킨다.
function toTime(value) {
  const parsed = Date.parse(value);
  // 시각을 읽을 수 없는 행(null·깨진 값)은 맨 뒤로 보낸다. 0 으로 두면
  // 1970년으로 취급되어 피드 맨 위에 올라붙는다 — 한 행이 망가졌을 뿐인데
  // 피드 전체가 이상해 보이는 것보다 낫다.
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

// history: change_logs 행 배열, comments: requirement_comments 행 배열.
// 반환: { kind, id, createdAt, data } 배열. id 는 두 출처의 uuid 가 겹칠 일이
// 없더라도 종류를 접두사로 붙여 React key 로 바로 쓸 수 있게 한다.
export function buildActivityFeed(history, comments) {
  const entries = [
    ...(Array.isArray(history) ? history : []).map((log) => ({
      kind: 'change',
      id: `change:${log.id}`,
      createdAt: log.created_at ?? null,
      data: log,
    })),
    ...(Array.isArray(comments) ? comments : []).map((comment) => ({
      kind: 'comment',
      id: `comment:${comment.id}`,
      createdAt: comment.created_at ?? null,
      data: comment,
    })),
  ];

  // 코멘트를 고쳐도 자리는 그대로다. 정렬 기준은 created_at 이지 edited_at 이
  // 아니다 — 오타 하나 고쳤다고 석 달 전 대화가 맨 아래로 튀어나오면 안 된다.
  return entries.sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
}
