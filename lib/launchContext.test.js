import { describe, expect, it } from 'vitest';
import { parseContext } from './launchContext';

// 00_개요 의 실제 모양. 제목 한 줄, 오픈일, 기준일, 그리고 [제반사항] 블록.
const ROWS = [
  ['신규 스포츠 브랜드 온라인 오픈 체크리스트 — 개요 및 역할', '', ''],
  ['오픈 목표일', 46388, ''],
  ['기준일 2026-09-03   ·   D-120일', '', ''],
  ['[제반사항]', '', ''],
  ['구축 방식', '자체 구축 차세대 플랫폼 기반', ''],
  ['개발 주체', '내부 개발이 아닌 외주 개발', ''],
  ['재고', 'WMS(이허브) 확정. 운영 방식은 미결', ''],
  ['[먼저 결정할 것] — 결정 전에는 후속 과업이 착수되지 않는 항목', '', ''],
  ['시기', '결정 항목', '미결 시 영향'],
];

describe('parseContext', () => {
  it('[제반사항] 블록만 읽는다', () => {
    expect(parseContext(ROWS)).toEqual([
      { label: '구축 방식', value: '자체 구축 차세대 플랫폼 기반' },
      { label: '개발 주체', value: '내부 개발이 아닌 외주 개발' },
      { label: '재고', value: 'WMS(이허브) 확정. 운영 방식은 미결' },
    ]);
  });

  it('다음 [ 에서 멈춘다 — 안 멈추면 결정 표가 전제로 들어온다', () => {
    expect(parseContext(ROWS).some((c) => c.label === '시기')).toBe(false);
  });

  it('블록이 없으면 빈 배열', () => {
    // 다음 브랜드의 파일에 이 블록이 없을 수 있다. 그때 손으로 넣는다.
    expect(parseContext([['제목'], ['아무거나', '값']])).toEqual([]);
  });

  it('값이 없는 줄은 버린다', () => {
    const rows = [['[제반사항]'], ['법인', '신규 법인'], ['빈칸', ''], ['', '값만']];
    expect(parseContext(rows)).toEqual([{ label: '법인', value: '신규 법인' }]);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(parseContext([])).toEqual([]);
    expect(parseContext()).toEqual([]);
  });
});
