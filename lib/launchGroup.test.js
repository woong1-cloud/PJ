import { describe, expect, it } from 'vitest';
import { GROUP_MODES, groupTasks } from './launchGroup';

function task(overrides) {
  return {
    id: overrides.code,
    code: overrides.code,
    title: overrides.code,
    workstream: '01_구축',
    day_offset: 0,
    assignee_name: '',
    ...overrides,
  };
}

describe('GROUP_MODES', () => {
  it('네 가지 — 워크스트림·담당자·주·안 묶음', () => {
    expect(GROUP_MODES.map((m) => m.key)).toEqual(['workstream', 'assignee', 'week', 'none']);
  });
});

describe('groupTasks — 빈 입력', () => {
  it('빈 배열이면 빈 배열 — 죽지 않는다', () => {
    expect(groupTasks({ tasks: [], mode: 'workstream' })).toEqual([]);
    expect(groupTasks({ tasks: [], mode: 'assignee' })).toEqual([]);
    expect(groupTasks({ tasks: [], mode: 'week', openDate: '2026-09-07', today: '2026-09-10' })).toEqual([]);
    expect(groupTasks({ tasks: [], mode: 'none' })).toEqual([]);
  });

  it('tasks 가 아예 없어도 죽지 않는다', () => {
    expect(groupTasks({ mode: 'workstream' })).toEqual([]);
  });
});

describe('groupTasks — workstream', () => {
  const tasks = [
    task({ code: 'B-2', workstream: '02_운영', day_offset: 5 }),
    task({ code: 'A-1', workstream: '01_구축', day_offset: 10 }),
    task({ code: 'A-2', workstream: '01_구축', day_offset: 1 }),
    task({ code: 'B-1', workstream: '02_운영', day_offset: -1 }),
  ];

  it('워크스트림 이름순으로 묶고, 그룹 안은 기한(day_offset)순', () => {
    const groups = groupTasks({ tasks, mode: 'workstream' });
    expect(groups.map((g) => g.key)).toEqual(['01_구축', '02_운영']);
    expect(groups[0].tasks.map((t) => t.code)).toEqual(['A-2', 'A-1']);
    expect(groups[1].tasks.map((t) => t.code)).toEqual(['B-1', 'B-2']);
    expect(groups[0].count).toBe(2);
  });
});

describe('groupTasks — assignee', () => {
  const tasks = [
    task({ code: 'X-1', assignee_name: '김철수', day_offset: 3 }),
    task({ code: 'X-2', assignee_name: '', day_offset: -2 }),
    task({ code: 'X-3', assignee_name: '박영희', day_offset: 1 }),
    // 앞뒤 공백만 있는 값도 '담당자 없음' 으로 친다 — 시트에서 넘어온
    // 빈 칸이 공백 한 칸으로 들어오는 경우가 있다.
    task({ code: 'X-4', assignee_name: '   ', day_offset: 0 }),
    task({ code: 'X-5', assignee_name: '김철수', day_offset: -1 }),
  ];

  it('이름순으로 묶고, 담당자 없음은 맨 뒤', () => {
    const groups = groupTasks({ tasks, mode: 'assignee' });
    expect(groups.map((g) => g.key)).toEqual(['김철수', '박영희', '담당자 없음']);
  });

  it('담당자 없음 묶음에 빈 값과 공백 값이 함께 들어간다', () => {
    const groups = groupTasks({ tasks, mode: 'assignee' });
    const none = groups.find((g) => g.key === '담당자 없음');
    expect(none.tasks.map((t) => t.code).sort()).toEqual(['X-2', 'X-4']);
  });

  it('그룹 안은 기한순', () => {
    const groups = groupTasks({ tasks, mode: 'assignee' });
    const kim = groups.find((g) => g.key === '김철수');
    expect(kim.tasks.map((t) => t.code)).toEqual(['X-5', 'X-1']);
  });
});

describe('groupTasks — none', () => {
  it('한 묶음으로, 기한순', () => {
    const tasks = [
      task({ code: 'N-2', day_offset: 5 }),
      task({ code: 'N-1', day_offset: -3 }),
    ];
    const groups = groupTasks({ tasks, mode: 'none' });
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((t) => t.code)).toEqual(['N-1', 'N-2']);
  });
});

describe('groupTasks — week', () => {
  // 2026-09-07 은 월요일이다(lib/launchDate.test.js 와 달리 여기서는 주
  // 경계를 직접 확인해야 해서 요일을 아는 날짜로 고정한다).
  const OPEN = '2026-09-07';
  const TODAY = '2026-09-10'; // 같은 주의 목요일.

  it('월요일 시작 주 경계 — 9/10~9/13 이 한 그룹, 9/14 는 다음 그룹', () => {
    // 월·화·수(9/7~9/9)는 TODAY(9/10) 보다 이르므로 지남으로 빠진다 —
    // '지남'이 주 경계보다 앞선 규칙이라서다. 그래서 이 테스트는 오늘부터
    // 시작해 같은 주의 나머지 날과 다음 주 월요일을 비교한다.
    const tasks = [
      task({ code: 'W-today', day_offset: 3 }), // 2026-09-10 (오늘, 목)
      task({ code: 'W-sun', day_offset: 6 }), // 2026-09-13 (일, 같은 주)
      task({ code: 'W-next', day_offset: 7 }), // 2026-09-14 (다음 주 월)
    ];
    const groups = groupTasks({ tasks, mode: 'week', openDate: OPEN, today: TODAY });
    const week1 = groups.find((g) => g.tasks.some((t) => t.code === 'W-today'));
    const week2 = groups.find((g) => g.tasks.some((t) => t.code === 'W-next'));
    expect(week1.tasks.map((t) => t.code).sort()).toEqual(['W-sun', 'W-today']);
    expect(week2.tasks.map((t) => t.code)).toEqual(['W-next']);
  });

  it("주 라벨은 '9월 2주 (9/7~9/13)' 모양 — 몇 째 주인지는 그 주 일요일이 달의 며칠인지로 잰다", () => {
    const tasks = [task({ code: 'W-today', day_offset: 3 })]; // 2026-09-10, 오늘 — 지남 아님
    const groups = groupTasks({ tasks, mode: 'week', openDate: OPEN, today: TODAY });
    expect(groups[0].label).toBe('9월 2주 (9/7~9/13)');
  });

  it('기한이 오늘보다 이르면 어느 주였든 지남 한 묶음, 맨 앞', () => {
    const tasks = [
      task({ code: 'W-next', day_offset: 7 }), // 다음 주, 안 지남
      task({ code: 'W-late1', day_offset: -6 }), // 2026-09-01, 지남
      task({ code: 'W-today', day_offset: 3 }), // 2026-09-10, 오늘 — 지남 아님
      task({ code: 'W-late2', day_offset: -100 }), // 훨씬 전, 지남
    ];
    const groups = groupTasks({ tasks, mode: 'week', openDate: OPEN, today: TODAY });
    expect(groups[0].key).toBe('__late__');
    expect(groups[0].label).toBe('지남');
    expect(groups[0].tasks.map((t) => t.code).sort()).toEqual(['W-late1', 'W-late2']);
    // 당일 기한은 아직 안 지났다 — launchTask.js 의 isLate 와 같은 규칙.
    expect(groups.some((g) => g.tasks.some((t) => t.code === 'W-today' && g.key === '__late__'))).toBe(false);
  });

  it('그룹 안은 여전히 기한순', () => {
    const tasks = [
      task({ code: 'W-b', day_offset: -1 }),
      task({ code: 'W-a', day_offset: -50 }),
    ];
    const groups = groupTasks({ tasks, mode: 'week', openDate: OPEN, today: TODAY });
    expect(groups[0].tasks.map((t) => t.code)).toEqual(['W-a', 'W-b']);
  });

  it('openDate 가 없으면 기한을 못 재니 기한 없음 한 묶음으로 — 죽지 않는다', () => {
    const tasks = [task({ code: 'W-1', day_offset: 0 }), task({ code: 'W-2', day_offset: 10 })];
    const groups = groupTasks({ tasks, mode: 'week', today: TODAY });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('__nodate__');
    expect(groups[0].label).toBe('기한 없음');
    expect(groups[0].tasks).toHaveLength(2);
  });

  it('today 가 없으면 지남을 못 가려 전부 주차로만 묶인다', () => {
    const tasks = [task({ code: 'W-1', day_offset: -100 })];
    const groups = groupTasks({ tasks, mode: 'week', openDate: OPEN });
    expect(groups[0].key).not.toBe('__late__');
  });
});
