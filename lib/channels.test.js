import { describe, it, expect } from 'vitest';
import { CHANNELS, DEFAULT_CHANNEL } from './channels';

describe('CHANNELS', () => {
  // 이 목록은 0009 마이그레이션의 CHECK 제약과 짝이다. 여기에만 값을 더하면
  // 화면에서는 고를 수 있는데 저장할 때 DB가 거절한다.
  it('0009 CHECK 제약과 같은 목록이다', () => {
    expect(CHANNELS).toEqual(['자사몰', '오프라인', '외부몰', '공통', '기타']);
  });

  it('기본값이 목록 안에 있다', () => {
    expect(CHANNELS).toContain(DEFAULT_CHANNEL);
  });
});
