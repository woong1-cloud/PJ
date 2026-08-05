// 카테고리는 두 종류다.
//
// - 브랜드 고유: brand_id 가 그 브랜드를 가리킨다. 2차(실무 관리자)가 관리한다.
// - 공통: brand_id 가 null 이다. 모든 브랜드에서 함께 보인다. 한 브랜드의
//   관리자가 지우면 다른 브랜드까지 영향을 받으므로 전체관리자만 관리한다.

// DB 행을 화면이 쓸 모양으로 바꾼다. 화면에서 brand_id 를 직접 비교하게
// 두면 '=== null' 과 '== null' 을 헷갈리기 쉬워 한 곳에서 판정한다.
export function toCategoryPayload(row) {
  return {
    id: row.id,
    brand_id: row.brand_id ?? null,
    category_name: row.category_name,
    sort_order: row.sort_order,
    isCommon: row.brand_id === null,
  };
}

// 설정 화면은 두 묶음을 따로 그린다. 순서 바꾸기가 배열의 이웃끼리
// sort_order 를 맞바꾸는 방식이라, 한 배열에 섞어두면 경계에서 공통
// 카테고리를 건드리게 되고 2차 관리자는 그 PATCH 에서 403 을 받는다.
export function splitCategories(categories) {
  const list = categories ?? [];
  return {
    own: list.filter((c) => !c.isCommon),
    common: list.filter((c) => c.isCommon),
  };
}
