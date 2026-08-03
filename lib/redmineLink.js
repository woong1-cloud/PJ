import { DONE_STATUS, QA_STATUS, APPROVAL_PENDING_STATUS } from './statuses';

export const MAX_REDMINE_URL = 500;

// 레드마인 이슈 주소가 있어야 하는 상태.
//
// 검토중은 뺀다. 그 단계는 "할지 말지"를 정하는 중이라 반려로 끝날 수도 있고,
// 반려될 건에 레드마인 이슈를 만들라고 재촉하면 안 된다. 개발중부터는 실제로
// 일이 돌고 있다는 뜻이므로, 그때 레드마인에 티켓이 없으면 인계가 빠진 것이다.
//
// 승인대기까지 포함한다 — 거기까지 왔는데 링크가 없으면 일은 끝났지만 기록이
// 비어 있는 것이고, 나중에 "이건 어디서 했더라"에 답할 수 없다.
export const HANDOFF_STATUSES = ['개발중', QA_STATUS, APPROVAL_PENDING_STATUS];

// 저장 전 주소 정리.
//
// http/https 만 통과시킨다. 이 값은 화면에서 <a href> 로 그대로 나가는데,
// javascript: 로 시작하는 문자열이 들어오면 링크를 누른 사람의 브라우저에서
// 그게 실행된다. 서버가 관문이므로 여기서 막는다.
//
// 사내 호스트로 좁히지 않는 이유: 아직 주소를 모르고, 나중에 바뀔 수도 있다.
// 스킴만 막아도 위험한 경우는 사라진다.
export function normalizeRedmineUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  if (trimmed.length > MAX_REDMINE_URL) return '';
  return trimmed;
}

// 실행 단계로 넘어갔어야 하는데 안 넘어간 건.
//
// 이 목록이 0이 아니면 브랜드가 기다리고 있는데 아무 일도 안 일어나는 건이
// 그만큼 있다는 뜻이다. 대시보드 '손볼 것'이 이 값을 쓴다.
export function unlinkedHandoffs(requirements) {
  return (requirements ?? []).filter(
    (r) => HANDOFF_STATUSES.includes(r.status) && !r.redmine_url
  );
}

// 목록의 한 줄에 무엇을 보여줄까.
//
//   'linked'   — 주소가 있다. 링크로 보여준다
//   'missing'  — 있어야 하는데 없다. 경고로 보여준다
//   'none'     — 아직 넘길 단계가 아니다. 아무것도 보여주지 않는다
//
// 세 번째가 중요하다. 작성중·검토대기에까지 '미연결'을 띄우면 그 배지는 목록
// 전체에 깔리고, 정작 봐야 할 개발중 건에서 눈에 안 들어온다.
export function redmineLinkState(requirement) {
  if (requirement?.redmine_url) return 'linked';
  if (HANDOFF_STATUSES.includes(requirement?.status)) return 'missing';
  return 'none';
}

// 완료된 건은 재촉하지 않는다. 이미 끝났고 지금 와서 링크를 요구해도
// 아무도 채우지 않는다.
export function shouldNudge(requirement) {
  return requirement?.status !== DONE_STATUS && redmineLinkState(requirement) === 'missing';
}
