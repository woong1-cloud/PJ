import { describe, expect, it } from 'vitest';
import { dDay, dDayLabel, dueDate, launchDDay, offsetFromDate } from './launchDate';

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

describe('offsetFromDate', () => {
  it('dueDate 의 반대다', () => {
    expect(offsetFromDate('2027-01-01', '2026-10-03')).toBe(-90);
    expect(offsetFromDate('2027-01-01', '2027-01-01')).toBe(0);
    expect(offsetFromDate('2027-01-01', '2027-01-08')).toBe(7);
  });

  it('dueDate 와 왕복한다 — 둘이 어긋나면 칸 둘이 서로를 덮어쓴다', () => {
    // 항목 창에서 숫자칸과 달력칸이 서로를 갱신하므로, 왕복이 안 되면
    // 값이 한 칸씩 밀리며 튄다.
    for (const n of [-120, -91, -1, 0, 7, 30]) {
      expect(offsetFromDate('2027-01-01', dueDate('2027-01-01', n))).toBe(n);
    }
  });

  it('오픈일에 서머타임이 껴도 UTC 로만 센다', () => {
    // 로컬 시간대를 태우면 하루가 어긋난다. 487건에서 그 하루가 여기저기
    // 다르게 나타나면 원인을 못 찾는다.
    expect(offsetFromDate('2026-03-08', '2026-03-09')).toBe(1);
    expect(offsetFromDate('2026-11-01', '2026-11-02')).toBe(1);
  });

  it('형식이 틀리거나 비면 null', () => {
    expect(offsetFromDate('2027-01-01', '')).toBe(null);
    expect(offsetFromDate('2027-01-01', '2027-02-30')).toBe(null);
    expect(offsetFromDate(null, '2026-10-03')).toBe(null);
  });
});
