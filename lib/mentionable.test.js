import { describe, it, expect } from 'vitest';
import { canBeMentioned } from './mentionable';

// 부를 수 있는 범위는 "그 건을 열 수 있는 사람"과 정확히 같아야 한다.
// 열지 못하는 사람을 부르면 벨에는 뜨는데 눌러 들어가면 403 이다.
describe('canBeMentioned', () => {
  it('공개 건은 브랜드에 배치된 사람이면 누구나 부를 수 있다', () => {
    expect(canBeMentioned('2차', false)).toBe(true);
    expect(canBeMentioned('3차', false)).toBe(true);
    expect(canBeMentioned('4차', false)).toBe(true);
  });

  // 비공개 건은 상세가 3차 이상만 열어준다(lib/requirementAccess.js).
  // 4차를 부르면 알림을 받고도 못 여는 사람이 생긴다.
  it('비공개 건에서는 4차를 부를 수 없다', () => {
    expect(canBeMentioned('4차', true)).toBe(false);
    expect(canBeMentioned('3차', true)).toBe(true);
    expect(canBeMentioned('2차', true)).toBe(true);
  });

  it('모르는 등급은 부를 수 없다', () => {
    expect(canBeMentioned(null, false)).toBe(false);
    expect(canBeMentioned('5차', false)).toBe(false);
    expect(canBeMentioned(undefined, true)).toBe(false);
  });
});
