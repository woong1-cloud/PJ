import { describe, expect, it } from 'vitest';
import { dDay, dDayLabel, dueDate, launchDDay } from './launchDate';

const OPEN = '2027-01-05';

describe('dueDate', () => {
  it('오픈일에서 상대일만큼 뺀다', () => {
    expect(dueDate(OPEN, -120)).toBe('2026-09-07');
    expect(dueDate(OPEN, -60)).toBe('2026-11-06');
  });

  it('0 은 오픈일 자신', () => {
    expect(dueDate(OPEN, 0)).toBe(OPEN);
  });

  it('오픈 뒤 항목도 있다 — 시트에 D+21 까지 있다', () => {
    expect(dueDate(OPEN, 21)).toBe('2027-01-26');
  });

  it('오픈일이 바뀌면 전부 따라온다', () => {
    // 기한을 저장하지 않는 이유다. 한 줄만 바꾸면 403건이 함께 움직인다.
    expect(dueDate('2027-02-05', -120)).toBe('2026-10-08');
  });

  it('연 경계를 넘는다', () => {
    expect(dueDate('2027-01-05', -10)).toBe('2026-12-26');
  });

  it('윤년을 지난다', () => {
    // 2028-02-29 가 있는 해다.
    expect(dueDate('2028-03-05', -10)).toBe('2028-02-24');
  });

  it('읽을 수 없는 값은 null', () => {
    expect(dueDate('2027-1-5', -10)).toBe(null);
    expect(dueDate(null, -10)).toBe(null);
    expect(dueDate(OPEN, null)).toBe(null);
    expect(dueDate(OPEN, undefined)).toBe(null);
    expect(dueDate(OPEN, '-10')).toBe(null);
  });

  it('없는 날짜는 null — 2월 30일이 3월로 넘어가지 않는다', () => {
    expect(dueDate('2027-02-30', 0)).toBe(null);
  });
});

describe('dDay', () => {
  it('남은 날은 양수, 지난 날은 음수', () => {
    expect(dDay('2026-09-10', '2026-09-02')).toBe(8);
    expect(dDay('2026-08-30', '2026-09-02')).toBe(-3);
  });

  it('같은 날은 0', () => {
    expect(dDay('2026-09-02', '2026-09-02')).toBe(0);
  });

  it('읽을 수 없으면 null', () => {
    expect(dDay('깨진값', '2026-09-02')).toBe(null);
    expect(dDay('2026-09-02', null)).toBe(null);
  });
});

describe('dDayLabel', () => {
  it('0 은 D-DAY — D-0 이라고 쓰면 하루 남은 것처럼 읽힌다', () => {
    expect(dDayLabel(0)).toBe('D-DAY');
  });

  it('남았으면 D-, 지났으면 D+', () => {
    expect(dDayLabel(125)).toBe('D-125');
    expect(dDayLabel(-3)).toBe('D+3');
  });

  it('숫자가 아니면 null', () => {
    expect(dDayLabel(null)).toBe(null);
    expect(dDayLabel('125')).toBe(null);
  });
});

describe('launchDDay', () => {
  it('오픈까지 며칠인지 한 번에', () => {
    expect(launchDDay('2027-01-05', '2026-09-02')).toBe('D-125');
  });

  it('오픈이 지났으면 D+', () => {
    expect(launchDDay('2026-09-01', '2026-09-02')).toBe('D+1');
  });
});
