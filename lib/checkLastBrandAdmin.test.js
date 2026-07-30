import { describe, expect, it } from 'vitest';
import { checkLastBrandAdmin } from './checkLastBrandAdmin';

describe('checkLastBrandAdmin', () => {
  it('대상이 해당 브랜드의 유일한 2차이면 true', () => {
    const roles = [{ team_member_id: 'm1', brand_id: 'b1', tier: '2차' }];
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(true);
  });

  it('같은 브랜드에 다른 2차가 더 있으면 false', () => {
    const roles = [
      { team_member_id: 'm1', brand_id: 'b1', tier: '2차' },
      { team_member_id: 'm2', brand_id: 'b1', tier: '2차' },
    ];
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(false);
  });

  it('대상이 3차이면 애초에 보호 대상이 아니므로 false', () => {
    const roles = [{ team_member_id: 'm1', brand_id: 'b1', tier: '3차' }];
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(false);
  });

  it('다른 브랜드의 2차는 카운트에 포함하지 않는다', () => {
    const roles = [
      { team_member_id: 'm1', brand_id: 'b1', tier: '2차' },
      { team_member_id: 'm2', brand_id: 'b2', tier: '2차' },
    ];
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(true);
  });

  it('대상의 역할 자체가 없으면 false', () => {
    const roles = [{ team_member_id: 'm2', brand_id: 'b1', tier: '2차' }];
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(false);
  });
});

// 아래 두 테스트가 존재하는 이유: PATCH 라우트가 예전에는 '3차'로 내릴 때만
// 이 검사를 돌렸다. 4차를 허용하면서 가드를 함께 넓히지 않으면, 마지막 관리자를
// 4차로 강등해 검사를 통째로 건너뛸 수 있었다. 등급을 하나 넓히면 그 아래를
// 지키던 검사도 같이 넓혀야 한다는 걸 못박아 둔다.
describe('마지막 2차 관리자 강등 — 목표 등급과 무관하게 막힌다', () => {
  const roles = [
    { brand_id: 'b1', team_member_id: 'm1', tier: '2차' },
    { brand_id: 'b1', team_member_id: 'm2', tier: '3차' },
  ];

  it('3차로 내려도 마지막 관리자면 걸린다', () => {
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(true);
  });

  it('4차로 내려도 마지막 관리자면 걸린다 — 판정은 목표 등급을 보지 않는다', () => {
    expect(checkLastBrandAdmin({ roles, targetMemberId: 'm1', brandId: 'b1' })).toBe(true);
  });

  it('관리자가 둘이면 하나는 내릴 수 있다', () => {
    const twoAdmins = [...roles, { brand_id: 'b1', team_member_id: 'm3', tier: '2차' }];
    expect(checkLastBrandAdmin({ roles: twoAdmins, targetMemberId: 'm1', brandId: 'b1' })).toBe(false);
  });
});
