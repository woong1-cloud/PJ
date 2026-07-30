import { describe, it, expect } from 'vitest';
import { assertDateOrder, parseDateInput } from './projectDates';

describe('parseDateInput', () => {
  it('올바른 날짜는 그대로 통과한다', () => {
    expect(parseDateInput('2026-08-31')).toBe('2026-08-31');
  });

  // PATCH 에서 이 구분이 깨지면 이름만 고치려던 요청이 날짜를 지운다.
  it('안 보낸 것(undefined)과 비우는 것(null)을 구분한다', () => {
    expect(parseDateInput(undefined)).toBeUndefined();
    expect(parseDateInput(null)).toBeNull();
    // 빈 date 입력칸은 '' 를 보낸다. 비우는 뜻이다.
    expect(parseDateInput('')).toBeNull();
  });

  it('형식이 틀리면 400으로 거절한다', () => {
    expect(() => parseDateInput('2026/08/31')).toThrow('날짜 형식');
    expect(() => parseDateInput('26-08-31')).toThrow('날짜 형식');
    expect(() => parseDateInput('2026-8-3')).toThrow('날짜 형식');
    expect(() => parseDateInput(20260831)).toThrow('날짜 형식');
  });

  it('거절할 때 상태 코드는 400이다', () => {
    try {
      parseDateInput('내일');
      throw new Error('던져야 한다');
    } catch (e) {
      expect(e.status).toBe(400);
    }
  });
});

describe('assertDateOrder', () => {
  it('시작일이 목표일보다 빠르거나 같으면 통과한다', () => {
    expect(() => assertDateOrder('2026-07-01', '2026-08-31')).not.toThrow();
    expect(() => assertDateOrder('2026-07-01', '2026-07-01')).not.toThrow();
  });

  it('뒤집혀 있으면 거절한다', () => {
    expect(() => assertDateOrder('2026-08-31', '2026-07-01')).toThrow('목표일');
  });

  // 한쪽만 정해진 프로젝트는 정상이다(마일스톤). 여기서 막으면 목표일만
  // 먼저 잡는 흔한 흐름이 통째로 불가능해진다.
  it('한쪽이 비어 있으면 비교하지 않는다', () => {
    expect(() => assertDateOrder(null, '2026-07-01')).not.toThrow();
    expect(() => assertDateOrder('2026-07-01', null)).not.toThrow();
    expect(() => assertDateOrder(null, null)).not.toThrow();
    expect(() => assertDateOrder(undefined, undefined)).not.toThrow();
  });
});
