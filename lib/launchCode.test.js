import { describe, expect, it } from 'vitest';
import { codePrefix, isWorkstream, nextCode } from './launchCode';

// 통합 WBS 의 실제 모양. 워크스트림 이름의 숫자와 코드 앞자리가 다르다 —
// 열아홉 개 중 맞는 것이 하나도 없다.
const HOKA = [
  { code: '01-01', workstream: 'D01_법인·행정' },
  { code: '01-27', workstream: 'D01_법인·행정' },
  { code: '07B-01', workstream: 'D08_WMS·재고' },
  { code: '07B-26', workstream: 'D08_WMS·재고' },
  { code: '10A-01', workstream: 'D11_자사몰연결' },
  { code: '16-18', workstream: 'D17_앱(네이티브)' },
];

describe('isWorkstream', () => {
  it('비어 있지만 않으면 된다', () => {
    // 예전에는 '01_신규법인' 모양을 요구했고, 그래서 통합 WBS 의
    // D01~D19 열아홉 개가 하나도 통과하지 못했다 — '＋ 항목'이 아예
    // 동작하지 않았다. 이름 규칙에 기대지 않는다.
    expect(isWorkstream('D01_법인·행정')).toBe(true);
    expect(isWorkstream('01_신규법인')).toBe(true);
    expect(isWorkstream('번호 없는 이름')).toBe(true);
  });

  it('빈 값은 아니다', () => {
    expect(isWorkstream('')).toBe(false);
    expect(isWorkstream('   ')).toBe(false);
    expect(isWorkstream(null)).toBe(false);
    expect(isWorkstream(undefined)).toBe(false);
    expect(isWorkstream(12)).toBe(false);
  });
});

describe('codePrefix', () => {
  it('이름이 아니라 그 워크스트림의 항목에게 묻는다', () => {
    // D08_WMS·재고 의 코드는 07B 다. 이름에서 뽑으면 08 이 되어 틀린다.
    expect(codePrefix({ workstream: 'D08_WMS·재고', existing: HOKA })).toBe('07B');
    expect(codePrefix({ workstream: 'D11_자사몰연결', existing: HOKA })).toBe('10A');
    expect(codePrefix({ workstream: 'D17_앱(네이티브)', existing: HOKA })).toBe('16');
    expect(codePrefix({ workstream: 'D01_법인·행정', existing: HOKA })).toBe('01');
  });

  it('섞여 있으면 다수를 따른다', () => {
    const mixed = [
      { code: '07B-01', workstream: 'D08' },
      { code: '07B-02', workstream: 'D08' },
      { code: '99-01', workstream: 'D08' },
    ];
    expect(codePrefix({ workstream: 'D08', existing: mixed })).toBe('07B');
  });

  it('항목이 없는 워크스트림이면 그때만 이름에서 뽑는다', () => {
    expect(codePrefix({ workstream: 'D20_새 영역', existing: HOKA })).toBe('20');
    expect(codePrefix({ workstream: '01_신규법인', existing: [] })).toBe('01');
  });

  it('항목도 없고 이름에 번호도 없으면 null', () => {
    expect(codePrefix({ workstream: '새 영역', existing: [] })).toBe(null);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(codePrefix({})).toBe(null);
    expect(codePrefix()).toBe(null);
    expect(codePrefix({ workstream: '  ', existing: HOKA })).toBe(null);
  });
});

describe('nextCode', () => {
  it('그 워크스트림이 쓰는 앞자리로 다음 번호를 짓는다', () => {
    expect(nextCode({ workstream: 'D08_WMS·재고', existing: HOKA })).toBe('07B-27');
    expect(nextCode({ workstream: 'D01_법인·행정', existing: HOKA })).toBe('01-28');
    expect(nextCode({ workstream: 'D11_자사몰연결', existing: HOKA })).toBe('10A-02');
  });

  it('항목이 없는 워크스트림이면 이름 번호로 01 부터', () => {
    expect(nextCode({ workstream: 'D20_새 영역', existing: HOKA })).toBe('20-01');
  });

  it('앞자리가 같으면 워크스트림을 가리지 않고 센다', () => {
    // 앞자리가 겹치는데 워크스트림 안에서만 세면 번호가 겹치고,
    // 겹치면 unique 제약에 걸려 저장이 통째로 실패한다.
    const rows = [
      { code: '01-05', workstream: '옛 이름' },
      { code: '01-09', workstream: '새 이름' },
    ];
    expect(nextCode({ workstream: '새 이름', existing: rows })).toBe('01-10');
  });

  it('빈자리를 메우지 않는다', () => {
    const rows = [
      { code: '01-01', workstream: 'D01' },
      { code: '01-03', workstream: 'D01' },
    ];
    expect(nextCode({ workstream: 'D01', existing: rows })).toBe('01-04');
  });

  it('순서가 뒤죽박죽이어도 최대값을 본다', () => {
    const rows = [
      { code: '01-07', workstream: 'D01' },
      { code: '01-02', workstream: 'D01' },
      { code: '01-05', workstream: 'D01' },
    ];
    expect(nextCode({ workstream: 'D01', existing: rows })).toBe('01-08');
  });

  it('코드 모양이 아닌 값은 무시한다', () => {
    const rows = [
      { code: '01-01', workstream: 'D01' },
      { code: '이상한 값', workstream: 'D01' },
      { code: null, workstream: 'D01' },
    ];
    expect(nextCode({ workstream: 'D01', existing: rows })).toBe('01-02');
  });

  it('앞자리를 못 정하면 null', () => {
    expect(nextCode({ workstream: '새 영역', existing: [] })).toBe(null);
    expect(nextCode({ workstream: '', existing: HOKA })).toBe(null);
  });

  it('99를 넘으면 null — 조용히 세 자리로 늘어나면 모양이 깨진다', () => {
    const rows = [{ code: '01-99', workstream: 'D01' }];
    expect(nextCode({ workstream: 'D01', existing: rows })).toBe(null);
  });

  it('코드 문자열 배열도 받는다', () => {
    // 미리보기처럼 워크스트림별 코드를 안 들고 있는 자리가 있다. 그때는
    // 이름에서 뽑은 앞자리로 세는 수밖에 없다.
    expect(nextCode({ workstream: 'D01_법인·행정', existing: ['01-01', '01-02'] })).toBe('01-03');
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(nextCode({})).toBe(null);
    expect(nextCode()).toBe(null);
  });
});
