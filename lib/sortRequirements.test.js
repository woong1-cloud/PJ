import { describe, it, expect } from 'vitest';
import { sortRequirements, DEFAULT_SORT_DIR } from './sortRequirements';

const rows = [
  { id: 'a', request_date: '2026-07-20', priority: '중', status: '개발중', expected_release_date: '2026-08-01' },
  { id: 'b', request_date: '2026-07-25', priority: '상', status: '작성중', expected_release_date: null },
  { id: 'c', request_date: '2026-07-22', priority: '하', status: '완료', expected_release_date: '2026-07-10' },
];
const ids = (list) => list.map((r) => r.id);

describe('sortRequirements', () => {
  it('요청일 내림차순이 기본이다', () => {
    expect(ids(sortRequirements(rows, 'request_date', 'desc'))).toEqual(['b', 'c', 'a']);
  });

  it('요청일 오름차순', () => {
    expect(ids(sortRequirements(rows, 'request_date', 'asc'))).toEqual(['a', 'c', 'b']);
  });

  it('우선순위는 상>중>하 순서다 (사전순이 아니다)', () => {
    expect(ids(sortRequirements(rows, 'priority', 'asc'))).toEqual(['b', 'a', 'c']);
  });

  it('우선순위 내림차순은 하>중>상', () => {
    expect(ids(sortRequirements(rows, 'priority', 'desc'))).toEqual(['c', 'a', 'b']);
  });

  it('상태는 진행 순서대로 정렬한다 (사전순이 아니다)', () => {
    expect(ids(sortRequirements(rows, 'status', 'asc'))).toEqual(['b', 'a', 'c']);
  });

  it('예상일이 없는 행은 항상 뒤로 보낸다', () => {
    expect(ids(sortRequirements(rows, 'expected_release_date', 'asc'))).toEqual(['c', 'a', 'b']);
  });

  it('예상일 내림차순에서도 빈 값은 뒤에 남는다', () => {
    expect(ids(sortRequirements(rows, 'expected_release_date', 'desc'))).toEqual(['a', 'c', 'b']);
  });

  // 이 테스트가 존재하는 이유: STATUS_RANK 에 없는 상태는 `?? 99` 로 떨어져
  // 종결 상태끼리도 자리가 갈린다. 반려·취소가 완료보다 뒤, 진행 중인 건보다
  // 뒤에 오는지를 고정한다.
  it('종결 상태는 전부 진행 중인 건 뒤로 간다', () => {
    const closedRows = [
      { id: 'rej', status: '반려' },
      { id: 'dev', status: '개발중' },
      { id: 'cancel', status: '취소' },
      { id: 'draft', status: '작성중' },
      { id: 'merged', status: '중복' },
    ];
    const sorted = ids(sortRequirements(closedRows, 'status', 'asc'));
    expect(sorted.slice(0, 2)).toEqual(['draft', 'dev']);
    expect(sorted.slice(2).sort()).toEqual(['cancel', 'merged', 'rej']);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const before = ids(rows);
    sortRequirements(rows, 'priority', 'asc');
    expect(ids(rows)).toEqual(before);
  });
});

describe('DEFAULT_SORT_DIR', () => {
  // 이 테스트가 존재하는 이유: 전부 desc 로 시작하면 우선순위를 눌렀을 때
  // '하'와 빈 값이 위로 올라온다. 우선순위를 누르는 사람은 급한 것부터
  // 보려는 것이므로 정반대 결과가 나온다. 실제로 그렇게 동작했었다.
  it('우선순위는 상부터 보여준다', () => {
    const sorted = sortRequirements(rows, 'priority', DEFAULT_SORT_DIR.priority);
    expect(sorted[0].priority).toBe('상');
  });

  it('요청일은 최신부터 보여준다', () => {
    const sorted = sortRequirements(rows, 'request_date', DEFAULT_SORT_DIR.request_date);
    expect(sorted[0].request_date).toBe('2026-07-25');
  });

  it('예상일은 임박한 것부터 보여준다', () => {
    const sorted = sortRequirements(rows, 'expected_release_date', DEFAULT_SORT_DIR.expected_release_date);
    expect(sorted[0].expected_release_date).toBe('2026-07-10');
  });

  it('상태는 보드 순서대로 보여준다', () => {
    const sorted = sortRequirements(rows, 'status', DEFAULT_SORT_DIR.status);
    expect(sorted[0].status).toBe('작성중');
  });

  it('정렬 가능한 모든 컬럼에 기본 방향이 있다', () => {
    for (const key of ['request_date', 'priority', 'status', 'expected_release_date']) {
      expect(DEFAULT_SORT_DIR[key], `${key} 기본 방향 누락`).toMatch(/^(asc|desc)$/);
    }
  });
});
