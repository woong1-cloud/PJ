import { describe, expect, it } from 'vitest';
import { memberBrandLabel } from './memberBrandLabel';

const roles = [
  { brandId: 'm', brandName: '미쏘', tier: '4차' },
  { brandId: 's', brandName: '스파오', tier: '2차' },
  { brandId: 'h', brandName: '후아유', tier: '3차' },
];

describe('memberBrandLabel', () => {
  it('배치가 없으면 그렇게 말한다', () => {
    expect(memberBrandLabel([])).toEqual({ empty: true, name: '', tier: '', more: 0 });
    expect(memberBrandLabel(undefined)).toEqual({ empty: true, name: '', tier: '', more: 0 });
  });

  it('하나면 그것만', () => {
    expect(memberBrandLabel([roles[1]])).toEqual({
      empty: false, name: '스파오', tier: '2차', more: 0,
    });
  });

  // 여럿일 때 대표는 '지금 보고 있는 브랜드'가 있으면 그것, 없으면 첫째다.
  it('여럿이면 대표 하나와 나머지 수', () => {
    expect(memberBrandLabel(roles)).toEqual({
      empty: false, name: '미쏘', tier: '4차', more: 2,
    });
  });

  it('지금 브랜드가 있으면 그것을 대표로', () => {
    expect(memberBrandLabel(roles, { currentBrandId: 's' })).toEqual({
      empty: false, name: '스파오', tier: '2차', more: 2,
    });
  });

  // 필터가 켜져 있으면 그 브랜드만 보여준다. 「외 N」이 없다 —
  // 그 브랜드로 좁혀 보는 중인데 다른 브랜드 수를 세어 줄 이유가 없다.
  it('브랜드 필터가 켜져 있으면 그 브랜드만', () => {
    expect(memberBrandLabel(roles, { filterBrandId: 'h' })).toEqual({
      empty: false, name: '후아유', tier: '3차', more: 0,
    });
  });

  it('필터 브랜드에 배치가 없으면 빈 것으로', () => {
    expect(memberBrandLabel(roles, { filterBrandId: 'x' }).empty).toBe(true);
  });

  // 필터가 지금 브랜드를 이긴다. 눈으로 좁힌 것이 더 최근의 뜻이다.
  it('필터가 지금 브랜드보다 세다', () => {
    expect(memberBrandLabel(roles, { currentBrandId: 's', filterBrandId: 'm' }).name)
      .toBe('미쏘');
  });
});
