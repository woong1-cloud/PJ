import { describe, it, expect } from 'vitest';
import { activeFilterChips, buildFilterFields, CLEAR_FILTER_VALUE } from './filterFields';
import { countActiveFilters, FILTER_KEYS } from './requirementFilters';

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

  it('앞자리는 상태·카테고리·프로젝트다', () => {
    // 데스크톱은 일곱 개를 전부 보여주므로 순서가 곧 눈에 닿는 순서다.
    // 카테고리·프로젝트가 실사용에서 값이 가장 잘 갈리는 축인데 예전에는
    // '필터 더보기' 뒤에 있었고, 그래서 아무도 안 썼다.
    const keys = buildFilterFields(opts).map((f) => f.key);
    expect(keys.slice(0, 3)).toEqual(['status', 'category', 'project']);
  });

  it('되돌리기 값은 빈 문자열이 아니다', () => {
    // 빈 문자열은 base-ui 가 "선택 안 됨"과 구분하지 못한다.
    expect(CLEAR_FILTER_VALUE).toBeTruthy();
    expect(CLEAR_FILTER_VALUE).not.toBe('');
  });
});

describe('activeFilterChips', () => {
  const fields = buildFilterFields(opts);

  it('걸린 것만 칩이 된다', () => {
    const chips = activeFilterChips({ fields, filters: { status: '개발중', type: '' } });
    expect(chips).toEqual([{ key: 'status', label: '상태', valueLabel: '개발중' }]);
  });

  it('uuid 값은 사람이 읽을 이름으로 바꾼다', () => {
    const chips = activeFilterChips({ fields, filters: { assignee: 'm1' } });
    expect(chips[0]).toEqual({ key: 'assignee', label: '담당자', valueLabel: '박실무' });
  });

  it('이름을 못 찾으면 값을 안 적는다 — uuid 를 띄우면 칩이 줄을 통째로 먹는다', () => {
    const chips = activeFilterChips({ fields, filters: { assignee: '아직-안-온-id' } });
    expect(chips[0]).toEqual({ key: 'assignee', label: '담당자', valueLabel: null });
  });

  it('체크박스 둘도 칩이 된다 — 모바일에서는 시트 안이라 밖에서 안 보인다', () => {
    const chips = activeFilterChips({ fields, filters: {}, mine: true, includeDone: true });
    expect(chips.map((c) => c.key)).toEqual(['mine', 'includeDone']);
  });

  it('기본 상태에서는 칩이 없다 — 칩 줄 자체가 안 생겨야 한다', () => {
    expect(activeFilterChips({ fields, filters: {} })).toEqual([]);
    expect(activeFilterChips({ fields })).toEqual([]);
    expect(activeFilterChips()).toEqual([]);
  });

  it('칩 개수는 countActiveFilters 와 같다 — 배지와 칩이 어긋나면 안 된다', () => {
    const filters = { status: '개발중', channel: '자사몰', assignee: 'm1' };
    expect(activeFilterChips({ fields, filters, mine: true }).length).toBe(
      countActiveFilters({ filters, mine: true })
    );
  });
});
