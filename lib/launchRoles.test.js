import { describe, expect, it } from 'vitest';
import { parseRoles } from './launchRoles';

// v10 의 24_R&R분배 모양. 1행이 제목이고 2행이 머리다 — 이 시트 때문에
// 머리 행을 찾는 방식이 필요해졌다.
const ROWS = [
  ['역할별 업무 범위 및 담당 건수'],
  ['역할', '소속', '업무 범위', '건수'],
  ['서비스기획', '온라인본부', '플랫폼·시스템·데이터의 설계와 연결. ERP/OMS 연동, 회원·적립 체계.', 109],
  ['법무', '지원조직', '계약·권리·약관·개인정보·표기 검수.', 23],
  ['시트 × 역할 분포'],
  ['시트', '서비스기획'],
  ['01_신규법인', 8],
];

describe('parseRoles', () => {
  it('역할 사전을 읽는다', () => {
    const roles = parseRoles(ROWS);
    expect(roles).toHaveLength(2);
    expect(roles[0]).toEqual({
      name: '서비스기획',
      org: '온라인본부',
      scope_text: '플랫폼·시스템·데이터의 설계와 연결. ERP/OMS 연동, 회원·적립 체계.',
      sort_order: 0,
    });
  });

  it('분포 표에서 멈춘다 — 시트 이름이 역할로 들어오면 안 된다', () => {
    const names = parseRoles(ROWS).map((r) => r.name);
    expect(names).not.toContain('01_신규법인');
    expect(names).not.toContain('시트');
  });

  it('건수는 읽지 않는다 — 모아가 항목에서 다시 센다', () => {
    // 시트의 숫자를 저장하면 런칭이 진행되며 실제와 갈린다.
    expect(parseRoles(ROWS)[0]).not.toHaveProperty('count');
    expect(parseRoles(ROWS)[0]).not.toHaveProperty('건수');
  });

  it('머리 행을 버린다', () => {
    expect(parseRoles(ROWS).map((r) => r.name)).not.toContain('역할');
  });

  it('업무 범위가 없으면 사전이 아니다', () => {
    const roles = parseRoles([
      ['역할', '소속', '업무 범위'],
      ['이름만', '어딘가', ''],
    ]);
    expect(roles).toEqual([]);
  });

  it('같은 역할이 두 번 나오면 한 번만', () => {
    const roles = parseRoles([
      ['역할', '소속', '업무 범위'],
      ['법무', '지원조직', '계약'],
      ['법무', '지원조직', '계약 (중복)'],
    ]);
    expect(roles).toHaveLength(1);
    expect(roles[0].scope_text).toBe('계약');
  });

  it('소속이 없어도 읽는다', () => {
    const roles = parseRoles([
      ['역할', '소속', '업무 범위'],
      ['전체PM', '', '개발 파트 전반.'],
    ]);
    expect(roles[0].org).toBe(null);
  });

  it('머리를 못 찾으면 빈 배열', () => {
    expect(parseRoles([['가', '나'], ['1', '2']])).toEqual([]);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(parseRoles([])).toEqual([]);
    expect(parseRoles()).toEqual([]);
    expect(parseRoles([null, undefined])).toEqual([]);
  });
});
