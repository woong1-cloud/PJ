import { describe, expect, it } from 'vitest';
import {
  byCode,
  chainUp,
  depCodes,
  linksOf,
  missingDeps,
  nextTasks,
  prevTasks,
  scheduleConflicts,
  unlockCount,
} from './launchDeps';

const t = (code, over = {}) => ({
  code,
  title: `${code} 제목`,
  day_offset: -100,
  status: '할 것',
  depends_on: [],
  ...over,
});

// 실제 자료의 모양을 줄여 옮긴 것. 01-01 → 01-02 → 01-03 한 줄에
// 01-02 를 기다리는 것이 셋.
const SAMPLE = [
  t('01-01'),
  t('01-02', { depends_on: ['01-01'], day_offset: -95 }),
  t('01-03', { depends_on: ['01-02'], day_offset: -90 }),
  t('01-18', { depends_on: ['01-02'], day_offset: -70 }),
  t('03-01', { depends_on: ['01-02'], day_offset: -75 }),
];

describe('depCodes', () => {
  it('배열이 아니면 빈 목록이다', () => {
    // 서버는 text[] not null default '{}' 이지만 새 항목을 만드는 중의
    // 폼 상태에서는 undefined 가 온다.
    expect(depCodes({ depends_on: null })).toEqual([]);
    expect(depCodes({})).toEqual([]);
    expect(depCodes(undefined)).toEqual([]);
  });

  it('빈 문자열은 뺀다 — 쉼표 목록에서 남는다', () => {
    expect(depCodes({ depends_on: ['01-01', '', null] })).toEqual(['01-01']);
  });
});

describe('byCode', () => {
  it('코드로 찾는 지도를 만든다', () => {
    expect(byCode(SAMPLE).get('01-02').day_offset).toBe(-95);
  });

  it('코드가 겹치면 먼저 온 것을 쓴다', () => {
    const map = byCode([t('01-01', { title: '먼저' }), t('01-01', { title: '나중' })]);
    expect(map.get('01-01').title).toBe('먼저');
  });
});

describe('missingDeps', () => {
  it('목록에 없는 선행 코드를 준다', () => {
    // 실제로 4건이 이렇다 — 08-10 이 없는 10-11 을 가리킨다.
    const task = t('08-10', { depends_on: ['10-11'] });
    expect(missingDeps({ task, tasks: SAMPLE })).toEqual(['10-11']);
  });

  it('다 있으면 빈 목록이다', () => {
    expect(missingDeps({ task: SAMPLE[1], tasks: SAMPLE })).toEqual([]);
  });
});

describe('prevTasks', () => {
  it('없는 코드는 task: null 로 자리를 남긴다', () => {
    const task = t('08-10', { depends_on: ['01-01', '10-11'] });
    expect(prevTasks({ task, tasks: SAMPLE })).toEqual([
      { code: '01-01', task: SAMPLE[0] },
      { code: '10-11', task: null },
    ]);
  });
});

describe('nextTasks', () => {
  it('이 코드를 기다리는 것을 기한순으로 준다', () => {
    const next = nextTasks({ task: SAMPLE[1], tasks: SAMPLE });
    expect(next.map((x) => x.code)).toEqual(['01-03', '03-01', '01-18']);
  });

  it('해당없음은 빼고 센다', () => {
    // 안 하기로 한 일이 '풀림'에 잡히면 그 숫자가 우선순위를 잘못 가리킨다.
    const tasks = [...SAMPLE, t('09-01', { depends_on: ['01-02'], status: '해당없음' })];
    expect(nextTasks({ task: SAMPLE[1], tasks }).map((x) => x.code)).not.toContain('09-01');
  });

  it('코드가 없으면 빈 목록이다 — 만들기 중인 항목', () => {
    expect(nextTasks({ task: t(undefined), tasks: SAMPLE })).toEqual([]);
  });
});

describe('unlockCount', () => {
  it('안 끝난 후행만 센다', () => {
    expect(unlockCount({ task: SAMPLE[1], tasks: SAMPLE })).toBe(3);
  });

  it('완료된 후행은 안 센다 — 끝난 일을 풀어 줄 수는 없다', () => {
    const tasks = SAMPLE.map((x) => (x.code === '01-03' ? { ...x, status: '완료' } : x));
    expect(unlockCount({ task: SAMPLE[1], tasks })).toBe(2);
  });
});

describe('chainUp', () => {
  it('뿌리부터 바로 위 선행까지 준다', () => {
    const { line, branched } = chainUp({ task: SAMPLE[2], tasks: SAMPLE });
    expect(line.map((x) => x.code)).toEqual(['01-01', '01-02']);
    expect(branched).toBe(false);
  });

  it('선행이 없으면 빈 줄이다', () => {
    expect(chainUp({ task: SAMPLE[0], tasks: SAMPLE }).line).toEqual([]);
  });

  it('선행이 둘이면 멈추고 알린다', () => {
    // 지금 자료에는 없지만 열은 text[] 이라 언제든 들어온다. 한 줄로
    // 못 그리는 것을 한 줄로 그리면 나머지가 화면에서 사라진다.
    const task = t('09-01', { depends_on: ['01-01', '01-02'] });
    const { line, branched } = chainUp({ task, tasks: SAMPLE });
    expect(line).toEqual([]);
    expect(branched).toBe(true);
  });

  it('끊긴 자리를 줄 맨 앞에 남긴다', () => {
    const task = t('08-10', { depends_on: ['10-11'] });
    const { line } = chainUp({ task, tasks: SAMPLE });
    expect(line).toEqual([{ code: '10-11', task: null }]);
  });

  it('고리가 있어도 안 돈다', () => {
    const a = t('A-01', { depends_on: ['B-01'] });
    const b = t('B-01', { depends_on: ['A-01'] });
    const { line } = chainUp({ task: a, tasks: [a, b] });
    expect(line.map((x) => x.code)).toEqual(['B-01']);
  });

  it('아홉 단짜리도 끝까지 올라간다', () => {
    // 실제 가장 긴 줄이 9단이다(14-01 → … → 14-13).
    const chain = Array.from({ length: 9 }, (_, i) =>
      t(`14-0${i}`, i === 0 ? {} : { depends_on: [`14-0${i - 1}`] }),
    );
    const { line } = chainUp({ task: chain[8], tasks: chain });
    expect(line).toHaveLength(8);
    expect(line[0].code).toBe('14-00');
  });
});

describe('linksOf', () => {
  it('창 하나에 필요한 것을 한 번에 준다', () => {
    const links = linksOf({ task: SAMPLE[1], tasks: SAMPLE });
    expect(links.prev.map((x) => x.code)).toEqual(['01-01']);
    expect(links.missing).toEqual([]);
    expect(links.up.line.map((x) => x.code)).toEqual(['01-01']);
    expect(links.next.map((x) => x.code)).toEqual(['01-03', '03-01', '01-18']);
    expect(links.unlock).toBe(3);
  });
});

describe('scheduleConflicts', () => {
  const tasks = [
    t('01-05', { day_offset: -90 }),
    t('01-06', { day_offset: -95, depends_on: ['01-05'] }),
    t('01-07', { day_offset: -70, depends_on: ['01-05'] }),
    t('09-01', { day_offset: -120, depends_on: ['01-05'], status: '해당없음' }),
  ];

  it('선행이 나보다 늦으면 잡는다', () => {
    // 실제로 있었던 일이다 — 01-05 를 D-95 에서 D-90 으로 미루자
    // 그것을 기다리는 01-06(D-95)이 선행보다 앞서 버렸다.
    const r = scheduleConflicts({
      code: '01-06', dayOffset: -95, dependsOn: ['01-05'], tasks,
    });
    expect(r.lateDeps.map((x) => x.code)).toEqual(['01-05']);
    expect(r.earlyFollowers).toEqual([]);
  });

  it('후행이 나보다 이르면 잡는다 — 미루는 쪽에서 보이게', () => {
    const r = scheduleConflicts({
      code: '01-05', dayOffset: -90, dependsOn: [], tasks,
    });
    expect(r.earlyFollowers.map((x) => x.code)).toEqual(['01-06']);
  });

  it('해당없음은 양쪽 다 뺀다', () => {
    // 09-01 은 D-120 이라 01-05(D-90)보다 이르지만 안 할 일이다.
    const r = scheduleConflicts({ code: '01-05', dayOffset: -90, dependsOn: [], tasks });
    expect(r.earlyFollowers.map((x) => x.code)).not.toContain('09-01');
  });

  it('어긋난 것이 없으면 둘 다 빈 목록', () => {
    const r = scheduleConflicts({
      code: '01-06', dayOffset: -85, dependsOn: ['01-05'], tasks,
    });
    expect(r).toEqual({ lateDeps: [], earlyFollowers: [] });
  });

  it('만들기 중이라 코드가 없으면 후행은 안 본다', () => {
    const r = scheduleConflicts({ dayOffset: -90, dependsOn: ['01-05'], tasks });
    expect(r.earlyFollowers).toEqual([]);
  });

  it('D-day 가 숫자가 아니면 아무것도 안 잡는다 — 입력 중이다', () => {
    expect(scheduleConflicts({ code: '01-06', dayOffset: NaN, dependsOn: ['01-05'], tasks }))
      .toEqual({ lateDeps: [], earlyFollowers: [] });
  });
});
