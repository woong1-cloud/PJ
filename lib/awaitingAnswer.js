import { commentAuthorId } from './comments';

// 물어본 것에 답이 왔는가.
//
// 확인 대기는 "공이 요청자에게 넘어가 있다"는 표시다. 그것을 푸는 신호가
// 필요한데, 가장 단순한 규칙을 쓴다 — **요청자가 그 건에 말을 하면 답이 온
// 것으로 친다.**
//
// 정확하지 않다. 요청자가 답이 아닌 말을 달 수도 있다. 그래도 이렇게 하는
// 이유는 틀리는 방향이 안전해서다. 오탐은 회의 안건에 한 줄이 더 오는 것뿐이고
// 회의에서 보면 된다. 반대(답이 왔는데 안 풀림)는 그 건이 안건에서 영영
// 빠져서, 아무도 다시 보지 않는다.
//
// requirement: { requester, awaiting_answer_since }
// comments: [{ author, created_at }] — author 는 uuid 문자열이거나 embed 된 객체
export function hasAnswered({ requirement, comments = [] } = {}) {
  const since = Date.parse(requirement?.awaiting_answer_since ?? '');
  // 물어본 적이 없으면 풀 것도 없다. 읽을 수 없는 시각도 같다 — 그때
  // 참을 주면 물어보자마자 풀린다.
  if (!Number.isFinite(since)) return false;

  const requesterId =
    typeof requirement?.requester === 'string'
      ? requirement.requester
      : (requirement?.requester?.id ?? null);
  if (!requesterId) return false;

  return (comments ?? []).some((comment) => {
    if (commentAuthorId(comment) !== requesterId) return false;
    const at = Date.parse(comment?.created_at ?? '');
    // 물어보기 전의 말은 답이 아니다. 물어본 이유가 바로 그 말이 모자랐기
    // 때문이라, 그것으로 풀면 물어보자마자 다시 열린다.
    return Number.isFinite(at) && at > since;
  });
}

// 화면에 실어 보낼 모양.
//
// 며칠째 기다리는지를 함께 준다. 회의 화면과 목록이 같은 숫자를 말해야 하고,
// 그 계산을 두 곳에서 하면 갈린다.
export function awaitingAnswer({ requirement, now } = {}) {
  const since = Date.parse(requirement?.awaiting_answer_since ?? '');
  if (!Number.isFinite(since)) return null;
  const to = Date.parse(now ?? '');
  const days = Number.isFinite(to) ? Math.floor((to - since) / 86400000) : null;
  return { since: requirement.awaiting_answer_since, days };
}
