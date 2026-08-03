import { describe, it, expect } from 'vitest';
import {
  FILTER_KEYS,
  EMPTY_FILTERS,
  parseFilterParams,
  mergeFilterParams,
  buildRequirementsQuery,
  hasActiveFilters,
} from './requirementFilters';
import { CLOSED_STATUSES } from './statuses';

const sp = (search) => new URLSearchParams(search);

describe('parseFilterParams', () => {
  it('빈 주소에서는 모든 필터가 비어 있다', () => {
    const state = parseFilterParams(sp(''));
    expect(state.filters).toEqual({
      status: '',
      type: '',
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

// --- v1.1: 상태 필터와 '내 요청만' ------------------------------------------

describe('상태 필터', () => {
  it('FILTER_KEYS 에 status 가 있다', () => {
    expect(FILTER_KEYS).toContain('status');
  });

  it('선택한 상태를 쿼리에 넣는다', () => {
    const qs = buildRequirementsQuery({ brandId: 'b1', filters: { status: '검토대기' } });
    expect(new URLSearchParams(qs).get('status')).toBe('검토대기');
  });

  // 이 테스트가 이 기능의 핵심이다.
  //
  // API 는 status 로 좁힌 뒤, includeDone 이 false 면 종결 상태(완료·반려·취소·중복)를
  // 걷어낸다. 그래서 상태를 '완료'로 고르면 "완료인 것 AND 완료가 아닌 것"이 되어
  // 결과가 항상 0건이다. 빈 목록은 에러를 내지 않으므로, 사용자는 완료된 건이
  // 하나도 없다고 믿게 된다 — 조용히 거짓말하는 화면이다.
  it('종결 상태를 고르면 includeDone 을 켜서 보낸다', () => {
    for (const closed of CLOSED_STATUSES) {
      const qs = buildRequirementsQuery({ brandId: 'b1', filters: { status: closed } });
      expect(new URLSearchParams(qs).get('includeDone')).toBe('true');
    }
  });

  it('진행 중 상태를 고르면 includeDone 을 건드리지 않는다', () => {
    const qs = buildRequirementsQuery({ brandId: 'b1', filters: { status: '개발중' } });
    expect(new URLSearchParams(qs).get('includeDone')).toBeNull();
  });

  it('상태를 안 골랐으면 예전과 똑같이 동작한다', () => {
    const qs = buildRequirementsQuery({ brandId: 'b1', filters: {} });
    expect(new URLSearchParams(qs).get('includeDone')).toBeNull();
  });
});

describe("'내 요청만' 필터", () => {
  it('켜면 requester 에 내 id 를 넣는다', () => {
    const qs = buildRequirementsQuery({ brandId: 'b1', mine: true, memberId: 'm1' });
    expect(new URLSearchParams(qs).get('requester')).toBe('m1');
  });

  it('끄면 requester 를 보내지 않는다', () => {
    const qs = buildRequirementsQuery({ brandId: 'b1', mine: false, memberId: 'm1' });
    expect(new URLSearchParams(qs).get('requester')).toBeNull();
  });

  // memberId 없이 mine 만 켜지는 경우(세션 로딩 중 등)에 requester= 빈 값을
  // 보내면 API 가 "요청자가 빈 문자열인 건"을 찾아 0건이 된다.
  it('내 id 를 모르면 아무것도 보내지 않는다', () => {
    const qs = buildRequirementsQuery({ brandId: 'b1', mine: true, memberId: '' });
    expect(new URLSearchParams(qs).get('requester')).toBeNull();
  });

  it('URL 에서 mine 을 읽는다', () => {
    expect(parseFilterParams(new URLSearchParams('mine=true')).mine).toBe(true);
    expect(parseFilterParams(new URLSearchParams('')).mine).toBe(false);
    // includeDone 과 같은 규칙 — 'true' 만 참으로 본다.
    expect(parseFilterParams(new URLSearchParams('mine=1')).mine).toBe(false);
  });

  it('mine 이 켜져 있으면 필터가 걸린 것으로 본다', () => {
    expect(hasActiveFilters({ filters: {}, query: '', mine: true })).toBe(true);
    expect(hasActiveFilters({ filters: {}, query: '', mine: false })).toBe(false);
  });
});

describe('missing 파라미터', () => {
  it('아는 두 값만 쿼리에 실린다', () => {
    expect(buildRequirementsQuery({ brandId: 'b1', missing: 'assignee' })).toContain(
      'missing=assignee'
    );
    expect(buildRequirementsQuery({ brandId: 'b1', missing: 'expectedDate' })).toContain(
      'missing=expectedDate'
    );
  });

  it('모르는 값은 통과하지 않는다 — 주소를 고쳐 아무 컬럼이나 넣지 못하게', () => {
    expect(buildRequirementsQuery({ brandId: 'b1', missing: 'is_confidential' })).not.toContain(
      'missing'
    );
    expect(buildRequirementsQuery({ brandId: 'b1' })).not.toContain('missing');
  });

  it('주소에서 읽어 온다', () => {
    const parsed = parseFilterParams(new URLSearchParams('status=검토대기&missing=assignee'));
    expect(parsed.missing).toBe('assignee');
    expect(parsed.filters.status).toBe('검토대기');
  });

  it('없으면 빈 문자열이다', () => {
    expect(parseFilterParams(new URLSearchParams('')).missing).toBe('');
  });

  it('FILTER_KEYS 에 들어가지 않는다 — 필터바에 칸을 만들지 않는다', () => {
    expect(FILTER_KEYS).not.toContain('missing');
  });
});
