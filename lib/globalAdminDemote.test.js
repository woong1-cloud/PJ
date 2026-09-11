import { describe, expect, it } from 'vitest';
import { demoteImpact } from './globalAdminDemote';

// 2026-09-11 운영 값이다.
const BRANDS = [
  { id: 'm', name: '미쏘', is_active: true },
  { id: 's', name: '스파오', is_active: true },
  { id: 'n', name: '신규 브랜드', is_active: true },
  { id: 'nb', name: '뉴발란스', is_active: false },
  { id: 'r', name: '로엠', is_active: false },
  { id: 'h', name: '후아유', is_active: false },
];

describe('demoteImpact', () => {
  // 한지웅: 배치 4개인데 둘은 브랜드가 비활성이다. 개수만 세면 안전해
  // 보이는데 실제로 들어갈 수 있는 곳은 둘뿐이다.
  it('비활성 브랜드의 배치는 따로 가른다', () => {
    const out = demoteImpact({
      brandRoles: [
        { brandId: 'm', brandName: '미쏘', tier: '2차' },
        { brandId: 'r', brandName: '로엠', tier: '2차' },
        { brandId: 'h', brandName: '후아유', tier: '2차' },
        { brandId: 's', brandName: '스파오', tier: '2차' },
      ],
      brands: BRANDS,
    });
    expect(out.keep.map((k) => k.name)).toEqual(['미쏘', '스파오']);
    expect(out.lose).toEqual(['신규 브랜드']);
    expect(out.inactive).toEqual(['로엠', '후아유']);
  });

  // 변기석·장재혁: 스파오 하나뿐이다. 지금은 전체관리자라 셋 다 보인다.
  it('배치가 하나면 나머지 활성 브랜드를 다 잃는다', () => {
    const out = demoteImpact({
      brandRoles: [{ brandId: 's', brandName: '스파오', tier: '2차' }],
      brands: BRANDS,
    });
    expect(out.keep.map((k) => k.name)).toEqual(['스파오']);
    expect(out.lose).toEqual(['미쏘', '신규 브랜드']);
    expect(out.inactive).toEqual([]);
  });

  // 이 경우 창이 더 세게 말해야 한다 — 화면이 keep.length 로 판단한다.
  it('배치가 없으면 아무 데도 못 들어간다', () => {
    const out = demoteImpact({ brandRoles: [], brands: BRANDS });
    expect(out.keep).toEqual([]);
    expect(out.lose).toEqual(['미쏘', '스파오', '신규 브랜드']);
  });

  it('브랜드 목록이 없어도 안 죽는다', () => {
    expect(demoteImpact({ brandRoles: [], brands: undefined }))
      .toEqual({ keep: [], lose: [], inactive: [] });
    expect(demoteImpact({})).toEqual({ keep: [], lose: [], inactive: [] });
  });

  // 목록에 없는 브랜드에 배치가 남아 있을 수 있다(브랜드를 지웠거나 조회가
  // 활성만 가져왔거나). 그때 keep 에 넣으면 못 들어가는 곳을 들어간다고 말한다.
  it('브랜드 목록에 없는 배치는 keep 에 안 넣는다', () => {
    const out = demoteImpact({
      brandRoles: [{ brandId: 'zzz', brandName: '없어진 브랜드', tier: '2차' }],
      brands: BRANDS,
    });
    expect(out.keep).toEqual([]);
  });
});
