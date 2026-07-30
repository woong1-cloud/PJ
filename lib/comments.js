// 코멘트 조회 시 작성자 이름을 함께 가져온다.
//
// FK 이름을 명시한다. team_members(id, name) 처럼 짧게 쓰면 PostgREST 가 어느
// 관계를 타야 할지 못 고르고 PGRST201 로 죽는다 — 이 프로젝트에서 실제로 한 번
// 로그인이 통째로 막힌 적이 있다. 지금 requirement_comments 에서 team_members
// 로 가는 FK 는 author 하나뿐이라 짧게 써도 당장은 되지만, 나중에 누가
// deleted_by 같은 컬럼을 하나 붙이는 순간 조용히 터진다. 처음부터 못 박아 둔다.
export const COMMENT_SELECT =
  'id, requirement_id, body, created_at, edited_at, ' +
  'author:team_members!requirement_comments_author_fkey(id, name)';

// 한 행이 무한정 커지지 않게 막는다. 긴 논의는 여러 개로 나눠 쓰면 된다.
export const MAX_COMMENT_BODY = 4000;

// 저장 전 본문 정리. 문자열이 아니거나 공백뿐이면 빈 문자열이 되고,
// 호출한 쪽이 그것을 400 으로 돌린다. 공백만 든 코멘트는 피드에서 빈 칸
// 하나로 보여서 누른 사람도 무엇이 등록됐는지 모른다.
export function normalizeCommentBody(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 코멘트 행에서 작성자 id 를 꺼낸다.
//
// 서버는 author 컬럼(uuid 문자열)을 그대로 읽고, 화면은 조회 결과에 embed 된
// author:{id, name} 을 받는다. 이름은 같은데 모양이 달라서, 판정 함수가 한쪽
// 모양만 알면 다른 쪽에서 조용히 false 가 된다 — 본인인데 수정 버튼이 안 보이는
// 식으로. 두 모양을 여기서 한 번에 흡수한다.
export function commentAuthorId(comment) {
  const author = comment?.author;
  if (!author) return null;
  return typeof author === 'string' ? author : (author.id ?? null);
}

// 이 코멘트를 고치거나 지울 수 있는 사람인가.
//
// 작성자 본인만이다. 등급을 아예 인자로 받지 않는 것이 요점이다 — 관리자
// 예외를 두면 남의 말이 조용히 바뀔 수 있고, 그런 수정 버튼은 없느니만 못하다.
// 화면에서 버튼을 보일지 정할 때도 같은 함수를 써서 서버 판정과 어긋나지 않게 한다.
//
// author 는 nullable 이다. null 은 "누구나"가 아니라 "본인인 사람이 없음"이다.
export function canModifyComment(comment, memberId) {
  const authorId = commentAuthorId(comment);
  if (!authorId || !memberId) return false;
  return authorId === memberId;
}
