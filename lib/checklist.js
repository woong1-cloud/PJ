// 체크리스트 조회 시 작성자 이름을 함께 가져온다.
//
// FK 이름을 명시한다. team_members(id, name) 처럼 짧게 쓰면 PostgREST 가 어느
// 관계를 타야 할지 못 고르고 PGRST201 로 죽는다 — 이 프로젝트에서 실제로 한 번
// 로그인이 통째로 막힌 적이 있다. requirement_checklist_items 에서
// team_members 로 가는 FK 는 created_by 하나뿐이라 짧게 써도 당장은 되지만,
// 나중에 누가 done_by 같은 컬럼을 붙이는 순간 조용히 터진다.
export const CHECKLIST_SELECT =
  'id, requirement_id, title, is_done, sort_order, created_at, ' +
  'created_by:team_members!requirement_checklist_items_created_by_fkey(id, name)';

export const MAX_CHECKLIST_TITLE = 200;

// 저장 전 제목 정리. comments.js 의 normalizeCommentBody 와 같은 규칙이다 —
// 문자열이 아니거나 공백뿐이면 빈 문자열이 되고, 호출한 쪽이 400 으로 돌린다.
export function normalizeChecklistTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// "2/5 완료" 표시에 쓴다. 화면과 목록 카드 배지가 같은 계산을 쓰게 뽑아 둔다.
export function checklistProgress(items) {
  const list = items ?? [];
  const done = list.filter((i) => i?.is_done).length;
  return { done, total: list.length };
}
