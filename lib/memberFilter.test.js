import { describe, expect, it } from 'vitest';
import { MEMBER_FILTERS, filterMembers, hasNoOrganization, memberCounts } from './memberFilter';

// 한지웅은 2026-09-11 운영 값 그대로다 — 전체관리자인데 조직이 없고 옛
// affiliation('본부')만 남아 있다. 그 사람이 이 파일의 이유다.
const M = [
  { id: '1', name: '한지웅', email: 'han_jiwoong@eland.co.kr', is_active: true,
    is_global_admin: true, affiliation: '본부',
    brandRoles: [{ brandId: 's', brandName: '스파오', tier: '2차' }] },
  { id: '2', name: '김동현', email: 'kim_donghyun27@eland.co.kr', is_active: true,
    is_global_admin: false, organization: { name: '온라인BU' },
    brandRoles: [{ brandId: 's', brandName: '스파오', tier: '4차' }] },
  { id: '3', name: 'test3', email: 'test3@eland.co.kr', is_active: false,
    is_global_admin: false, organization: { name: '재무팀' }, brandRoles: [] },
];

describe('filterMembers', () => {
  it('아무것도 안 걸면 전부', () => {
    expect(filterMembers(M, {}).length).toBe(3);
  });

  it('이름으로 찾는다', () => {
    expect(filterMembers(M, { q: '한지' }).map((m) => m.id)).toEqual(['1']);
  });

  // 이름만 보면 「kim_donghyun27 을 찾아 줘」가 안 된다. 사람은 계정 이름으로도
  // 사람을 기억한다.
  it('이메일로도 찾는다', () => {
    expect(filterMembers(M, { q: 'donghyun' }).map((m) => m.id)).toEqual(['2']);
  });

  it('대소문자를 안 가린다', () => {
    expect(filterMembers(M, { q: 'TEST3' }).map((m) => m.id)).toEqual(['3']);
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(filterMembers(M, { q: '  한지  ' }).map((m) => m.id)).toEqual(['1']);
  });

  it('재직·비활성·전체관리자', () => {
    expect(filterMembers(M, { f: 'active' }).map((m) => m.id)).toEqual(['1', '2']);
    expect(filterMembers(M, { f: 'off' }).map((m) => m.id)).toEqual(['3']);
    expect(filterMembers(M, { f: 'admin' }).map((m) => m.id)).toEqual(['1']);
  });

  // 조직으로 이관이 안 된 사람. 옛 affiliation 이 그대로 보여서 화면만으로는
  // 제대로 된 소속과 구별이 안 된다 — 칩이 없으면 찾을 방법이 없다.
  it('소속 미지정을 찾는다', () => {
    expect(filterMembers(M, { f: 'noOrg' }).map((m) => m.id)).toEqual(['1']);
  });

  it('브랜드로 좁힌다', () => {
    expect(filterMembers(M, { brand: 's' }).map((m) => m.id)).toEqual(['1', '2']);
  });

  // 지금 이 사람들을 찾을 방법이 아예 없다. 가입만 하고 배치를 못 받은
  // 사람이라 놓치면 그 사람은 아무것도 못 한다.
  it('배치 없음을 찾는다', () => {
    expect(filterMembers(M, { brand: 'none' }).map((m) => m.id)).toEqual(['3']);
  });

  it('여러 조건은 함께 건다', () => {
    expect(filterMembers(M, { f: 'active', brand: 's', q: '김' }).map((m) => m.id))
      .toEqual(['2']);
  });

  it('모르는 값은 무시한다 — 주소를 손으로 고쳐도 안 죽는다', () => {
    expect(filterMembers(M, { f: '엉뚱한값' }).length).toBe(3);
  });

  it('빈 목록에서 안 죽는다', () => {
    expect(filterMembers(undefined, { q: '가' })).toEqual([]);
    expect(filterMembers(M, undefined).length).toBe(3);
  });
});

describe('memberCounts', () => {
  // 칩에 숫자를 적는다. 누르기 전에 몇 건인지 알아야 한다.
  //
  // 숫자는 **브랜드·검색을 뺀 전체 기준**이다. 칩끼리 서로 줄이면
  // 「재직중」을 누른 순간 「비활성 0」이 되어 거기로 갈 수가 없다.
  it('칩 숫자는 전체 기준', () => {
    expect(memberCounts(M)).toEqual({ all: 3, active: 2, off: 1, admin: 1, noOrg: 1 });
  });

  it('빈 목록에서 안 죽는다', () => {
    expect(memberCounts(undefined)).toEqual({ all: 0, active: 0, off: 0, admin: 0, noOrg: 0 });
  });

  it('MEMBER_FILTERS 가 칩 순서를 정한다', () => {
    expect(MEMBER_FILTERS).toEqual(['all', 'active', 'off', 'admin', 'noOrg']);
  });

  // 칩과 표의 흐린 글씨가 같은 판정을 써야 한다. 둘이 갈리면 칩에는 잡히는데
  // 줄에는 표시가 없는(또는 그 반대인) 사람이 생긴다.
  it('칩 숫자와 같은 판정을 화면도 쓴다', () => {
    expect(M.filter(hasNoOrganization).length).toBe(memberCounts(M).noOrg);
  });
});

describe('hasNoOrganization', () => {
  it('조직이 붙으면 이관된 것으로 본다', () => {
    expect(hasNoOrganization({ organization: { name: '온라인BU' } })).toBe(false);
  });

  // displayAffiliation 이 organization?.name 이 없을 때 옛 값으로 떨어진다.
  // 판정을 organization 객체로만 하면 이름 없는 조직이 붙은 사람을 "이관됨"
  // 으로 세면서 화면에는 옛 값을 그리게 된다.
  it('조직이 없거나 이름이 비면 미지정', () => {
    expect(hasNoOrganization({ affiliation: '본부' })).toBe(true);
    expect(hasNoOrganization({ organization: {} })).toBe(true);
    expect(hasNoOrganization({ organization: null })).toBe(true);
    expect(hasNoOrganization(undefined)).toBe(true);
  });
});
