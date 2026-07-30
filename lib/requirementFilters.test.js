import { describe, it, expect } from 'vitest';
import {
  FILTER_KEYS,
  EMPTY_FILTERS,
  parseFilterParams,
  mergeFilterParams,
  buildRequirementsQuery,
  hasActiveFilters,
} from './requirementFilters';

const sp = (search) => new URLSearchParams(search);

describe('parseFilterParams', () => {
  it('빈 주소에서는 모든 필터가 비어 있다', () => {
    const state = parseFilterParams(sp(''));
    expect(state.filters).toEqual({
      assignee: '',
      category: '',
      channel: '',
      priority: '',
      project: '',
    });
    expect(state.query).toBe('');
    expect(state.includeDone).toBe(false);
  });

  it('주소의 필터를 그대로 읽는다', () => {
    const state = parseFilterParams(sp('channel=자사몰&priority=상&q=결제'));
    expect(state.filters.channel).toBe('자사몰');
    expect(state.filters.priority).toBe('상');
    expect(state.query).toBe('결제');
  });

  // 이 테스트가 존재하는 이유: 없는 값을 null 로 내려주면 <Select value>가
  // '' 일 때와 null 일 때 다르게 동작해 화면마다 분기가 생긴다.
  it('없는 파라미터는 null 이 아니라 빈 문자열이다', () => {
    const state = parseFilterParams(sp('channel=공통'));
    expect(state.filters.assignee).toBe('');
    expect(state.filters.assignee).not.toBeNull();
  });

  it('includeDone 은 문자열 true 일 때만 참이다', () => {
    expect(parseFilterParams(sp('includeDone=true')).includeDone).toBe(true);
    expect(parseFilterParams(sp('includeDone=1')).includeDone).toBe(false);
    expect(parseFilterParams(sp('includeDone=false')).includeDone).toBe(false);
    expect(parseFilterParams(sp('')).includeDone).toBe(false);
  });

  it('searchParams 가 없어도 터지지 않는다', () => {
    expect(parseFilterParams(null).query).toBe('');
  });
});

describe('mergeFilterParams', () => {
  it('기존 값을 유지한 채 변경분만 얹는다', () => {
    const next = mergeFilterParams('channel=공통&priority=상', { priority: '하' });
    expect(parseFilterParams(sp(next)).filters).toMatchObject({
      channel: '공통',
      priority: '하',
    });
  });

  // 이 테스트가 존재하는 이유: 기본값을 URL 에 남겨 두면 "?"가 붙어 있어도
  // 필터가 걸린 건지 알 수 없다. 빈 값은 파라미터 자체를 지워야 한다.
  it('빈 문자열은 파라미터를 지운다', () => {
    const next = mergeFilterParams('channel=공통&priority=상', { priority: '' });
    expect(sp(next).has('priority')).toBe(false);
    expect(sp(next).get('channel')).toBe('공통');
  });

  it('false 와 null 도 파라미터를 지운다', () => {
    expect(sp(mergeFilterParams('includeDone=true', { includeDone: false })).has('includeDone')).toBe(false);
    expect(sp(mergeFilterParams('channel=공통', { channel: null })).has('channel')).toBe(false);
  });

  it('true 는 문자열 true 로 쓴다', () => {
    expect(sp(mergeFilterParams('', { includeDone: true })).get('includeDone')).toBe('true');
  });

  it('EMPTY_FILTERS 를 패치로 주면 필터만 전부 지운다', () => {
    const next = mergeFilterParams('channel=공통&priority=상&q=결제&includeDone=true', EMPTY_FILTERS);
    const params = sp(next);
    for (const key of FILTER_KEYS) expect(params.has(key)).toBe(false);
    // 초기화 버튼은 '종결 숨김' 토글까지 되돌리지 않는다.
    expect(params.get('includeDone')).toBe('true');
  });

  it('필터와 무관한 파라미터는 건드리지 않는다', () => {
    const next = mergeFilterParams('tab=detail&channel=공통', { channel: '' });
    expect(sp(next).get('tab')).toBe('detail');
  });

  it('바뀐 게 없으면 같은 문자열이 나온다 (불필요한 라우팅 방지)', () => {
    const current = sp('channel=공통&priority=상').toString();
    expect(mergeFilterParams(current, { channel: '공통' })).toBe(current);
  });
});

describe('buildRequirementsQuery', () => {
  it('brandId 만으로도 만들어진다', () => {
    expect(buildRequirementsQuery({ brandId: 'b1' })).toBe('brandId=b1');
  });

  it('빈 필터는 쿼리에 넣지 않는다', () => {
    const query = buildRequirementsQuery({
      brandId: 'b1',
      filters: { channel: '공통', priority: '', assignee: '' },
    });
    const params = sp(query);
    expect(params.get('channel')).toBe('공통');
    expect(params.has('priority')).toBe(false);
    expect(params.has('assignee')).toBe(false);
  });

  it('검색어는 앞뒤 공백을 떼고 넣는다', () => {
    expect(sp(buildRequirementsQuery({ brandId: 'b1', query: '  결제  ' })).get('q')).toBe('결제');
  });

  it('공백뿐인 검색어는 넣지 않는다', () => {
    expect(sp(buildRequirementsQuery({ brandId: 'b1', query: '   ' })).has('q')).toBe(false);
  });

  it('includeDone 이 거짓이면 파라미터를 붙이지 않는다', () => {
    expect(sp(buildRequirementsQuery({ brandId: 'b1' })).has('includeDone')).toBe(false);
  });

  // 이 테스트가 존재하는 이유: 보드에는 '완료' 컬럼이 있는데 목록 API 는
  // 종결 건을 기본으로 숨긴다. forceIncludeDone 이 빠지면 그 컬럼이 통째로
  // 비어 보인다. 실제로 한 번 그렇게 회귀했던 자리다.
  it('forceIncludeDone 은 URL 에 includeDone 이 없어도 종결 건을 받아온다', () => {
    const query = buildRequirementsQuery({ brandId: 'b1', includeDone: false, forceIncludeDone: true });
    expect(sp(query).get('includeDone')).toBe('true');
  });

  it('보드용 쿼리도 나머지 필터는 그대로 반영한다', () => {
    const query = buildRequirementsQuery({
      brandId: 'b1',
      filters: { channel: '자사몰', priority: '상' },
      query: '결제',
      forceIncludeDone: true,
    });
    const params = sp(query);
    expect(params.get('brandId')).toBe('b1');
    expect(params.get('channel')).toBe('자사몰');
    expect(params.get('priority')).toBe('상');
    expect(params.get('q')).toBe('결제');
    expect(params.get('includeDone')).toBe('true');
  });

  // 목록과 보드가 같은 URL 에서 같은 필터를 뽑아내는지 — 이 앱이 고치려는
  // 버그 자체를 고정한다.
  it('같은 주소에서 목록과 보드가 같은 필터를 만든다 (종결 포함 여부만 다르다)', () => {
    const state = parseFilterParams(sp('channel=자사몰&priority=상&q=결제'));
    const list = sp(buildRequirementsQuery({ brandId: 'b1', ...state }));
    const board = sp(buildRequirementsQuery({ brandId: 'b1', ...state, forceIncludeDone: true }));
    for (const key of ['channel', 'priority', 'q']) {
      expect(board.get(key)).toBe(list.get(key));
    }
    expect(list.has('includeDone')).toBe(false);
    expect(board.get('includeDone')).toBe('true');
  });
});

describe('hasActiveFilters', () => {
  it('아무것도 없으면 거짓', () => {
    expect(hasActiveFilters({ filters: {}, query: '' })).toBe(false);
    expect(hasActiveFilters()).toBe(false);
  });

  it('필터 하나만 있어도 참', () => {
    expect(hasActiveFilters({ filters: { channel: '공통' }, query: '' })).toBe(true);
  });

  it('검색어만 있어도 참', () => {
    expect(hasActiveFilters({ filters: {}, query: '결제' })).toBe(true);
  });
});
