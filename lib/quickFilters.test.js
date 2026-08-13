import { describe, it, expect } from 'vitest';
import {
  activeChipKey,
  chipParams,
  quickFilterChips,
  quickFilterCounts,
} from './quickFilters';
import { INITIAL_STATUS } from './statuses';

const IT = { tier: '3차', memberId: 'me' };
const REQUESTER = { tier: '4차', memberId: 'me' };
const TODAY = '2026-08-13';

describe('quickFilterChips', () => {
  it('IT 에게는 처리 기준 칩을 준다', () => {
    expect(quickFilterChips(IT).map((c) => c.key)).toEqual([
      'unassigned',
      'mineAssigned',
      'overdue',
    ]);
  });

  it('요청자에게는 자기 것 기준 칩을 준다', () => {
    expect(quickFilterChips(REQUESTER).map((c) => c.key)).toEqual(['mineRequested', 'draft']);
  });

  it('전체관리자도 처리자로 본다', () => {
    expect(quickFilterChips({ isGlobalAdmin: true }).map((c) => c.key)).toContain('unassigned');
  });

  it('등급을 모르면 요청자로 본다 — 못 하는 일을 칩으로 보여주지 않는다', () => {
    expect(quickFilterChips({}).map((c) => c.key)).toEqual(['mineRequested', 'draft']);
  });

  it('모든 칩이 같은 파라미터 키를 건드린다 — 안 그러면 이전 칩이 남는다', () => {
    for (const identity of [IT, REQUESTER]) {
      for (const chip of quickFilterChips(identity)) {
        expect(Object.keys(chip.params).sort()).toEqual(
          ['assignee', 'mine', 'missing', 'overdue', 'status'].sort()
        );
      }
    }
  });
});

describe('quickFilterCounts', () => {
  const reqs = [
    { status: '검토대기', assignee: null, requester: { id: 'me' } },
    { status: '검토대기', assignee: null, requester: { id: 'other' } },
    { status: '개발중', assignee: { id: 'me' }, requester: { id: 'other' } },
    { status: '개발중', assignee: { id: 'other' }, requester: { id: 'me' } },
    { status: INITIAL_STATUS, assignee: null, requester: { id: 'me' } },
  ];

  it('담당자 없는 건을 센다', () => {
    expect(quickFilterCounts(IT, reqs, TODAY).unassigned).toBe(3);
  });

  it('내가 담당인 건을 센다', () => {
    expect(quickFilterCounts(IT, reqs, TODAY).mineAssigned).toBe(1);
  });

  it('내가 올린 건을 센다', () => {
    expect(quickFilterCounts(REQUESTER, reqs, TODAY).mineRequested).toBe(3);
  });

  it('작성중은 내 것만 센다', () => {
    const withOthersDraft = [
      ...reqs,
      { status: INITIAL_STATUS, assignee: null, requester: { id: 'other' } },
    ];
    expect(quickFilterCounts(REQUESTER, withOthersDraft, TODAY).draft).toBe(1);
  });

  it('담당자가 uuid 문자열로 와도 센다 — 목록은 객체, 저장값은 문자열이다', () => {
    const asString = [{ status: '개발중', assignee: 'me', requester: 'me' }];
    expect(quickFilterCounts(IT, asString, TODAY).mineAssigned).toBe(1);
    expect(quickFilterCounts(REQUESTER, asString, TODAY).mineRequested).toBe(1);
  });

  it('지연은 예상일이 지난 미종결 건만 센다', () => {
    const dated = [
      { status: '개발중', expected_release_date: '2026-08-01' },
      { status: '개발중', expected_release_date: '2026-12-01' },
      // 종결 건은 지연이 아니다 — 아무도 안 하기로 한 일을 독촉하면 안 된다.
      { status: '반려', expected_release_date: '2026-08-01' },
      { status: '개발중', expected_release_date: null },
    ];
    expect(quickFilterCounts(IT, dated, TODAY).overdue).toBe(1);
  });

  it('목록이 비어도 0 이다', () => {
    expect(quickFilterCounts(IT, [], TODAY).unassigned).toBe(0);
    expect(() => quickFilterCounts(IT, undefined, TODAY)).not.toThrow();
  });
});

describe('activeChipKey', () => {
  it('아무것도 안 걸리면 null — 전체 상태다', () => {
    expect(activeChipKey(IT, { filters: {} })).toBe(null);
  });

  it('주소에서 켜진 칩을 되읽는다', () => {
    expect(activeChipKey(IT, { filters: { missing: 'assignee' } })).toBe('unassigned');
    expect(activeChipKey(IT, { filters: { assignee: 'me' } })).toBe('mineAssigned');
    expect(activeChipKey(IT, { filters: {}, overdue: true })).toBe('overdue');
  });

  it('요청자 칩도 되읽는다', () => {
    expect(activeChipKey(REQUESTER, { filters: {}, mine: true })).toBe('mineRequested');
    expect(activeChipKey(REQUESTER, { filters: { status: INITIAL_STATUS }, mine: true })).toBe(
      'draft'
    );
  });

  it('칩이 아닌 조합이면 null — 셀렉트로 직접 고른 경우다', () => {
    // 카테고리만 걸린 상태는 어느 칩도 아니다. 여기서 아무 칩이나 켜진 것으로
    // 보이면 사용자는 자기가 누르지 않은 칩이 켜져 있는 화면을 본다.
    expect(activeChipKey(IT, { filters: { category: 'c1' } })).toBe(null);
    expect(activeChipKey(IT, { filters: { assignee: 'someoneElse' } })).toBe(null);
  });
});

describe('chipParams', () => {
  it('칩을 켜면 그 칩의 값이 나온다', () => {
    expect(chipParams(IT, 'unassigned', null)).toMatchObject({ missing: 'assignee' });
  });

  it('켜진 칩을 다시 누르면 전부 빈다 — 전체로 돌아간다', () => {
    expect(chipParams(IT, 'unassigned', 'unassigned')).toEqual({
      missing: '',
      assignee: '',
      mine: '',
      status: '',
      overdue: '',
    });
  });

  it('다른 칩으로 갈아타면 이전 칩의 값이 남지 않는다', () => {
    const next = chipParams(IT, 'mineAssigned', 'unassigned');
    expect(next.missing).toBe('');
    expect(next.assignee).toBe('me');
  });

  it('모르는 칩이면 전부 빈다', () => {
    expect(chipParams(IT, '없는칩', null).missing).toBe('');
  });
});
