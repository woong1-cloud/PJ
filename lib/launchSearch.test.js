import { describe, expect, it } from 'vitest';
import { matchesItem, matchesQuery, searchFields } from './launchSearch';

const item = {
  code: '07B-03',
  title: 'WMS ↔ ERP ↔ 자사몰 재고 동기화 방식·주기·기준 시점 확정 (그룹 표준: 이허브)',
  note: '★ 시스템 선정이 아니라 전제 공유가 목적',
  deliverable: '동기화 규격',
  owner_role: '총PM',
  support_role: 'CAIO실',
  category: '재고 원천',
  workstream: 'D08_WMS·재고',
  plain_text: null,
};

describe('matchesQuery', () => {
  it('대소문자를 가리지 않는다', () => {
    // 이 자료에는 영문 약어가 잔뜩이다 — WMS · ERP · GA4 · SKU · 3PL.
    // 'wms' 라고 친 사람에게 "없습니다"를 보여주면 항목이 없다고 믿는다.
    expect(matchesQuery(['WMS 재고'], 'wms')).toBe(true);
    expect(matchesQuery(['WMS 재고'], 'WMS')).toBe(true);
    expect(matchesQuery(['wms 재고'], 'WMS')).toBe(true);
    expect(matchesQuery(['GA4·Braze'], 'braze')).toBe(true);
  });

  it('한글은 그대로 찾는다', () => {
    expect(matchesQuery(['상표권 이전등록'], '상표')).toBe(true);
    expect(matchesQuery(['상표권 이전등록'], '특허')).toBe(false);
  });

  it('빈 검색어는 전부 통과 — 목록을 안 가린다', () => {
    expect(matchesQuery(['아무거나'], '')).toBe(true);
    expect(matchesQuery(['아무거나'], '   ')).toBe(true);
    expect(matchesQuery(['아무거나'], null)).toBe(true);
    expect(matchesQuery(['아무거나'], undefined)).toBe(true);
  });

  it('앞뒤 공백을 떼고 찾는다', () => {
    expect(matchesQuery(['WMS'], '  wms  ')).toBe(true);
  });

  it('빈 칸은 건너뛴다 — null 이 "null" 로 붙으면 안 된다', () => {
    expect(matchesQuery(['제목', null, undefined, ''], 'null')).toBe(false);
    expect(matchesQuery([null, undefined], '아무거나')).toBe(false);
  });

  it('칸을 가리지 않는다 — 코드로도 비고로도 찾힌다', () => {
    expect(matchesQuery(['07B-03', '재고 동기화'], '07b')).toBe(true);
    expect(matchesQuery(['07B-03', '재고 동기화'], '동기화')).toBe(true);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(matchesQuery([], 'x')).toBe(false);
    expect(matchesQuery(null, 'x')).toBe(false);
    expect(matchesQuery(undefined, '')).toBe(true);
  });
});

describe('searchFields', () => {
  it('찾을 칸을 다 모은다', () => {
    const fields = searchFields(item);
    expect(fields).toContain('07B-03');
    expect(fields).toContain('총PM');
    expect(fields).toContain('D08_WMS·재고');
  });

  it('없는 항목에서 죽지 않는다', () => {
    expect(() => searchFields(null)).not.toThrow();
    expect(() => searchFields(undefined)).not.toThrow();
  });
});

describe('matchesItem', () => {
  it('소문자로 약어를 찾는다', () => {
    expect(matchesItem(item, 'wms')).toBe(true);
    expect(matchesItem(item, 'erp')).toBe(true);
    expect(matchesItem(item, 'caio')).toBe(true);
  });

  it('워크스트림 이름으로도 찾는다', () => {
    expect(matchesItem(item, 'd08')).toBe(true);
  });

  it('쉬운 설명으로도 찾는다 — 처음 하는 사람이 아는 말이 거기 있다', () => {
    const withPlain = { ...item, plain_text: '창고 시스템과 쇼핑몰의 재고 숫자를 맞추는 일' };
    expect(matchesItem(withPlain, '창고')).toBe(true);
    expect(matchesItem(item, '창고')).toBe(false);
  });

  it('없는 말은 안 찾힌다', () => {
    expect(matchesItem(item, '무신사')).toBe(false);
  });
});
