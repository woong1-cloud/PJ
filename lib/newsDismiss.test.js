import { describe, expect, it } from 'vitest';
import { shouldOpenDialog } from './newsDismiss';

const unseen = [
  { date: '2026-08-30', title: 'C' },
  { date: '2026-08-28', title: 'B' },
];

describe('shouldOpenDialog', () => {
  it('닫은 적이 없으면 띄운다', () => {
    expect(shouldOpenDialog(unseen, null)).toBe(true);
  });

  it('닫은 뒤 더 새 소식이 나오면 다시 띄운다', () => {
    // 이게 날짜로 저장하는 이유다. 불린이었다면 한 번 X 한 사람에게 다음
    // 배포의 팝업도 영영 안 뜬다.
    expect(shouldOpenDialog(unseen, '2026-08-28')).toBe(true);
  });

  it('가장 새 소식까지 닫았으면 안 띄운다', () => {
    expect(shouldOpenDialog(unseen, '2026-08-30')).toBe(false);
  });

  it('저장값이 소식보다 나중이어도 안 띄운다', () => {
    expect(shouldOpenDialog(unseen, '2026-09-01')).toBe(false);
  });

  it('안 본 소식이 없으면 저장값과 무관하게 안 띄운다', () => {
    // 점이 없는데 팝업만 뜨는 상태를 막는다.
    expect(shouldOpenDialog([], null)).toBe(false);
    expect(shouldOpenDialog([], '2026-01-01')).toBe(false);
  });

  it('읽을 수 없는 저장값은 안 닫힌 것으로 본다', () => {
    // 한 번 더 보는 쪽이 영영 못 보는 쪽보다 가볍다.
    expect(shouldOpenDialog(unseen, '깨진값')).toBe(true);
    expect(shouldOpenDialog(unseen, '2026-8-30')).toBe(true);
    expect(shouldOpenDialog(unseen, true)).toBe(true);
  });

  it('목록이 아니어도 죽지 않는다', () => {
    expect(shouldOpenDialog(undefined, null)).toBe(false);
    expect(shouldOpenDialog(null, '2026-08-30')).toBe(false);
  });

  it('맨 앞이 가장 새 것이라고 믿는다 — unseenNews 가 내림차순으로 준다', () => {
    expect(shouldOpenDialog([{ date: '2026-08-30' }], '2026-08-29')).toBe(true);
    expect(shouldOpenDialog([{ date: '2026-08-30' }], '2026-08-30')).toBe(false);
  });
});
