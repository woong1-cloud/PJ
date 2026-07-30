import { describe, it, expect } from 'vitest';
import { canSeeProject, requirementsOfMyBrands, visibleProjects } from './projectAccess';

const 스파오 = 'b-spao';
const 미쏘 = 'b-mixxo';
const 뉴발 = 'b-nb';

const 스파오만 = [스파오];

describe('canSeeProject', () => {
  // 이 테스트가 이 파일의 존재 이유다. 예전에는 서버가 이 판정을 하지 않아서,
  // '전사 전체' 버튼을 누르거나 brandId 없이 API 를 직접 부르면 누구나 전사
  // 프로젝트를 받았다.
  it('내 브랜드에 전개된 프로젝트만 보인다', () => {
    expect(
      canSeeProject({ projectBrands: [{ brand_id: 스파오 }], myBrandIds: 스파오만 }),
    ).toBe(true);
    expect(canSeeProject({ projectBrands: [{ brand_id: 미쏘 }], myBrandIds: 스파오만 })).toBe(
      false,
    );
  });

  it('여러 브랜드에 전개된 프로젝트는 하나만 겹쳐도 보인다', () => {
    expect(
      canSeeProject({
        projectBrands: [{ brand_id: 미쏘 }, { brand_id: 스파오 }],
        myBrandIds: 스파오만,
      }),
    ).toBe(true);
  });

  it('전체관리자는 전부 본다', () => {
    expect(
      canSeeProject({ projectBrands: [{ brand_id: 미쏘 }], myBrandIds: [], isGlobalAdmin: true }),
    ).toBe(true);
    expect(canSeeProject({ projectBrands: [], myBrandIds: [], isGlobalAdmin: true })).toBe(true);
  });

  // 배치 대기 상태(브랜드 행이 없는 팀원)는 아무것도 못 본다.
  it('배치된 브랜드가 없으면 아무것도 못 본다', () => {
    expect(canSeeProject({ projectBrands: [{ brand_id: 스파오 }], myBrandIds: [] })).toBe(false);
    expect(canSeeProject({ projectBrands: [{ brand_id: 스파오 }] })).toBe(false);
  });

  // 만들고 아직 전개하지 않은 프로젝트. 아무 브랜드의 것도 아니므로
  // "내 브랜드에 전개됐다"가 성립하지 않는다.
  it('전개 브랜드가 없는 프로젝트는 전체관리자만 본다', () => {
    expect(canSeeProject({ projectBrands: [], myBrandIds: 스파오만 })).toBe(false);
    expect(canSeeProject({ myBrandIds: 스파오만 })).toBe(false);
  });

  it('brandId 표기(camelCase)도 받는다', () => {
    expect(canSeeProject({ projectBrands: [{ brandId: 스파오 }], myBrandIds: 스파오만 })).toBe(
      true,
    );
  });

  it('인자가 없어도 터지지 않고 거절한다', () => {
    expect(canSeeProject({})).toBe(false);
  });
});

describe('visibleProjects', () => {
  const projects = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const allProjectBrands = [
    { project_id: 'p1', brand_id: 스파오 },
    { project_id: 'p2', brand_id: 미쏘 },
    { project_id: 'p2', brand_id: 뉴발 },
    // p3 은 전개 없음
  ];

  it('내 브랜드 것만 남긴다', () => {
    const seen = visibleProjects({ projects, allProjectBrands, myBrandIds: 스파오만 });
    expect(seen.map((p) => p.id)).toEqual(['p1']);
  });

  it('전체관리자는 전개 없는 것까지 전부 본다', () => {
    const seen = visibleProjects({
      projects,
      allProjectBrands,
      myBrandIds: [],
      isGlobalAdmin: true,
    });
    expect(seen.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('여러 브랜드에 배치된 사람은 그 브랜드들 것을 본다', () => {
    const seen = visibleProjects({ projects, allProjectBrands, myBrandIds: [스파오, 뉴발] });
    expect(seen.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('빈 입력에도 터지지 않는다', () => {
    expect(visibleProjects({})).toEqual([]);
  });
});

describe('requirementsOfMyBrands', () => {
  const reqs = [
    { id: 'r1', brand_id: 스파오, title: '스파오 건' },
    { id: 'r2', brand_id: 미쏘, title: '미쏘 건' },
  ];

  // 공홈 프로젝트를 스파오 4차가 열면 스파오 건만 보여야 한다.
  it('내 브랜드 요구사항만 남긴다', () => {
    const seen = requirementsOfMyBrands(reqs, { myBrandIds: 스파오만 });
    expect(seen.map((r) => r.id)).toEqual(['r1']);
  });

  it('전체관리자는 전부 본다', () => {
    expect(requirementsOfMyBrands(reqs, { myBrandIds: [], isGlobalAdmin: true })).toEqual(reqs);
  });

  it('빈 입력에도 터지지 않는다', () => {
    expect(requirementsOfMyBrands(null, { myBrandIds: 스파오만 })).toEqual([]);
    expect(requirementsOfMyBrands(reqs, {})).toEqual([]);
  });
});
