import { describe, it, expect } from 'vitest';
import {
  filterMemoryKey,
  filterMemoryToParams,
  hasRestorableFilters,
  packFilterMemory,
  unpackFilterMemory,
  urlHasFilters,
} from './filterMemory';
import { FILTER_KEYS } from './requirementFilters';

describe('filterMemoryKey', () => {
  it('브랜드마다 다르다 — 한 곳에 저장하면 남의 브랜드 uuid 로 걸러진다', () => {
    expect(filterMemoryKey('b1')).not.toBe(filterMemoryKey('b2'));
    expect(filterMemoryKey('b1')).toContain('b1');
  });
});

describe('urlHasFilters', () => {
  it('빈 주소면 복원해도 된다', () => {
    expect(urlHasFilters('')).toBe(false);
    expect(urlHasFilters(undefined)).toBe(false);
  });

  it('필터가 하나라도 있으면 복원하지 않는다 — 공유받은 링크가 이긴다', () => {
    expect(urlHasFilters('status=개발중')).toBe(true);
    expect(urlHasFilters('project=p1')).toBe(true);
  });

  it('검색어·내 요청만·종결 포함도 조회 조건이다', () => {
    expect(urlHasFilters('q=쿠폰')).toBe(true);
    expect(urlHasFilters('mine=true')).toBe(true);
    expect(urlHasFilters('includeDone=true')).toBe(true);
  });

  it('대시보드에서 넘어오는 missing 도 조건이다', () => {
    // '담당자 없는 건만' 링크로 들어왔는데 저장값이 덮으면 그 링크가 무의미해진다.
    expect(urlHasFilters('missing=assignee')).toBe(true);
  });

  it('필터가 아닌 파라미터는 무시한다', () => {
    expect(urlHasFilters('view=board')).toBe(false);
  });
});

describe('packFilterMemory', () => {
  it('걸린 값만 담는다', () => {
    const m = packFilterMemory({ filters: { status: '개발중', type: '' }, mine: true });
    expect(m.filters).toEqual({ status: '개발중' });
    expect(m.mine).toBe(true);
    expect(m.includeDone).toBe(false);
  });

  it('검색어는 저장하지 않는다 — 어제 친 말이 오늘 되살아나면 사고다', () => {
    const m = packFilterMemory({ filters: {}, query: '쿠폰' });
    expect(JSON.stringify(m)).not.toContain('쿠폰');
  });

  it('정렬은 저장한다', () => {
    expect(packFilterMemory({ sort: { key: 'expected_release_date', dir: 'asc' } }).sort).toEqual({
      key: 'expected_release_date',
      dir: 'asc',
    });
  });

  it('정렬 방향이 이상하면 desc 로 눕힌다', () => {
    expect(packFilterMemory({ sort: { key: 'title', dir: '이상한값' } }).sort.dir).toBe('desc');
  });

  it('인자가 없어도 터지지 않는다', () => {
    expect(() => packFilterMemory()).not.toThrow();
    expect(packFilterMemory().filters).toEqual({});
  });
});

describe('unpackFilterMemory', () => {
  it('저장한 것을 그대로 되돌린다', () => {
    const m = packFilterMemory({ filters: { status: '개발중' }, mine: true });
    expect(unpackFilterMemory(JSON.parse(JSON.stringify(m)))).toEqual({
      filters: { status: '개발중' },
      mine: true,
      includeDone: false,
    });
  });

  it('모르는 키는 버린다 — 손으로 고친 값이 주소에 실리면 안 된다', () => {
    const m = unpackFilterMemory({ filters: { status: '개발중', evil: 'x' }, mine: true });
    expect(m.filters).toEqual({ status: '개발중' });
  });

  it('문자열이 아닌 값도 버린다', () => {
    expect(unpackFilterMemory({ filters: { status: 123, type: null } }).filters).toEqual({});
  });

  it('쓰레기가 들어와도 null 이다', () => {
    expect(unpackFilterMemory(null)).toBeNull();
    expect(unpackFilterMemory('문자열')).toBeNull();
    expect(unpackFilterMemory(undefined)).toBeNull();
  });

  it('mine 은 true 일 때만 참이다 — "false" 문자열에 속지 않는다', () => {
    expect(unpackFilterMemory({ mine: 'false' }).mine).toBe(false);
  });
});

describe('hasRestorableFilters', () => {
  it('걸린 것이 있으면 참', () => {
    expect(hasRestorableFilters({ filters: { status: '개발중' } })).toBe(true);
    expect(hasRestorableFilters({ filters: {}, mine: true })).toBe(true);
  });

  it('아무것도 없으면 거짓 — 안내 문구를 띄울 이유가 없다', () => {
    expect(hasRestorableFilters({ filters: {} })).toBe(false);
    expect(hasRestorableFilters(null)).toBe(false);
  });

  it('정렬만 있는 것은 "조건이 걸린" 상태가 아니다', () => {
    expect(hasRestorableFilters({ filters: {}, sort: { key: 'title', dir: 'asc' } })).toBe(false);
  });
});

describe('filterMemoryToParams', () => {
  it('FILTER_KEYS 를 전부 담는다 — 안 담으면 주소의 예전 값이 남는다', () => {
    const patch = filterMemoryToParams({ filters: { status: '개발중' } });
    for (const key of FILTER_KEYS) expect(patch).toHaveProperty(key);
    expect(patch.status).toBe('개발중');
    expect(patch.type).toBe('');
  });

  it('체크박스 둘도 실어 보낸다', () => {
    expect(filterMemoryToParams({ filters: {}, mine: true, includeDone: true })).toMatchObject({
      mine: 'true',
      includeDone: 'true',
    });
    expect(filterMemoryToParams({ filters: {} })).toMatchObject({ mine: '', includeDone: '' });
  });

  it('검색어는 건드리지 않는다 — 패치에 q 가 없어야 주소의 q 가 살아남는다', () => {
    expect(filterMemoryToParams({ filters: {} })).not.toHaveProperty('q');
  });
});
