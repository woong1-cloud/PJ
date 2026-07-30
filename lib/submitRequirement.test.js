import { describe, it, expect } from 'vitest';
import { canSubmitForReview } from './submitRequirement';

const 나 = { memberId: 'me', tier: '4차', isGlobalAdmin: false };
const 남 = { memberId: 'other', tier: '4차', isGlobalAdmin: false };
const 실무자 = { memberId: 'it', tier: '3차', isGlobalAdmin: false };
const 전체관리자 = { memberId: 'admin', tier: undefined, isGlobalAdmin: true };

const 내작성중 = { status: '작성중', requester: 'me' };

describe('canSubmitForReview', () => {
  // 이 테스트가 이 기능의 이유다. 예전에는 4차가 자기 요구사항을 제출할
  // 방법이 없어서, 올린 건이 아무도 보지 않는 '작성중'에 영구히 머물렀다.
  it('4차도 자기가 올린 작성중 건은 제출할 수 있다', () => {
    expect(canSubmitForReview(내작성중, 나)).toBe(true);
  });

  it('남이 올린 건은 4차가 제출할 수 없다', () => {
    expect(canSubmitForReview(내작성중, 남)).toBe(false);
  });

  it('3차 이상은 남의 건도 제출할 수 있다', () => {
    expect(canSubmitForReview(내작성중, 실무자)).toBe(true);
    expect(canSubmitForReview(내작성중, 전체관리자)).toBe(true);
  });

  // 두 번 누르는 일은 실제로 일어난다(느린 네트워크). 그때 이력에 같은 변경이
  // 두 번 남거나 상태가 뒤로 가면 안 된다.
  it('이미 검토대기면 제출할 것이 없다', () => {
    expect(canSubmitForReview({ status: '검토대기', requester: 'me' }, 나)).toBe(false);
  });

  // 진행 중인 건을 요청자가 되돌릴 수 있으면 IT 가 작업하던 것이 사라진다.
  it('검토중 이후는 되돌리지 못한다', () => {
    for (const status of ['검토중', '개발중', '완료', '반려', '취소', '중복']) {
      expect(canSubmitForReview({ status, requester: 'me' }, 나)).toBe(false);
      expect(canSubmitForReview({ status, requester: 'me' }, 실무자)).toBe(false);
    }
  });

  // requester 가 없는 과거 데이터에서 undefined === undefined 로 아무나
  // 통과하는 것을 막는다.
  it('요청자가 비어 있으면 4차는 제출할 수 없다', () => {
    expect(canSubmitForReview({ status: '작성중', requester: null }, 나)).toBe(false);
    expect(canSubmitForReview({ status: '작성중' }, { memberId: undefined, tier: '4차' })).toBe(
      false,
    );
  });

  it('인자가 없어도 터지지 않고 거절한다', () => {
    expect(canSubmitForReview(null, 나)).toBe(false);
    expect(canSubmitForReview(내작성중, null)).toBe(false);
    expect(canSubmitForReview(undefined, undefined)).toBe(false);
  });
});
