import { describe, expect, it } from 'vitest';
import {
  LAUNCH_STATUSES,
  isBlocked,
  isDone,
  isLate,
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
  it('넷이다 — 요구사항의 열 개를 쓰지 않는다', () => {
    expect(LAUNCH_STATUSES).toEqual(['할 것', '하는 중', '완료', '막힘']);
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
