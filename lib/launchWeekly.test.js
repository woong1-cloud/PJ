import { describe, expect, it } from 'vitest';
import { weeklyBuckets } from './launchWeekly';

const OPEN = '2027-01-05';
const TODAY = '2026-09-02'; // 오픈까지 D-125
const task = (over = {}) => ({
  code: '01-01',
  day_offset: -60,
  status: '할 것',
  depends_on: [],
  ...over,
});

describe('weeklyBuckets', () => {
  it('결정 대기는 launch_decisions 의 대기 상태만 센다', () => {
    const decisions = [
      { id: 'd1', status: '대기' },
      { id: 'd2', status: '결정' },
      { id: 'd3', status: '보류' },
    ];
    const buckets = weeklyBuckets({ decisions, openDate: OPEN, today: TODAY });
    expect(buckets.pendingDecisions).toEqual([{ id: 'd1', status: '대기' }]);
  });

  it('나머지 네 칸은 launchTask 의 규칙 그대로다', () => {
    const tasks = [
      task({ code: 'blocked', status: '막힘', day_offset: -60 }),
      task({ code: 'late', day_offset: -130 }),
      task({ code: 'thisWeek', day_offset: -125 }),
      task({ code: 'done', status: '완료', done_at: '2026-09-01' }),
      task({ code: 'flat', day_offset: -10 }),
    ];
    const buckets = weeklyBuckets({ tasks, openDate: OPEN, today: TODAY });
    expect(buckets.blocked.map((t) => t.code)).toEqual(['blocked']);
    expect(buckets.late.map((t) => t.code)).toEqual(['late']);
    expect(buckets.thisWeek.map((t) => t.code)).toEqual(['thisWeek']);
    expect(buckets.doneThisWeek.map((t) => t.code)).toEqual(['done']);
  });

  it('막히고 기한도 지난 항목은 두 칸에 함께 든다 — 배타적이지 않다', () => {
    // LaunchBoard 의 '막힘' 보기와 '지남' 보기가 이미 이렇게 겹친다.
    // 여기서 새로 걸러내면 보드와 숫자가 갈린다.
    const tasks = [task({ code: 'both', status: '막힘', day_offset: -130 })];
    const buckets = weeklyBuckets({ tasks, openDate: OPEN, today: TODAY });
    expect(buckets.blocked.map((t) => t.code)).toEqual(['both']);
    expect(buckets.late.map((t) => t.code)).toEqual(['both']);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(weeklyBuckets()).toEqual({
      pendingDecisions: [],
      blocked: [],
      late: [],
      thisWeek: [],
      doneThisWeek: [],
    });
  });
});
