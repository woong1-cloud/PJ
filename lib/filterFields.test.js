import { describe, it, expect } from 'vitest';
import { buildFilterFields, PRIMARY_FILTER_KEYS } from './filterFields';
import { FILTER_KEYS } from './requirementFilters';

const opts = {
  teamMembers: [{ id: 'm1', name: '박실무' }],
  categories: [{ id: 'c1', category_name: '주문' }],
  projects: [{ id: 'p1', name: '결제 개편' }],
};

describe('buildFilterFields', () => {
  it('FILTER_KEYS 를 하나도 빠짐없이 덮는다', () => {
    // 이 테스트가 이 파일의 존재 이유다. 필터를 하나 늘리면서 여기를 빠뜨리면
    // 모바일 시트에만 안 나오는 필터가 생긴다.
    const keys = buildFilterFields(opts).map((f) => f.key);
    expect(keys.slice().sort()).toEqual([...FILTER_KEYS].sort());
  });

  it('조회로 받은 목록을 선택지로 옮긴다', () => {
    const fields = buildFilterFields(opts);
    expect(fields.find((f) => f.key === 'assignee').options).toEqual([
      { value: 'm1', label: '박실무' },
    ]);
    expect(fields.find((f) => f.key === 'category').options).toEqual([
      { value: 'c1', label: '주문' },
    ]);
    expect(fields.find((f) => f.key === 'project').options).toEqual([
      { value: 'p1', label: '결제 개편' },
    ]);
  });

  it('고정 목록은 인자 없이도 채워진다', () => {
    const fields = buildFilterFields();
    expect(fields.find((f) => f.key === 'priority').options).toEqual([
      { value: '상', label: '상' },
      { value: '중', label: '중' },
      { value: '하', label: '하' },
    ]);
    expect(fields.find((f) => f.key === 'status').options.length).toBeGreaterThan(0);
  });

  it('조회가 안 끝났으면 빈 선택지다 — 터지지 않는다', () => {
    // 담당자·카테고리·프로젝트는 별도 조회로 온다. 그 전에 렌더되면 여기가
    // undefined 를 map 하다 터져서 화면 전체가 안 뜬다.
    expect(() => buildFilterFields({})).not.toThrow();
    expect(buildFilterFields({}).find((f) => f.key === 'assignee').options).toEqual([]);
  });

  it('모든 필드에 라벨이 있다 — 시트에서 셀렉트 위에 적는다', () => {
    for (const f of buildFilterFields(opts)) {
      expect(typeof f.label).toBe('string');
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it('데스크톱에서 접지 않는 것은 상태와 유형이다', () => {
    expect(PRIMARY_FILTER_KEYS).toEqual(['status', 'type']);
  });
});
