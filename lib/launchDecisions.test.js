import { describe, expect, it } from 'vitest';
import { parseDecisions } from './launchDecisions';

// 00_개요 의 실제 모양. [먼저 결정할 것] 블록 앞뒤로 다른 블록이 있고,
// 다섯째 열에 비고 같은 잡동사니가 섞여 있다.
const ROWS = [
  ['신규 스포츠 브랜드 온라인 오픈 체크리스트 — 개요 및 역할', '', '', '', ''],
  ['오픈 목표일', 46388, '', '', ''],
  ['[제반사항]', '', '', '', ''],
  ['구축 방식', '자체 구축 차세대 플랫폼 기반', '', '', ''],
  ['[먼저 결정할 것] — 결정 전에는 후속 과업이 착수되지 않는 항목', '', '', '', ''],
  ['시기', '결정 항목', '미결 시 영향', '결정 주체', ''],
  ['9월 중', '1차 구축 범위 확정 — 웹앱·앱 기능 경계', '개발 견적·일정 산정 불가', '브랜드PM · 개발총괄', ''],
  ['9월 중', '개발 외주 계약 확정 - 작업명세서 산출', '발주 자체가 진행되지 않음', '브랜드PM · 개발총괄', 'V'],
  [
    '9월 중',
    '재고 운영 방식 — 통합재고 vs 채널별 실물 분리',
    '재고·주문 연동 설계 착수 불가',
    '브랜드',
    '새로 사업자를 만들 시 애플스토어 검수 이슈 발생 우려',
  ],
  ['10월 초', '앱 출시 시점 — 오픈 동시 vs 오픈 후 2차', '오픈 전 3주 부하와 스토어 심사 리스크', '브랜드', '1월 1일'],
  ['[다음 블록]', '', '', '', ''],
  ['아무거나', '값', '', '', ''],
];

describe('parseDecisions', () => {
  it('[먼저 결정할 것] 블록만 읽는다', () => {
    const result = parseDecisions(ROWS);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      seq: 1,
      when_text: '9월 중',
      title: '1차 구축 범위 확정 — 웹앱·앱 기능 경계',
      impact: '개발 견적·일정 산정 불가',
      owner_text: '브랜드PM · 개발총괄',
    });
  });

  it('다음 [ 에서 멈춘다 — 안 멈추면 다음 블록의 줄이 결정으로 들어온다', () => {
    const result = parseDecisions(ROWS);
    expect(result.some((d) => d.title === '값')).toBe(false);
  });

  it('블록이 없으면 빈 배열', () => {
    expect(parseDecisions([['제목'], ['아무거나', '값']])).toEqual([]);
  });

  it('결정 항목이 빈 줄은 버린다', () => {
    const rows = [
      ['[먼저 결정할 것] — 결정 전에는 후속 과업이 착수되지 않는 항목'],
      ['시기', '결정 항목', '미결 시 영향', '결정 주체'],
      ['9월 중', '', '영향 있음', '브랜드'],
      ['9월 중', '진짜 결정', '영향 있음', '브랜드'],
    ];
    expect(parseDecisions(rows)).toEqual([
      { seq: 1, when_text: '9월 중', title: '진짜 결정', impact: '영향 있음', owner_text: '브랜드' },
    ]);
  });

  it('seq 는 1부터', () => {
    const result = parseDecisions(ROWS);
    expect(result.map((d) => d.seq)).toEqual([1, 2, 3, 4]);
  });

  it('머리 행이 제목 아래에 있어도 찾는다', () => {
    // ROWS 는 [먼저 결정할 것] 다음 줄이 바로 머리가 아니어도 되는 모양을
    // 이미 담고 있다 — 여기서는 사이에 빈 줄을 하나 더 끼워 확인한다.
    const rows = [
      ['[먼저 결정할 것] — 결정 전에는 후속 과업이 착수되지 않는 항목'],
      ['', '', '', ''],
      ['시기', '결정 항목', '미결 시 영향', '결정 주체'],
      ['9월 중', '결정', '영향', '브랜드'],
    ];
    expect(parseDecisions(rows)).toEqual([
      { seq: 1, when_text: '9월 중', title: '결정', impact: '영향', owner_text: '브랜드' },
    ]);
  });

  it('when_text 를 날짜로 바꾸지 않는다 — 정해진 만큼만 정확해야 한다', () => {
    const result = parseDecisions(ROWS);
    expect(result[0].when_text).toBe('9월 중');
    expect(result.every((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.when_text))).toBe(true);
  });

  it('다섯째 열(비고)은 담지 않는다 — 머리 행에 이름이 없는 열이라 toObjects 가 버린다', () => {
    const result = parseDecisions(ROWS);
    result.forEach((d) => {
      expect(Object.keys(d).sort()).toEqual(['impact', 'owner_text', 'seq', 'title', 'when_text']);
    });
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(parseDecisions([])).toEqual([]);
    expect(parseDecisions()).toEqual([]);
  });
});
