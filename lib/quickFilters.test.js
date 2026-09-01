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
  // 목록을 못 박아 두는 것이 이 검사의 요점이다. 칩이 슬쩍 늘어나면 줄이
  // 길어지고, 길어진 줄은 아무도 안 본다. 늘리려면 여기를 함께 고쳐야 한다.
  //
  // 2026-08 에 '멈춘 것'을 의도적으로 더했다. '지연'은 예상일이 지난 것인데
  // 예상일이 있는 건이 47건 중 8건뿐이라 대부분의 정체를 못 잡는다.
  it('IT 에게는 처리 기준 칩을 준다', () => {
    expect(quickFilterChips(IT).map((c) => c.key)).toEqual([
      'unassigned',
      'mineAssigned',
      'overdue',
      'stalled',
      // 보류 칩. 이 목록은 못이다 — 칩을 하나 늘리면 여기가 먼저 깨져서
      // 개수 계산이나 상호 배타 규칙을 빠뜨리는 일을 막는다.
      'hold',
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
          ['assignee', 'mine', 'missing', 'overdue', 'status', 'stalled'].sort()
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
      stalled: '',
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

describe('멈춘 것 칩', () => {
  const processor = { memberId: 'm1', tier: '3차' };

  it('실무자 칩 목록에 있다', () => {
    expect(quickFilterChips(processor).map((c) => c.key)).toContain('stalled');
  });

  it('요청자에게는 없다 — 남의 건이 왜 멈췄는지는 요청자가 할 일이 아니다', () => {
    expect(quickFilterChips({ memberId: 'm2', tier: '4차' }).map((c) => c.key)).not.toContain(
      'stalled'
    );
  });

  it('서버가 실어 보낸 stalledDays 로 센다', () => {
    const reqs = [
      { id: 'a', stalledDays: 20 },
      { id: 'b', stalledDays: 3 },
      { id: 'c', stalledDays: null },
      { id: 'd', stalledDays: 14 },
    ];
    expect(quickFilterCounts(processor, reqs, '2026-08-28').stalled).toBe(2);
  });

  it('stalledDays 가 아예 없어도 죽지 않는다 — 옛 응답', () => {
    expect(quickFilterCounts(processor, [{ id: 'a' }], '2026-08-28').stalled).toBe(0);
  });

  it('칩을 누르면 stalled 파라미터가 켜진다', () => {
    expect(chipParams(processor, 'stalled', null).stalled).toBe('true');
  });

  it('다시 누르면 꺼진다', () => {
    expect(chipParams(processor, 'stalled', 'stalled').stalled).toBe('');
  });

  it('다른 칩을 누르면 stalled 가 꺼진다 — 칩은 라디오다', () => {
    expect(chipParams(processor, 'unassigned', 'stalled').stalled).toBe('');
  });

  it('주소에 stalled 가 있으면 그 칩이 켜진 것으로 읽는다', () => {
    expect(activeChipKey(processor, { filters: {}, stalled: true })).toBe('stalled');
  });

  it('stalled 가 없으면 다른 칩 판정이 흔들리지 않는다', () => {
    expect(activeChipKey(processor, { filters: { missing: 'assignee' } })).toBe('unassigned');
  });
});

describe('보류 칩', () => {
  const holdChip = () => quickFilterChips(IT).find((c) => c.key === 'hold');

  it('실무자에게만 준다', () => {
    // 요청자에게 "남의 건이 왜 보류인가"는 할 일이 아니다.
    expect(holdChip()).toBeTruthy();
    expect(quickFilterChips(REQUESTER).find((c) => c.key === 'hold')).toBeUndefined();
  });

  it('상태만 건다 — 종결 포함은 buildRequirementsQuery 가 알아서 켠다', () => {
    // includeDone 을 여기서 안 넣는 것이 중요하다. 보류는 CLOSED_STATUSES 라
    // 그게 안 켜지면 "보류 12" 를 눌렀는데 0건이 나온다. 그 강제는
    // buildRequirementsQuery 의 closedPicked 가 이미 하고 있다.
    expect(holdChip().params.status).toBe('보류');
  });

  it('다른 칩과 같은 키 집합을 건드린다 — 서로를 확실히 끈다', () => {
    const keys = (chip) => Object.keys(chip.params).sort();
    for (const chip of quickFilterChips(IT)) {
      expect(keys(chip), chip.key).toEqual(keys(holdChip()));
    }
  });

  it('종결을 숨기고 있어도 보류를 센다', () => {
    // 이게 이 칩의 존재 이유다. 숨어 있어도 몇 건이 미뤄져 있는지는 보여야 한다.
    const reqs = [
      { status: '보류', stalledDays: 70 },
      { status: '보류', stalledDays: 3 },
      { status: '검토대기', stalledDays: 1 },
    ];
    const counts = quickFilterCounts(IT, reqs, '2026-08-28', false);
    expect(counts.hold).toBe(2);
  });

  it('다른 칩은 종결 숨김을 그대로 따른다', () => {
    // 안 그러면 '담당자 없음 3' 을 눌렀는데 1건이 나온다.
    const reqs = [
      { status: '보류', assignee: null, stalledDays: 70 },
      { status: '반려', assignee: null, stalledDays: null },
      { status: '검토대기', assignee: null, stalledDays: 1 },
    ];
    expect(quickFilterCounts(IT, reqs, '2026-08-28', false).unassigned).toBe(1);
    expect(quickFilterCounts(IT, reqs, '2026-08-28', true).unassigned).toBe(3);
  });

  it("'멈춘 것' 은 보류를 60일 기준으로 센다", () => {
    // 종결 포함을 켠 상태에서도 보류 30일은 멈춘 것이 아니다. 보통 상태라면
    // 진작 걸렸을 값이다.
    const reqs = [
      { status: '보류', stalledDays: 30 },
      { status: '보류', stalledDays: 70 },
      { status: '검토대기', stalledDays: 30 },
    ];
    expect(quickFilterCounts(IT, reqs, '2026-08-28', true).stalled).toBe(2);
  });

  it('보류 칩이 켜진 것을 주소에서 알아본다', () => {
    expect(activeChipKey(IT, { filters: { status: '보류' } })).toBe('hold');
  });
});

describe("'멈춘 것' 칩과 확인 대기", () => {
  it('답을 기다리는 건은 안 센다', () => {
    const reqs = [
      { status: '검토대기', stalledDays: 30 },
      { status: '검토대기', stalledDays: 30, awaiting: { days: 3 } },
    ];
    expect(quickFilterCounts(IT, reqs, '2026-09-01', false).stalled).toBe(1);
  });
});
