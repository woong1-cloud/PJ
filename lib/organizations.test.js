import { describe, it, expect } from 'vitest';
import { groupOrganizations, suggestTierFromOrg, displayAffiliation } from './organizations';

describe('groupOrganizations', () => {
  const orgs = [
    { id: 'b1', name: '스파오', brand_id: 'brand-1', is_active: true, sort_order: 1 },
    { id: 'o1', name: '법무팀', brand_id: null, is_active: true, sort_order: 2 },
    { id: 'b2', name: '미쏘', brand_id: 'brand-2', is_active: true, sort_order: 0 },
    { id: 'x1', name: '없어진팀', brand_id: null, is_active: false, sort_order: 0 },
  ];

  it('brand_id 유무로 두 그룹으로 나눈다', () => {
    const { brands, teams } = groupOrganizations(orgs);
    expect(brands.map((o) => o.name)).toEqual(['미쏘', '스파오']);
    expect(teams.map((o) => o.name)).toEqual(['법무팀']);
  });

  it('비활성 조직은 빠진다 — 가입 화면에 보이면 안 된다', () => {
    const { teams } = groupOrganizations(orgs);
    expect(teams.map((o) => o.name)).not.toContain('없어진팀');
  });

  it('sort_order 순으로 정렬한다', () => {
    const { brands } = groupOrganizations(orgs);
    expect(brands[0].name).toBe('미쏘');
  });

  it('sort_order 가 같으면 이름 순 — 순서가 매번 달라지면 안 된다', () => {
    const { teams } = groupOrganizations([
      { id: '1', name: '재무팀', brand_id: null, is_active: true, sort_order: 0 },
      { id: '2', name: '법무팀', brand_id: null, is_active: true, sort_order: 0 },
    ]);
    expect(teams.map((o) => o.name)).toEqual(['법무팀', '재무팀']);
  });

  it('is_active 가 없으면 활성으로 본다 — 공개 API 는 그 컬럼을 안 실을 수 있다', () => {
    const { teams } = groupOrganizations([{ id: '1', name: '법무팀', brand_id: null }]);
    expect(teams.map((o) => o.name)).toEqual(['법무팀']);
  });

  it('빈 입력에 터지지 않는다', () => {
    expect(groupOrganizations()).toEqual({ brands: [], teams: [] });
    expect(groupOrganizations(null)).toEqual({ brands: [], teams: [] });
  });
});

describe('suggestTierFromOrg', () => {
  it('조직에 적힌 기본 등급을 준다', () => {
    expect(suggestTierFromOrg({ default_tier: '3차' })).toBe('3차');
  });

  it('조직이 없거나 기본 등급이 비면 요청자다', () => {
    // 판단이 안 될 때 권한을 더 주는 쪽으로 기울면 그게 곧 보안 구멍이다.
    expect(suggestTierFromOrg(null)).toBe('4차');
    expect(suggestTierFromOrg({})).toBe('4차');
    expect(suggestTierFromOrg({ default_tier: null })).toBe('4차');
  });

  it('모르는 값도 요청자로 떨어진다', () => {
    expect(suggestTierFromOrg({ default_tier: '0차' })).toBe('4차');
    // 프로토타입을 타고 들어오는 값을 막는다.
    expect(suggestTierFromOrg({ default_tier: 'toString' })).toBe('4차');
    expect(suggestTierFromOrg({ default_tier: 'constructor' })).toBe('4차');
  });
});

describe('displayAffiliation', () => {
  it('조직 이름을 먼저 쓴다', () => {
    expect(displayAffiliation({ organization: { name: '법무팀' }, affiliation: '본부' })).toBe(
      '법무팀'
    );
  });

  it('아직 이관되지 않았으면 옛 소속값을 보여준다', () => {
    // 마이그레이션 0022 가 본부 소속을 비워 두므로, 이관 전에도 관리자
    // 눈에는 '본부'로 계속 보여야 한다.
    expect(displayAffiliation({ organization: null, affiliation: '본부' })).toBe('본부');
  });

  it('둘 다 없으면 대시', () => {
    expect(displayAffiliation({})).toBe('—');
    expect(displayAffiliation(null)).toBe('—');
  });
});
