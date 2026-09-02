import { describe, expect, it } from 'vitest';
import { findHeaderRow, toObjects } from './sheetHeader';

const NEED = ['ID', '체크 항목'];

describe('findHeaderRow', () => {
  it('첫 행이 머리면 0', () => {
    expect(findHeaderRow([['ID', '체크 항목'], ['01-01', '가']], NEED)).toBe(0);
  });

  it('제목 줄이 위에 있어도 찾는다', () => {
    // 24_R&R분배 가 실제로 그렇다. 1행을 머리로 가정하면 그 시트가 0건이 된다.
    const rows = [['신규 브랜드 체크리스트'], [], ['ID', '체크 항목'], ['01-01', '가']];
    expect(findHeaderRow(rows, NEED)).toBe(2);
  });

  it('필요한 열이 다 있어야 한다 — 하나만 맞으면 머리가 아니다', () => {
    expect(findHeaderRow([['ID', '다른 것']], NEED)).toBe(-1);
  });

  it('열 순서가 달라도 찾는다', () => {
    expect(findHeaderRow([['체크 항목', 'ID']], NEED)).toBe(0);
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(findHeaderRow([[' ID ', '체크 항목 ']], NEED)).toBe(0);
  });

  it('못 찾으면 -1', () => {
    expect(findHeaderRow([['가', '나']], NEED)).toBe(-1);
    expect(findHeaderRow([], NEED)).toBe(-1);
    expect(findHeaderRow(null, NEED)).toBe(-1);
  });

  it('찾을 것이 없으면 -1 — 아무 행이나 머리로 삼지 않는다', () => {
    expect(findHeaderRow([['가']], [])).toBe(-1);
  });
});

describe('toObjects', () => {
  it('머리 아래 행을 객체로 만든다', () => {
    const rows = [
      ['ID', '체크 항목', '비고'],
      ['01-01', '법인 설립', '원천 서류'],
    ];
    expect(toObjects({ rows, required: NEED })).toEqual([
      { ID: '01-01', '체크 항목': '법인 설립', 비고: '원천 서류' },
    ]);
  });

  it('통째로 빈 행은 버린다 — 시트 끝의 여백이 항목이 되면 안 된다', () => {
    const rows = [['ID', '체크 항목'], ['01-01', '가'], [null, null], ['', '']];
    expect(toObjects({ rows, required: NEED })).toHaveLength(1);
  });

  it('머리를 못 찾으면 빈 배열 — 순서로 억지로 읽지 않는다', () => {
    // 열이 하나 밀린 채 403건이 들어가는 것이 최악이다.
    expect(toObjects({ rows: [['가', '나'], ['1', '2']], required: NEED })).toEqual([]);
  });

  it('빈 열 이름은 키로 안 만든다', () => {
    const rows = [['ID', '', '체크 항목'], ['01-01', '버릴 값', '가']];
    const out = toObjects({ rows, required: NEED });
    expect(Object.keys(out[0])).toEqual(['ID', '체크 항목']);
  });

  it('짧은 행은 없는 칸이 null', () => {
    const rows = [['ID', '체크 항목', '비고'], ['01-01', '가']];
    expect(toObjects({ rows, required: NEED })[0].비고).toBe(null);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(toObjects({})).toEqual([]);
    expect(toObjects()).toEqual([]);
  });
});
