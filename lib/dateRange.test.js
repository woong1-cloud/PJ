import { describe, expect, it } from 'vitest';
import { REQUEST_RANGES, REQUEST_RANGE_LABELS, requestDateRange } from './dateRange';

describe('requestDateRange', () => {
  it('이번 주는 월요일부터 오늘까지', () => {
    // 2026-08-28 은 금요일이다.
    expect(requestDateRange('thisWeek', '2026-08-28')).toEqual({
      from: '2026-08-24',
      to: '2026-08-28',
    });
  });

  it('월요일에는 오늘 하루', () => {
    expect(requestDateRange('thisWeek', '2026-08-24')).toEqual({
      from: '2026-08-24',
      to: '2026-08-24',
    });
  });

  it('일요일은 그 주의 끝이다 — 다음 주가 아니다', () => {
    // getUTCDay() 가 일요일을 0 으로 주므로, 보정을 빠뜨리면 이번 주가
    // 내일부터 시작해서 결과가 0건이 된다.
    expect(requestDateRange('thisWeek', '2026-08-30')).toEqual({
      from: '2026-08-24',
      to: '2026-08-30',
    });
  });

  it('주가 달을 넘어가도 맞는다', () => {
    // 2026-09-01 은 화요일. 그 주 월요일은 8월 31일이다.
    expect(requestDateRange('thisWeek', '2026-09-01')).toEqual({
      from: '2026-08-31',
      to: '2026-09-01',
    });
  });

  it('이번 달은 1일부터 오늘까지', () => {
    expect(requestDateRange('thisMonth', '2026-08-28')).toEqual({
      from: '2026-08-01',
      to: '2026-08-28',
    });
  });

  it('지난 달은 1일부터 말일까지 — 31일', () => {
    expect(requestDateRange('lastMonth', '2026-09-15')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('지난 달 말일이 30일', () => {
    expect(requestDateRange('lastMonth', '2026-05-02')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('지난 달 말일이 28일', () => {
    expect(requestDateRange('lastMonth', '2026-03-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('윤년 2월은 29일', () => {
    expect(requestDateRange('lastMonth', '2028-03-10')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });

  it('1월이면 지난 달은 작년 12월', () => {
    expect(requestDateRange('lastMonth', '2026-01-05')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('최근 3개월은 90일 전부터', () => {
    expect(requestDateRange('last3Months', '2026-08-28')).toEqual({
      from: '2026-05-30',
      to: '2026-08-28',
    });
  });

  it('모르는 키는 null — 주소를 손으로 고쳐도 아무 범위나 안 걸린다', () => {
    expect(requestDateRange('lastYear', '2026-08-28')).toBe(null);
    expect(requestDateRange('', '2026-08-28')).toBe(null);
    expect(requestDateRange(null, '2026-08-28')).toBe(null);
  });

  it('오늘이 없거나 형식이 틀리면 null', () => {
    // 여기서 조용히 오늘 날짜를 만들어 쓰면 서버에서 UTC 기준이 되어
    // 한국 시각 자정 직후에 하루가 어긋난다.
    expect(requestDateRange('thisWeek', undefined)).toBe(null);
    expect(requestDateRange('thisWeek', '2026-8-28')).toBe(null);
    expect(requestDateRange('thisWeek', '오늘')).toBe(null);
  });

  it('없는 날짜는 null — 2월 30일 같은 것이 3월로 넘어가지 않는다', () => {
    expect(requestDateRange('thisMonth', '2026-02-30')).toBe(null);
  });

  it('from 은 to 보다 나중일 수 없다', () => {
    for (const key of REQUEST_RANGES) {
      const r = requestDateRange(key, '2026-08-28');
      expect(r.from <= r.to, key).toBe(true);
    }
  });
});

describe('REQUEST_RANGE_LABELS', () => {
  it('모든 키에 이름이 있다 — 없으면 셀렉트에 빈 칸이 뜬다', () => {
    for (const key of REQUEST_RANGES) {
      expect(REQUEST_RANGE_LABELS[key], key).toBeTruthy();
    }
  });
});
