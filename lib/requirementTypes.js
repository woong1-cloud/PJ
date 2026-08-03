// 요구사항 유형 — "IT가 무슨 일을 하게 되는가"를 나누는 축.
//
// 카테고리(brand_categories)와 다르다. 카테고리는 브랜드마다 다른 업무 영역이고
// 유형은 전사 고정이다. 둘을 섞으면 "오류가 몇 건인가"를 전사로 셀 수 없다.
//
// 넷으로 좁혔다. 다섯이 넘으면 등록자가 고민하다 아무거나 고르고, 그 순간
// 이 값은 있으나 마나가 된다.
export const REQUIREMENT_TYPES = ['신규', '개선', '오류', '문의'];

// 목록·필터에서 옆에 붙는 짧은 설명. 등록 화면의 도움말로도 쓴다.
export const TYPE_HINTS = {
  신규: '지금 없는 기능을 새로 만든다',
  개선: '있는 기능을 고치거나 넓힌다',
  오류: '되어야 하는데 안 된다',
  문의: '확인만 필요하고 개발은 없을 수 있다',
};

// 0019 이전에 등록된 건은 값이 없다. 화면에서 빈칸으로 두면 "왜 비었지"가
// 되므로 이름을 준다 — 소급해서 임의로 분류하지 않겠다는 뜻이기도 하다.
export const UNTYPED_LABEL = '미분류';

export function typeLabel(value) {
  return REQUIREMENT_TYPES.includes(value) ? value : UNTYPED_LABEL;
}

export function isValidType(value) {
  return REQUIREMENT_TYPES.includes(value);
}
