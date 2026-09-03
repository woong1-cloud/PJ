import { describe, expect, it } from 'vitest';
import { LAUNCH_KINDS, defaultWorkstreams, excludedPrefixes } from './launchKind';

const WS = ['01_신규법인', '02_양수·라이선스', '06_채널별입점', '18_플랫폼구축'];

describe('LAUNCH_KINDS', () => {
  it('셋이다', () => {
    expect(LAUNCH_KINDS).toEqual(['신규 법인', '양수·라이선스', '기존 법인 내 신규 브랜드']);
  });
});

describe('defaultWorkstreams', () => {
  it('신규 법인은 전부 가져온다 — 가이드가 이 기준으로 쓰였다', () => {
    expect(defaultWorkstreams({ kind: '신규 법인', workstreams: WS })).toEqual(WS);
  });

  it('양수·라이선스는 01 을 뺀다', () => {
    expect(defaultWorkstreams({ kind: '양수·라이선스', workstreams: WS })).toEqual([
      '02_양수·라이선스',
      '06_채널별입점',
      '18_플랫폼구축',
    ]);
  });

  it('기존 법인 내 신규 브랜드는 01·02 를 뺀다', () => {
    // 실제로 52건이 빠진다. 안 빼면 그것을 손으로 지우면서 시작한다.
    expect(defaultWorkstreams({ kind: '기존 법인 내 신규 브랜드', workstreams: WS })).toEqual([
      '06_채널별입점',
      '18_플랫폼구축',
    ]);
  });

  it('모르는 유형이면 아무것도 안 뺀다', () => {
    // 매핑이 어긋났을 때 조용히 항목이 사라지는 것보다, 전부 들어오고
    // 사람이 빼는 쪽이 안전하다.
    expect(defaultWorkstreams({ kind: '알 수 없음', workstreams: WS })).toEqual(WS);
    expect(defaultWorkstreams({ workstreams: WS })).toEqual(WS);
  });

  it('가이드에 그 워크스트림이 없으면 그냥 없는 대로 둔다', () => {
    const only = ['06_채널별입점'];
    expect(defaultWorkstreams({ kind: '기존 법인 내 신규 브랜드', workstreams: only })).toEqual(
      only,
    );
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(defaultWorkstreams({})).toEqual([]);
    expect(defaultWorkstreams()).toEqual([]);
  });
});

describe('excludedPrefixes', () => {
  it('유형마다 다르다', () => {
    expect(excludedPrefixes('신규 법인')).toEqual([]);
    expect(excludedPrefixes('기존 법인 내 신규 브랜드')).toEqual(['01', '02']);
    expect(excludedPrefixes(undefined)).toEqual([]);
  });
});
