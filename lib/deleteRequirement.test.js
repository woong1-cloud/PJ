import { describe, it, expect } from 'vitest';
import { canDeleteRequirement, isDeleteConfirmed, deletionSummary } from './deleteRequirement';

describe('canDeleteRequirement', () => {
  it('전체 관리자만 지울 수 있다', () => {
    expect(canDeleteRequirement({ isGlobalAdmin: true })).toBe(true);
  });

  it('브랜드 관리자(2차)도 지울 수 없다', () => {
    expect(canDeleteRequirement({ isGlobalAdmin: false, tier: '2차' })).toBe(false);
  });

  it('실무자·요청자도 지울 수 없다', () => {
    expect(canDeleteRequirement({ isGlobalAdmin: false, tier: '3차' })).toBe(false);
    expect(canDeleteRequirement({ isGlobalAdmin: false, tier: '4차' })).toBe(false);
  });

  it('신원이 없으면 지울 수 없다', () => {
    expect(canDeleteRequirement(null)).toBe(false);
    expect(canDeleteRequirement(undefined)).toBe(false);
    expect(canDeleteRequirement({})).toBe(false);
  });
});

describe('isDeleteConfirmed', () => {
  it('"삭제"를 그대로 입력하면 통과한다', () => {
    expect(isDeleteConfirmed('삭제')).toBe(true);
  });

  it('앞뒤 공백은 봐준다', () => {
    expect(isDeleteConfirmed('  삭제  ')).toBe(true);
  });

  it('다른 말은 통과하지 않는다', () => {
    expect(isDeleteConfirmed('')).toBe(false);
    expect(isDeleteConfirmed('삭제하기')).toBe(false);
    expect(isDeleteConfirmed('delete')).toBe(false);
    expect(isDeleteConfirmed('취소')).toBe(false);
  });

  it('문자열이 아니면 통과하지 않는다', () => {
    expect(isDeleteConfirmed(null)).toBe(false);
    expect(isDeleteConfirmed(undefined)).toBe(false);
    expect(isDeleteConfirmed(123)).toBe(false);
  });
});

describe('deletionSummary', () => {
  it('개수를 그대로 옮기고 병합 여부를 판정한다', () => {
    expect(deletionSummary({ historyCount: 5, commentCount: 2, imageCount: 1, mergedCount: 3 })).toEqual({
      historyCount: 5,
      commentCount: 2,
      imageCount: 1,
      mergedCount: 3,
      hasMergedSources: true,
    });
  });

  it('병합된 건이 없으면 hasMergedSources 는 false 다', () => {
    expect(deletionSummary({ historyCount: 1, mergedCount: 0 }).hasMergedSources).toBe(false);
  });

  it('아무것도 안 넘겨도 0 으로 채운다', () => {
    expect(deletionSummary()).toEqual({
      historyCount: 0,
      commentCount: 0,
      imageCount: 0,
      mergedCount: 0,
      hasMergedSources: false,
    });
  });
});
