import { describe, it, expect } from 'vitest';
import { isOverdue, toLocalDateString } from './overdue';
import { CLOSED_STATUSES } from './statuses';

describe('isOverdue', () => {
  const TODAY = '2026-07-29';

  it('예상일이 없으면 지연이 아니다', () => {
    expect(isOverdue(null, '개발중', TODAY)).toBe(false);
  });

  it('예상일이 미래면 지연이 아니다', () => {
    expect(isOverdue('2026-08-14', '개발중', TODAY)).toBe(false);
  });

  it('예상일이 오늘이면 아직 지연이 아니다', () => {
    expect(isOverdue(TODAY, '개발중', TODAY)).toBe(false);
  });

  it('예상일이 지났고 미완료면 지연이다', () => {
    expect(isOverdue('2026-07-25', '개발중', TODAY)).toBe(true);
  });

  it('완료된 건은 예상일이 지났어도 지연이 아니다', () => {
    expect(isOverdue('2026-07-25', '완료', TODAY)).toBe(false);
  });

  it('병합된 건은 예상일이 지났어도 지연이 아니다', () => {
    expect(isOverdue('2026-07-25', '중복', TODAY)).toBe(false);
  });

  it('반려된 건은 예상일이 지났어도 지연이 아니다', () => {
    expect(isOverdue('2026-07-25', '반려', TODAY)).toBe(false);
  });

  it('취소된 건은 예상일이 지났어도 지연이 아니다', () => {
    expect(isOverdue('2026-07-25', '취소', TODAY)).toBe(false);
  });

  // 종결 상태가 하나라도 빠지면 "아무도 하지 않기로 한 일"이 지연으로 뜬다.
  it('모든 종결 상태가 지연 판정에서 빠진다', () => {
    for (const status of CLOSED_STATUSES) {
      expect(isOverdue('2026-07-25', status, TODAY), `${status}`).toBe(false);
    }
  });
});

describe('toLocalDateString', () => {
  it('지역 시간 기준으로 YYYY-MM-DD 를 만든다', () => {
    expect(toLocalDateString(new Date(2026, 6, 29, 14, 30))).toBe('2026-07-29');
  });

  it('월과 일을 두 자리로 채운다', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  // 이 테스트가 존재하는 이유: toISOString() 을 쓰면 한국 시간 자정~오전 9시에
  // 하루 전 날짜가 나온다. 그 시간대에 만든 '오늘'로 지연을 판정하면 어제가
  // 예상일인 건이 오전 내내 정상으로 보인다.
  it('자정 직후에도 그날 날짜를 돌려준다 (UTC 로 밀리지 않는다)', () => {
    const justAfterMidnight = new Date(2026, 6, 29, 0, 30);
    expect(toLocalDateString(justAfterMidnight)).toBe('2026-07-29');
    expect(justAfterMidnight.toISOString().slice(0, 10)).not.toBe('2026-07-29');
  });
});
