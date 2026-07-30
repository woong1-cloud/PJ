import { describe, it, expect } from 'vitest';
import { checklistProgress, normalizeChecklistTitle } from './checklist';

describe('normalizeChecklistTitle', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(normalizeChecklistTitle('  API 연동  ')).toBe('API 연동');
  });

  it('문자열이 아니거나 공백뿐이면 빈 문자열이다', () => {
    expect(normalizeChecklistTitle('   ')).toBe('');
    expect(normalizeChecklistTitle(null)).toBe('');
    expect(normalizeChecklistTitle(undefined)).toBe('');
    expect(normalizeChecklistTitle(123)).toBe('');
  });
});

describe('checklistProgress', () => {
  it('완료 개수와 전체 개수를 센다', () => {
    const items = [{ is_done: true }, { is_done: false }, { is_done: true }];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 3 });
  });

  it('빈 목록이나 없는 입력에도 터지지 않는다', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0 });
    expect(checklistProgress(null)).toEqual({ done: 0, total: 0 });
    expect(checklistProgress(undefined)).toEqual({ done: 0, total: 0 });
  });

  it('행이 비어 있어도 터지지 않는다', () => {
    expect(checklistProgress([null, { is_done: true }])).toEqual({ done: 1, total: 2 });
  });
});
