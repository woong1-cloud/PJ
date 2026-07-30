import { describe, it, expect } from 'vitest';
import { visibleRequirements } from './visibleRequirements';

const 스파오 = 'b-spao';
const 미쏘 = 'b-mixxo';

const open = { id: 'r1', brand_id: 스파오, is_confidential: false };
const spaoSecret = { id: 'r2', brand_id: 스파오, is_confidential: true };
const mixxoSecret = { id: 'r3', brand_id: 미쏘, is_confidential: true };
const all = [open, spaoSecret, mixxoSecret];

describe('visibleRequirements', () => {
  it('공개 건은 누구에게나 보인다', () => {
    const seen = visibleRequirements(all, { isGlobalAdmin: false, tierByBrand: new Map() });
    expect(seen.map((r) => r.id)).toEqual(['r1']);
  });

  // 이 테스트가 이 파일의 존재 이유다. 프로젝트 화면은 브랜드를 넘어 건을
  // 모으는데, 한 브랜드의 등급으로 다른 브랜드 비공개까지 열리면 안 된다.
  it('내가 3차인 브랜드의 비공개만 보인다', () => {
    const seen = visibleRequirements(all, {
      isGlobalAdmin: false,
      tierByBrand: new Map([[스파오, '3차']]),
    });
    expect(seen.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('4차 요청자는 자기 브랜드 비공개도 못 본다', () => {
    const seen = visibleRequirements(all, {
      isGlobalAdmin: false,
      tierByBrand: new Map([[스파오, '4차']]),
    });
    expect(seen.map((r) => r.id)).toEqual(['r1']);
  });

  it('전체관리자는 전부 본다', () => {
    const seen = visibleRequirements(all, { isGlobalAdmin: true, tierByBrand: new Map() });
    expect(seen.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('입력이 비어 있거나 없어도 터지지 않는다', () => {
    expect(visibleRequirements([], { isGlobalAdmin: false, tierByBrand: new Map() })).toEqual([]);
    expect(visibleRequirements(null, { isGlobalAdmin: false })).toEqual([]);
    expect(visibleRequirements(all, { isGlobalAdmin: false })).toEqual([open]);
  });
});
