import { describe, expect, it } from 'vitest';
import { isWorkstream, nextCode, workstreamPrefix } from './launchCode';

describe('isWorkstream · workstreamPrefix', () => {
  it('시트 이름 모양이어야 한다', () => {
    expect(isWorkstream('01_신규법인')).toBe(true);
    expect(isWorkstream('18_플랫폼구축')).toBe(true);
    expect(workstreamPrefix('01_신규법인')).toBe('01');
  });

  it('앞 두 자리가 없으면 아니다', () => {
    // 코드의 앞자리를 여기서 얻으므로, 없으면 코드를 지을 수 없다.
    expect(isWorkstream('신규법인')).toBe(false);
    expect(isWorkstream('1_신규법인')).toBe(false);
    expect(isWorkstream('01_')).toBe(false);
    expect(workstreamPrefix('신규법인')).toBe(null);
  });

  it('빈 값에서 죽지 않는다', () => {
    expect(isWorkstream('')).toBe(false);
    expect(isWorkstream(null)).toBe(false);
    expect(workstreamPrefix(undefined)).toBe(null);
  });
});

describe('nextCode', () => {
  it('빈 워크스트림이면 01', () => {
    expect(nextCode({ workstream: '01_신규법인', existingCodes: [] })).toBe('01-01');
  });

  it('그 워크스트림의 가장 큰 번호 다음', () => {
    expect(
      nextCode({ workstream: '01_신규법인', existingCodes: ['01-01', '01-02', '01-03'] }),
    ).toBe('01-04');
  });

  it('다른 워크스트림 코드는 안 센다', () => {
    expect(nextCode({ workstream: '02_양수', existingCodes: ['01-01', '01-27'] })).toBe('02-01');
  });

  it('빈자리를 메우지 않는다', () => {
    // 01-02 를 지웠어도 다음은 01-04 다. 지운 코드를 되쓰면 옛 기록이 다른
    // 항목을 가리키게 된다.
    expect(nextCode({ workstream: '01_신규법인', existingCodes: ['01-01', '01-03'] })).toBe(
      '01-04',
    );
  });

  it('순서가 뒤죽박죽이어도 최대값을 본다', () => {
    expect(nextCode({ workstream: '01_신규법인', existingCodes: ['01-09', '01-02'] })).toBe(
      '01-10',
    );
  });

  it('코드 모양이 아닌 값은 무시한다', () => {
    expect(nextCode({ workstream: '01_신규법인', existingCodes: ['없음', '', null, '01-01'] })).toBe(
      '01-02',
    );
  });

  it('워크스트림 모양이 아니면 null', () => {
    expect(nextCode({ workstream: '신규법인', existingCodes: [] })).toBe(null);
    expect(nextCode({})).toBe(null);
    expect(nextCode()).toBe(null);
  });

  it('99를 넘으면 null — 조용히 세 자리로 늘어나면 모양이 깨진다', () => {
    expect(nextCode({ workstream: '01_신규법인', existingCodes: ['01-99'] })).toBe(null);
  });
});
