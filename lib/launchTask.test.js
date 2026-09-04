import { describe, expect, it } from 'vitest';
import {
  BOARD_STATUSES,
  LAUNCH_STATUSES,
  isBlocked,
  isDone,
  isDoneThisWeek,
  isLate,
  isNotApplicable,
  isReady,
  readyCount,
  isThisWeek,
  isWaitingOnDep,
  progress,
  taskTone,
} from './launchTask';

const OPEN = '2027-01-05';
const TODAY = '2026-09-02'; // 오픈까지 D-125
const task = (over = {}) => ({
  code: '01-01',
  day_offset: -60,
  status: '할 것',
  depends_on: [],
  ...over,
});

describe('LAUNCH_STATUSES', () => {
  it('다섯이다 — 요구사항의 열 개를 쓰지 않는다', () => {
    // 넷에서 다섯으로 늘리는 것은 의도된 변경이다.
    //
    // '해당없음'은 진행 상태가 아니라 범위다. "이 브랜드에는 안 하는 일"
    // 이고, 시트가 이미 25건을 그렇게 쓰고 있어서 같은 말을 쓴다.
    // 진척률 분모에서 빠진다(아래 progress 참고).
    //
    // 화면의 상태 단추는 넷 그대로다 — 해당없음은 ⋯ 메뉴에 있다.
    expect(LAUNCH_STATUSES).toEqual(['할 것', '하는 중', '완료', '막힘', '해당없음']);
    expect(BOARD_STATUSES).toEqual(['할 것', '하는 중', '완료', '막힘']);
  });
});

describe('isNotApplicable', () => {
  it('상태가 해당없음일 때만 참', () => {
    expect(isNotApplicable({ status: '해당없음' })).toBe(true);
    expect(isNotApplicable({ status: '할 것' })).toBe(false);
    expect(isNotApplicable(null)).toBe(false);
  });
});

describe('해당없음은 세지 않는다', () => {
  const openDate = '2027-01-01';
  const today = '2026-09-03';
  const na = { status: '해당없음', day_offset: -200, depends_on: ['01-01'] };

  it('지남에 안 든다', () => {
    // -200 이면 2026-06-15 라 한참 지났다. 그래도 할 일이 아니다.
    expect(isLate({ task: na, openDate, today })).toBe(false);
  });

  it('이번 주에 안 든다', () => {
    expect(isThisWeek({ task: { ...na, day_offset: -118 }, openDate, today })).toBe(false);
  });

  it('선행 대기에 안 든다', () => {
    const tasks = [{ code: '01-01', status: '할 것' }, na];
    expect(isWaitingOnDep({ task: na, tasks })).toBe(false);
  });

  it('진척률 분모에서 빠진다', () => {
    // 476건 중 25건이 해당없음이면 분모는 451이다. 안 빼면 아무리 해도
    // 95%가 천장이 되고, 그 순간 진척률이 아무 말도 안 하게 된다.
    const tasks = [
      { status: '완료', day_offset: -10 },
      { status: '할 것', day_offset: -10 },
      { status: '해당없음', day_offset: -10 },
      { status: '해당없음', day_offset: -10 },
    ];
    const p = progress({ tasks, openDate, today });
    expect(p.total).toBe(2);
    expect(p.done).toBe(1);
    expect(p.percent).toBe(50);
    expect(p.notApplicable).toBe(2);
  });

  it('전부 해당없음이면 0으로 나누지 않는다', () => {
    const p = progress({ tasks: [{ status: '해당없음', day_offset: 0 }], openDate, today });
    expect(p.total).toBe(0);
    expect(p.percent).toBe(0);
  });
});

describe('isDoneThisWeek', () => {
  it('최근 7일 안에 완료한 것', () => {
    const today = '2026-09-03';
    expect(isDoneThisWeek({ task: { status: '완료', done_at: '2026-09-01T00:00:00Z' }, today }))
      .toBe(true);
    expect(isDoneThisWeek({ task: { status: '완료', done_at: '2026-08-20T00:00:00Z' }, today }))
      .toBe(false);
    // 완료 시각이 없으면 셀 수 없다. 옛 데이터가 그럴 수 있다.
    expect(isDoneThisWeek({ task: { status: '완료' }, today })).toBe(false);
    expect(isDoneThisWeek({ task: { status: '할 것', done_at: '2026-09-01' }, today })).toBe(false);
  });
});

describe('isLate', () => {
  it('기한이 지났으면 참', () => {
    // D-120 → 2026-09-07. 오늘이 2026-09-02 라 아직 안 지났다.
    expect(isLate({ task: task({ day_offset: -120 }), openDate: OPEN, today: TODAY })).toBe(false);
    // D-130 → 2026-08-28. 지났다.
    expect(isLate({ task: task({ day_offset: -130 }), openDate: OPEN, today: TODAY })).toBe(true);
  });

  it('기한 당일은 아직 안 지났다', () => {
    expect(isLate({ task: task({ day_offset: -125 }), openDate: OPEN, today: TODAY })).toBe(false);
  });

  it('완료는 지남이 아니다 — 끝난 일에 붉은 표시를 달면 안 된다', () => {
    const t = task({ day_offset: -130, status: '완료' });
    expect(isLate({ task: t, openDate: OPEN, today: TODAY })).toBe(false);
  });

  it('막힌 것도 기한은 지난다', () => {
    const t = task({ day_offset: -130, status: '막힘' });
    expect(isLate({ task: t, openDate: OPEN, today: TODAY })).toBe(true);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(isLate({})).toBe(false);
    expect(isLate()).toBe(false);
  });
});

describe('isThisWeek', () => {
  it('오늘부터 7일 안이면 참', () => {
    expect(isThisWeek({ task: task({ day_offset: -125 }), openDate: OPEN, today: TODAY })).toBe(
      true,
    );
    expect(isThisWeek({ task: task({ day_offset: -118 }), openDate: OPEN, today: TODAY })).toBe(
      true,
    );
  });

  it('8일 뒤는 아니다', () => {
    expect(isThisWeek({ task: task({ day_offset: -117 }), openDate: OPEN, today: TODAY })).toBe(
      false,
    );
  });

  it('이미 지난 것은 이번 주가 아니다 — 지남이 따로 센다', () => {
    expect(isThisWeek({ task: task({ day_offset: -130 }), openDate: OPEN, today: TODAY })).toBe(
      false,
    );
  });

  it('완료는 아니다', () => {
    const t = task({ day_offset: -125, status: '완료' });
    expect(isThisWeek({ task: t, openDate: OPEN, today: TODAY })).toBe(false);
  });
});

describe('isWaitingOnDep', () => {
  const tasks = [
    { code: '01-01', status: '완료' },
    { code: '01-02', status: '할 것' },
  ];

  it('선행이 안 끝났으면 대기', () => {
    expect(isWaitingOnDep({ task: task({ depends_on: ['01-02'] }), tasks })).toBe(true);
  });

  it('선행이 끝났으면 아니다', () => {
    expect(isWaitingOnDep({ task: task({ depends_on: ['01-01'] }), tasks })).toBe(false);
  });

  it('선행이 여럿이면 하나만 안 끝나도 대기', () => {
    expect(isWaitingOnDep({ task: task({ depends_on: ['01-01', '01-02'] }), tasks })).toBe(true);
  });

  it('목록에 없는 선행은 대기로 안 친다', () => {
    // 런칭 유형에 따라 01·02 워크스트림을 통째로 안 가져올 수 있다. 그때
    // 없는 것을 기다린다고 하면 그 건들이 영영 대기로 남는다.
    expect(isWaitingOnDep({ task: task({ depends_on: ['99-99'] }), tasks })).toBe(false);
  });

  it('선행이 없으면 아니다', () => {
    expect(isWaitingOnDep({ task: task(), tasks })).toBe(false);
    expect(isWaitingOnDep({ task: task({ depends_on: null }), tasks })).toBe(false);
  });

  it('자기가 완료면 대기가 아니다', () => {
    const t = task({ depends_on: ['01-02'], status: '완료' });
    expect(isWaitingOnDep({ task: t, tasks })).toBe(false);
  });
});

describe('taskTone', () => {
  const tasks = [{ code: '01-02', status: '할 것' }];

  it('완료가 가장 먼저', () => {
    const t = task({ day_offset: -130, status: '완료' });
    expect(taskTone({ task: t, openDate: OPEN, today: TODAY })).toBe('done');
  });

  it('막힘이 지남을 이긴다 — 시간이 아니라 사람이 풀어야 한다', () => {
    const t = task({ day_offset: -130, status: '막힘' });
    expect(taskTone({ task: t, openDate: OPEN, today: TODAY })).toBe('blocked');
  });

  it('지남 · 이번 주 · 대기 순', () => {
    expect(taskTone({ task: task({ day_offset: -130 }), openDate: OPEN, today: TODAY })).toBe(
      'late',
    );
    expect(taskTone({ task: task({ day_offset: -125 }), openDate: OPEN, today: TODAY })).toBe(
      'soon',
    );
    expect(
      taskTone({
        task: task({ day_offset: -10, depends_on: ['01-02'] }),
        openDate: OPEN,
        today: TODAY,
        tasks,
      }),
    ).toBe('waiting');
  });

  it('아무것도 아니면 flat', () => {
    expect(taskTone({ task: task({ day_offset: -10 }), openDate: OPEN, today: TODAY })).toBe(
      'flat',
    );
  });
});

describe('progress', () => {
  it('완료율만 주지 않는다 — 지남과 막힘이 함께 보여야 한다', () => {
    const tasks = [
      task({ code: 'a', status: '완료' }),
      task({ code: 'b', day_offset: -130 }),
      task({ code: 'c', status: '막힘' }),
      task({ code: 'd', day_offset: -125 }),
    ];
    expect(progress({ tasks, openDate: OPEN, today: TODAY })).toEqual({
      total: 4,
      done: 1,
      late: 1,
      blocked: 1,
      thisWeek: 1,
      // done_at 이 없는 옛 데이터라 이번 주 완료로는 안 잡힌다.
      doneThisWeek: 0,
      // 해당없음이 하나도 없으니 분모도 그대로 4다.
      notApplicable: 0,
      percent: 25,
    });
  });

  it('0건이면 percent 가 0 — NaN 이 화면에 찍히면 안 된다', () => {
    expect(progress({ tasks: [], openDate: OPEN, today: TODAY }).percent).toBe(0);
    expect(progress({}).percent).toBe(0);
  });
});

describe('isDone · isBlocked', () => {
  it('상태 문자열 하나만 본다', () => {
    expect(isDone({ status: '완료' })).toBe(true);
    expect(isDone({ status: '하는 중' })).toBe(false);
    expect(isBlocked({ status: '막힘' })).toBe(true);
    expect(isDone(null)).toBe(false);
    expect(isBlocked(undefined)).toBe(false);
  });
});

describe('isReady', () => {
  const tasks = [
    task({ code: '01-01', status: '완료' }),
    task({ code: '01-02', status: '할 것' }),
  ];

  it('선행이 다 끝난 할 것이다', () => {
    expect(isReady({ task: task({ depends_on: ['01-01'] }), tasks })).toBe(true);
  });

  it('선행이 안 끝났으면 아니다', () => {
    expect(isReady({ task: task({ depends_on: ['01-02'] }), tasks })).toBe(false);
  });

  it('선행이 없으면 바로 착수 가능이다', () => {
    expect(isReady({ task: task(), tasks })).toBe(true);
  });

  it('하는 중·완료·막힘·해당없음은 아니다', () => {
    // 이미 붙어 있는 일에 착수 여부를 묻지 않는다. 넣으면 이 보기가
    // 그냥 '안 끝난 것' 목록이 되어 쓸모가 사라진다.
    for (const status of ['하는 중', '완료', '막힘', '해당없음']) {
      expect(isReady({ task: task({ status }), tasks })).toBe(false);
    }
  });

  it('목록에 없는 선행은 기다리지 않는다 — 안 가져온 워크스트림', () => {
    expect(isReady({ task: task({ depends_on: ['99-99'] }), tasks })).toBe(true);
  });
});

describe('readyCount', () => {
  it('런칭 전체 목록에서 센다', () => {
    const tasks = [
      task({ code: '01-01', status: '완료' }),
      task({ code: '01-02', depends_on: ['01-01'] }),
      task({ code: '01-03', depends_on: ['01-02'] }),
    ];
    // 01-02 만. 01-01 은 완료고 01-03 은 01-02 를 기다린다.
    expect(readyCount(tasks)).toBe(1);
  });

  it('progress 에 안 넣는 이유 — 그룹만 넘기면 부풀려진다', () => {
    // 워크스트림 하나만 넘기면 선행 01-01 을 못 찾아 '없는 선행'이 되고,
    // 없는 선행은 기다리지 않으니 01-02 가 착수 가능으로 잡힌다.
    // 그래서 이 함수는 늘 전체 목록을 받아야 한다.
    const group = [task({ code: '01-02', depends_on: ['01-01'] })];
    expect(readyCount(group)).toBe(1);
  });
});
