import { describe, expect, it } from 'vitest';
import { dueDate } from './launchDate';
import { ganttRows, ganttScale, offsetPercent, monthTicks } from './launchGantt';

const OPEN = '2027-01-01';
const TODAY = '2026-09-04'; // 오픈까지 D-119

const task = (over = {}) => ({
  code: '01-01',
  workstream: 'D01_법인·행정',
  day_offset: -60,
  status: '할 것',
  ...over,
});

describe('ganttRows — 묶기', () => {
  it('워크스트림별로 묶고 이름순으로 늘어놓는다', () => {
    const tasks = [
      task({ workstream: 'D19_플랫폼구축', day_offset: -25 }),
      task({ workstream: 'D01_법인·행정', day_offset: -120 }),
      task({ workstream: 'D10_CS운영', day_offset: 14 }),
    ];
    const rows = ganttRows({ tasks, openDate: OPEN, today: TODAY });
    expect(rows.map((r) => r.workstream)).toEqual([
      'D01_법인·행정',
      'D10_CS운영',
      'D19_플랫폼구축',
    ]);
  });
});

describe('ganttRows — 해당없음은 기간에서 뺀다', () => {
  const tasks = [
    task({ code: 'a', day_offset: -120, status: '할 것' }),
    // -200 은 나머지 둘보다 훨씬 이르다. 해당없음이 기간 계산에 들어가면
    // minOffset 이 -200 으로 끌려간다 — 안 하는 일이 막대를 늘리면 안 된다.
    task({ code: 'b', day_offset: -200, status: '해당없음' }),
    task({ code: 'c', day_offset: -10, status: '완료' }),
  ];
  const row = ganttRows({ tasks, openDate: OPEN, today: TODAY })[0];

  it('min·max 가 해당없음을 건너뛴다', () => {
    expect(row.minOffset).toBe(-120);
    expect(row.maxOffset).toBe(-10);
  });

  it('그래도 개수는 센다', () => {
    expect(row.notApplicable).toBe(1);
    expect(row.total).toBe(2);
    expect(row.done).toBe(1);
  });

  it('from·to 는 dueDate 결과와 같다', () => {
    expect(row.from).toBe(dueDate(OPEN, -120));
    expect(row.to).toBe(dueDate(OPEN, -10));
  });
});

describe('ganttRows — 전부 해당없음', () => {
  it('막대를 안 그리게 total 0, percent 0, 기간 null', () => {
    const tasks = [
      task({ code: 'a', status: '해당없음', day_offset: -50 }),
      task({ code: 'b', status: '해당없음', day_offset: -5 }),
    ];
    const row = ganttRows({ tasks, openDate: OPEN, today: TODAY })[0];
    expect(row.total).toBe(0);
    expect(row.percent).toBe(0);
    expect(row.minOffset).toBe(null);
    expect(row.maxOffset).toBe(null);
    expect(row.from).toBe(null);
    expect(row.to).toBe(null);
    expect(row.notApplicable).toBe(2);
  });
});

describe('ganttRows — percent', () => {
  it('total 이 0이 아니면 done/total*100 (반올림)', () => {
    const tasks = [
      task({ code: 'a', status: '완료' }),
      task({ code: 'b', status: '할 것' }),
      task({ code: 'c', status: '할 것' }),
    ];
    const row = ganttRows({ tasks, openDate: OPEN, today: TODAY })[0];
    expect(row.percent).toBe(33); // 1/3 반올림
  });
});

describe('ganttRows — done·late·blocked 는 launchTask.js 를 그대로 쓴다', () => {
  it('직접 판정하지 않고 위임한다', () => {
    const tasks = [
      // day_offset -200 → 기한 2026-06-15, 오늘(2026-09-04)보다 훨씬 이전 → 지남
      task({ code: 'late1', day_offset: -200, status: '할 것' }),
      // 같은 기한이라도 완료면 지남이 아니다 (launchTask.isLate 규칙)
      task({ code: 'done1', day_offset: -200, status: '완료' }),
      task({ code: 'blocked1', day_offset: 10, status: '막힘' }),
    ];
    const row = ganttRows({ tasks, openDate: OPEN, today: TODAY })[0];
    expect(row.late).toBe(1);
    expect(row.blocked).toBe(1);
    expect(row.done).toBe(1);
  });
});

describe('ganttRows — 오픈일 이후까지 가는 워크스트림', () => {
  it('maxOffset 이 양수면 to 가 오픈일보다 뒤다', () => {
    const tasks = [
      task({ workstream: 'D18_오픈리허설', code: 'a', day_offset: -15 }),
      task({ workstream: 'D18_오픈리허설', code: 'b', day_offset: 21 }),
    ];
    const row = ganttRows({ tasks, openDate: OPEN, today: TODAY })[0];
    expect(row.maxOffset).toBe(21);
    expect(row.to).toBe(dueDate(OPEN, 21));
    expect(row.to > OPEN).toBe(true);
  });
});

describe('ganttRows — 빈 입력', () => {
  it('안 죽고 빈 배열', () => {
    expect(ganttRows({})).toEqual([]);
    expect(ganttRows()).toEqual([]);
    expect(ganttRows({ tasks: [] })).toEqual([]);
  });
});

describe('ganttScale', () => {
  it('양 끝에 5일씩 여유를 둔다', () => {
    const rows = [
      { workstream: 'a', minOffset: -100, maxOffset: -10, total: 5 },
      { workstream: 'b', minOffset: -15, maxOffset: 21, total: 3 },
    ];
    expect(ganttScale(rows)).toEqual({ minOffset: -105, maxOffset: 26 });
  });

  it('total 0(막대 없음) 인 행은 자리 계산에서 뺀다', () => {
    const rows = [
      { workstream: 'a', minOffset: -100, maxOffset: -10, total: 5 },
      { workstream: 'b', minOffset: null, maxOffset: null, total: 0 },
    ];
    expect(ganttScale(rows)).toEqual({ minOffset: -105, maxOffset: -5 });
  });

  it('그릴 막대가 하나도 없으면 기본 폭', () => {
    expect(ganttScale([])).toEqual({ minOffset: -5, maxOffset: 5 });
    expect(ganttScale(undefined)).toEqual({ minOffset: -5, maxOffset: 5 });
    expect(ganttScale([{ workstream: 'a', total: 0, minOffset: null, maxOffset: null }])).toEqual(
      { minOffset: -5, maxOffset: 5 },
    );
  });
});

describe('offsetPercent', () => {
  const scale = { minOffset: -10, maxOffset: 10 };

  it('구간 양 끝과 가운데', () => {
    expect(offsetPercent(-10, scale)).toBe(0);
    expect(offsetPercent(0, scale)).toBe(50);
    expect(offsetPercent(10, scale)).toBe(100);
  });

  it('구간 밖은 0·100 으로 죈다', () => {
    expect(offsetPercent(-20, scale)).toBe(0);
    expect(offsetPercent(20, scale)).toBe(100);
  });

  it('폭이 0(하루뿐)이면 가운데', () => {
    expect(offsetPercent(5, { minOffset: 5, maxOffset: 5 })).toBe(50);
  });

  it('안 읽히는 값에서 NaN 대신 0', () => {
    expect(offsetPercent(NaN, scale)).toBe(0);
    expect(offsetPercent(5, null)).toBe(0);
    expect(offsetPercent(5, {})).toBe(0);
  });
});

describe('monthTicks', () => {
  it('구간에 걸치는 달의 1일 위치를 찍는다', () => {
    // 2027-01-01 기준 -31 ~ +31 → 2026-12-01 ~ 2027-02-01.
    const scale = { minOffset: -31, maxOffset: 31 };
    const ticks = monthTicks(scale, OPEN);
    expect(ticks).toEqual([
      { label: '26년 12월', percent: 0 },
      { label: '1월', percent: 50 },
      { label: '2월', percent: 100 },
    ]);
  });

  it('오픈일과 같은 해는 연도를 안 붙인다', () => {
    const scale = { minOffset: -31, maxOffset: 31 };
    const ticks = monthTicks(scale, OPEN);
    expect(ticks.find((t) => t.label === '1월')).toBeTruthy();
    expect(ticks.find((t) => t.label === '27년 1월')).toBeFalsy();
  });

  it('해가 바뀌면 26년 처럼 연도를 붙인다', () => {
    const scale = { minOffset: -31, maxOffset: 31 };
    const ticks = monthTicks(scale, OPEN);
    expect(ticks[0].label).toBe('26년 12월');
  });

  it('빈 입력에서 안 죽는다', () => {
    expect(monthTicks(null, OPEN)).toEqual([]);
    expect(monthTicks({ minOffset: -5, maxOffset: 5 }, null)).toEqual([]);
    expect(monthTicks()).toEqual([]);
  });
});
