import { describe, it, expect } from 'vitest';
import {
  BOM,
  REQUIREMENT_CSV_HEADERS,
  csvFileName,
  escapeCell,
  requirementsToCsv,
  toCsv,
} from './csv';

describe('escapeCell', () => {
  it('평범한 값은 그대로 둔다', () => {
    expect(escapeCell('타임세일')).toBe('타임세일');
    expect(escapeCell(3)).toBe('3');
  });

  it('쉼표가 있으면 감싼다 — 안 감싸면 열이 밀린다', () => {
    expect(escapeCell('무신사 세트구매, 글로벌 API 확장')).toBe(
      '"무신사 세트구매, 글로벌 API 확장"'
    );
  });

  it('따옴표는 두 번 겹쳐 쓴다 — 안 그러면 칸이 일찍 닫힌다', () => {
    expect(escapeCell('그가 "완료"라고 했다')).toBe('"그가 ""완료""라고 했다"');
  });

  it('줄바꿈이 있으면 감싼다 — 안 감싸면 행이 쪼개진다', () => {
    expect(escapeCell('첫 줄\n둘째 줄')).toBe('"첫 줄\n둘째 줄"');
    expect(escapeCell('첫 줄\r\n둘째 줄')).toBe('"첫 줄\r\n둘째 줄"');
  });

  it('빈 값은 빈 칸이다 — "null" 이라는 글자가 표에 찍히면 안 된다', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
    expect(escapeCell('')).toBe('');
  });

  it('0 은 빈 칸이 아니다', () => {
    expect(escapeCell(0)).toBe('0');
  });
});

describe('toCsv', () => {
  it('BOM 으로 시작한다 — 없으면 엑셀에서 한글이 깨진다', () => {
    const csv = toCsv({ headers: ['제목'], rows: [['타임세일']] });
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('헤더와 행을 CRLF 로 잇는다', () => {
    const csv = toCsv({ headers: ['a', 'b'], rows: [['1', '2'], ['3', '4']] });
    expect(csv.slice(1)).toBe('a,b\r\n1,2\r\n3,4');
  });

  it('행이 없어도 헤더는 나온다 — 빈 파일은 실패처럼 보인다', () => {
    expect(toCsv({ headers: ['제목'], rows: [] }).slice(1)).toBe('제목');
    expect(toCsv({ headers: ['제목'] }).slice(1)).toBe('제목');
  });
});

describe('requirementsToCsv', () => {
  const req = {
    requirement_type: '오류',
    status: '개발중',
    channel: '자사몰',
    title: '장바구니, 쿠폰 오류',
    category: { category_name: '주문' },
    priority: '상',
    requester: { name: '김지원' },
    assignee: { name: '박실무' },
    request_date: '2026-08-01',
    expected_release_date: '2026-08-20',
    completed_at: null,
    project: { name: '결제 개편' },
    redmine_url: 'https://r/issues/1234',
    image_count: 2,
  };

  it('헤더 순서대로 값을 채운다', () => {
    const lines = requirementsToCsv([req]).slice(1).split('\r\n');
    expect(lines[0]).toBe(REQUIREMENT_CSV_HEADERS.join(','));
    expect(lines[1]).toBe(
      '오류,개발중,자사몰,"장바구니, 쿠폰 오류",주문,상,김지원,박실무,2026-08-01,2026-08-20,,결제 개편,https://r/issues/1234,2'
    );
  });

  it('유형이 없으면 미분류로 적는다', () => {
    const lines = requirementsToCsv([{ ...req, requirement_type: null }]).slice(1).split('\r\n');
    expect(lines[1].startsWith('미분류,')).toBe(true);
  });

  it('완료일은 날짜만 남긴다', () => {
    const lines = requirementsToCsv([{ ...req, completed_at: '2026-08-02T05:31:00.000Z' }])
      .slice(1)
      .split('\r\n');
    expect(lines[1]).toContain(',2026-08-02,');
  });

  it('조인이 비어 있어도 터지지 않는다', () => {
    expect(() => requirementsToCsv([{ title: '제목만' }])).not.toThrow();
    expect(requirementsToCsv([]).slice(1)).toBe(REQUIREMENT_CSV_HEADERS.join(','));
    expect(requirementsToCsv()).toContain('유형');
  });
});

describe('csvFileName', () => {
  it('브랜드와 날짜가 들어간다 — 여러 번 받으면 구분이 안 된다', () => {
    expect(csvFileName('스파오', '2026-08-03')).toBe('스파오_요구사항_2026-08-03.csv');
  });

  it('파일명에 쓸 수 없는 문자를 지운다', () => {
    expect(csvFileName('스파오/키즈', '2026-08-03')).toBe('스파오키즈_요구사항_2026-08-03.csv');
  });

  it('브랜드를 모르면 브랜드 자리를 비운다 — 요구사항_요구사항_ 이 되지 않게', () => {
    expect(csvFileName(null, '2026-08-03')).toBe('요구사항_2026-08-03.csv');
    expect(csvFileName('', '2026-08-03')).toBe('요구사항_2026-08-03.csv');
    expect(csvFileName('  ', '2026-08-03')).toBe('요구사항_2026-08-03.csv');
  });
});
