import { describe, it, expect } from 'vitest';
import {
  COMMENT_SELECT,
  MAX_COMMENT_BODY,
  canModifyComment,
  commentAuthorId,
  normalizeCommentBody,
} from './comments';

describe('normalizeCommentBody', () => {
  it('앞뒤 공백을 떼고 돌려준다', () => {
    expect(normalizeCommentBody('  이번 주에 되나요?  ')).toBe('이번 주에 되나요?');
  });

  it('가운데 줄바꿈은 그대로 둔다', () => {
    expect(normalizeCommentBody('첫 줄\n둘째 줄')).toBe('첫 줄\n둘째 줄');
  });

  // 공백만 든 코멘트는 피드에서 빈 칸 하나로 보인다. 등록한 사람도 무엇이
  // 올라갔는지 모르고, 지우기 전까지 자리만 차지한다.
  it('공백뿐이면 빈 문자열이다', () => {
    expect(normalizeCommentBody('')).toBe('');
    expect(normalizeCommentBody('   ')).toBe('');
    expect(normalizeCommentBody('\n\n')).toBe('');
    expect(normalizeCommentBody('\t ')).toBe('');
  });

  it('문자열이 아니면 빈 문자열이다', () => {
    expect(normalizeCommentBody(null)).toBe('');
    expect(normalizeCommentBody(undefined)).toBe('');
    expect(normalizeCommentBody(123)).toBe('');
    expect(normalizeCommentBody({ body: '안녕' })).toBe('');
  });
});

describe('commentAuthorId', () => {
  it('컬럼 그대로인 uuid 문자열을 읽는다', () => {
    expect(commentAuthorId({ author: 'member-1' })).toBe('member-1');
  });

  // 조회 결과는 author 가 {id, name} 으로 embed 되어 온다. 두 모양을 다
  // 읽지 못하면 화면에서 본인 코멘트인데 수정 버튼이 안 보인다.
  it('embed 된 {id, name} 도 읽는다', () => {
    expect(commentAuthorId({ author: { id: 'member-1', name: '한지웅' } })).toBe('member-1');
  });

  it('작성자가 없으면 null 이다', () => {
    expect(commentAuthorId({ author: null })).toBe(null);
    expect(commentAuthorId({})).toBe(null);
    expect(commentAuthorId(null)).toBe(null);
    expect(commentAuthorId(undefined)).toBe(null);
  });
});

describe('canModifyComment', () => {
  it('작성자 본인이면 고칠 수 있다', () => {
    expect(canModifyComment({ author: 'member-1' }, 'member-1')).toBe(true);
    expect(canModifyComment({ author: { id: 'member-1', name: '한지웅' } }, 'member-1')).toBe(true);
  });

  it('남의 코멘트는 고칠 수 없다', () => {
    expect(canModifyComment({ author: 'member-2' }, 'member-1')).toBe(false);
    expect(canModifyComment({ author: { id: 'member-2', name: '다른사람' } }, 'member-1')).toBe(false);
  });

  // 등급을 인자로 받지 않는 것이 이 함수의 요점이다. 관리자 예외를 두면
  // 남의 말이 조용히 바뀔 수 있다. 인자가 두 개뿐이라 예외를 낄 자리가 없다.
  it('등급을 보지 않는다 — 인자는 코멘트와 본인 id 둘뿐이다', () => {
    expect(canModifyComment.length).toBe(2);
  });

  // 작성자가 지워져 author 가 null 인 코멘트를 "누구나 고칠 수 있음"으로
  // 읽으면 안 된다. 본인이 없는 것이지 주인이 없는 것이 아니다.
  it('작성자가 비어 있으면 아무도 고칠 수 없다', () => {
    expect(canModifyComment({ author: null }, 'member-1')).toBe(false);
    expect(canModifyComment({}, 'member-1')).toBe(false);
  });

  it('보는 사람이 로그인 전이면 고칠 수 없다', () => {
    expect(canModifyComment({ author: 'member-1' }, null)).toBe(false);
    expect(canModifyComment({ author: 'member-1' }, undefined)).toBe(false);
    expect(canModifyComment({ author: 'member-1' }, '')).toBe(false);
  });
});

describe('COMMENT_SELECT', () => {
  // 짧은 team_members(...) embed 는 FK 가 여럿이면 PGRST201 로 죽는다.
  // 지금은 FK 가 하나뿐이라 통과하지만, 컬럼이 하나 늘면 조용히 터진다.
  it('작성자 embed 에 FK 이름을 명시한다', () => {
    expect(COMMENT_SELECT).toContain('team_members!requirement_comments_author_fkey');
  });

  it('수정 표시에 필요한 edited_at 을 가져온다', () => {
    expect(COMMENT_SELECT).toContain('edited_at');
  });
});

describe('MAX_COMMENT_BODY', () => {
  it('한 행이 무한정 커지지 않게 상한이 있다', () => {
    expect(MAX_COMMENT_BODY).toBeGreaterThan(0);
  });
});
