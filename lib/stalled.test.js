import { describe, expect, it } from 'vitest';
import { STALL_DAYS, groupByRequirement, lastActivityAt, stalledDays } from './stalled';

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
