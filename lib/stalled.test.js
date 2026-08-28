import { describe, expect, it } from 'vitest';
import {
  HOLD_STALL_DAYS,
  STALL_DAYS,
  groupByRequirement,
  isStalled,
  lastActivityAt,
  stallThreshold,
  stalledDays,
} from './stalled';
import { CLOSED_STATUSES } from './statuses';

const NOW = '2026-08-26T00:00:00Z';
const req = (over = {}) => ({
  id: 'r1',
  status: '검토대기',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
});

describe('lastActivityAt', () => {
  it('로그도 코멘트도 없으면 생성 시각', () => {
    expect(lastActivityAt({ requirement: req() })).toBe('2026-08-01T00:00:00Z');
  });

  it('변경 로그가 있으면 그중 가장 나중', () => {
    const got = lastActivityAt({
      requirement: req(),
      changeLogs: [{ created_at: '2026-08-05T00:00:00Z' }, { created_at: '2026-08-10T00:00:00Z' }],
    });
    expect(got).toBe('2026-08-10T00:00:00Z');
  });

  it('코멘트가 로그보다 나중이면 코멘트 시각', () => {
    const got = lastActivityAt({
      requirement: req(),
      changeLogs: [{ created_at: '2026-08-10T00:00:00Z' }],
      comments: [{ created_at: '2026-08-20T00:00:00Z' }],
    });
    expect(got).toBe('2026-08-20T00:00:00Z');
  });

  it('읽을 수 없는 시각은 무시한다', () => {
    const got = lastActivityAt({
      requirement: req(),
      changeLogs: [{ created_at: null }, { created_at: '깨진값' }],
    });
    expect(got).toBe('2026-08-01T00:00:00Z');
  });
});

describe('stalledDays', () => {
  it('마지막 활동 이후 경과일', () => {
    expect(stalledDays({ requirement: req(), now: NOW })).toBe(25);
  });

  it('종결 상태는 정체가 아니다', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(stalledDays({ requirement: req({ status }), now: NOW })).toBeNull();
    }
  });

  it('경계: 정확히 STALL_DAYS 는 안건에 든다', () => {
    const created = '2026-08-12T00:00:00Z';
    expect(stalledDays({ requirement: req({ created_at: created }), now: NOW })).toBe(STALL_DAYS);
  });

  it('요구사항이 없으면 null', () => {
    expect(stalledDays({ requirement: null, now: NOW })).toBeNull();
  });
});

describe('groupByRequirement', () => {
  it('requirement_id 로 묶는다', () => {
    const got = groupByRequirement([
      { requirement_id: 'a', created_at: '1' },
      { requirement_id: 'b', created_at: '2' },
      { requirement_id: 'a', created_at: '3' },
    ]);
    expect(got.get('a')).toHaveLength(2);
    expect(got.get('b')).toHaveLength(1);
  });

  it('id 없는 행은 버린다', () => {
    expect(groupByRequirement([{ created_at: '1' }]).size).toBe(0);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(groupByRequirement(null).size).toBe(0);
  });
});

describe('보류는 종결이면서 정체를 잰다', () => {
  const base = { created_at: '2026-06-01T00:00:00Z' };
  const now = '2026-08-28T00:00:00Z';

  it('보류는 null 이 아니다 — 미뤄둔 것이지 끝난 것이 아니다', () => {
    const days = stalledDays({ requirement: { ...base, status: '보류' }, now });
    expect(days).toBe(88);
  });

  it('나머지 종결 넷은 여전히 null', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(stalledDays({ requirement: { ...base, status }, now }), status).toBe(null);
    }
  });

  it('보류가 CLOSED_STATUSES 에 들어 있다 — 목록 숨김과 회의 제외는 그대로다', () => {
    expect(CLOSED_STATUSES).toContain('보류');
  });
});

describe('stallThreshold', () => {
  it('보통 상태는 14일', () => {
    expect(stallThreshold('검토대기')).toBe(STALL_DAYS);
  });

  it('보류는 60일', () => {
    // 14일이면 보류한 다음 주에 다시 안건에 오른다 — 보류가 아무 일도 안 한
    // 셈이 된다.
    expect(stallThreshold('보류')).toBe(HOLD_STALL_DAYS);
    expect(HOLD_STALL_DAYS).toBeGreaterThan(STALL_DAYS);
  });
});

describe('isStalled', () => {
  it('보통 상태는 14일부터', () => {
    expect(isStalled({ status: '검토대기', stalledDays: 13 })).toBe(false);
    expect(isStalled({ status: '검토대기', stalledDays: 14 })).toBe(true);
  });

  it('보류는 60일부터 — 59일은 아직 아니다', () => {
    expect(isStalled({ status: '보류', stalledDays: 59 })).toBe(false);
    expect(isStalled({ status: '보류', stalledDays: 60 })).toBe(true);
  });

  it('보류 30일은 보통 상태라면 정체지만 보류라서 아니다', () => {
    // 이 한 줄이 이 함수를 만든 이유다. 비교가 네 곳에 흩어져 있으면 보류가
    // 어디선 정체이고 어디선 아닌 화면이 된다.
    expect(isStalled({ status: '검토대기', stalledDays: 30 })).toBe(true);
    expect(isStalled({ status: '보류', stalledDays: 30 })).toBe(false);
  });

  it('null·undefined 는 정체가 아니다 — "모른다"가 아니라 "아니다"', () => {
    expect(isStalled({ status: '검토대기', stalledDays: null })).toBe(false);
    expect(isStalled({ status: '검토대기', stalledDays: undefined })).toBe(false);
    expect(isStalled({})).toBe(false);
    expect(isStalled()).toBe(false);
  });
});
