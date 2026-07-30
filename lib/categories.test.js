import { describe, it, expect } from 'vitest';
import { toCategoryPayload, splitCategories } from './categories';

describe('toCategoryPayload', () => {
  it('brand_id 가 null 이면 공통이다', () => {
    const row = { id: 'c1', brand_id: null, category_name: '공통결제', sort_order: 0 };
    expect(toCategoryPayload(row)).toEqual({
      id: 'c1',
      brand_id: null,
      category_name: '공통결제',
      sort_order: 0,
      isCommon: true,
    });
  });

  it('brand_id 가 있으면 공통이 아니다', () => {
    const row = { id: 'c2', brand_id: 'b1', category_name: 'UI/UX', sort_order: 3 };
    expect(toCategoryPayload(row).isCommon).toBe(false);
  });

  // brand_id 가 undefined 로 오는 경우(select 에서 빠진 응답)를 공통으로
  // 잘못 읽으면 브랜드 카테고리에 '공통' 배지가 붙고 2차 관리자의 수정
  // 버튼이 사라진다. null 일 때만 공통이다.
  it('brand_id 가 undefined 면 공통이 아니다', () => {
    expect(toCategoryPayload({ id: 'c3', category_name: 'x', sort_order: 0 }).isCommon).toBe(false);
  });
});

describe('splitCategories', () => {
  const rows = [
    { id: 'a', brand_id: 'b1', category_name: 'UI/UX', sort_order: 0, isCommon: false },
    { id: 'b', brand_id: null, category_name: '공통결제', sort_order: 0, isCommon: true },
    { id: 'c', brand_id: 'b1', category_name: '결제', sort_order: 1, isCommon: false },
  ];

  // 순서 바꾸기는 배열의 이웃끼리 sort_order 를 맞바꾼다. 두 묶음이 한
  // 배열에 섞여 있으면 경계에서 공통 카테고리를 건드리게 되고, 2차
  // 관리자는 그 PATCH 에서 403 을 받는다.
  it('브랜드 고유와 공통을 나눈다', () => {
    const { own, common } = splitCategories(rows);
    expect(own.map((c) => c.id)).toEqual(['a', 'c']);
    expect(common.map((c) => c.id)).toEqual(['b']);
  });

  it('각 묶음 안의 순서는 유지된다', () => {
    const { own } = splitCategories(rows);
    expect(own[0].sort_order).toBe(0);
    expect(own[1].sort_order).toBe(1);
  });

  it('빈 목록도 다룬다', () => {
    expect(splitCategories([])).toEqual({ own: [], common: [] });
    expect(splitCategories(undefined)).toEqual({ own: [], common: [] });
  });
});
