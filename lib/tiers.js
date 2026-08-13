export const TIER_RANK = { '4차': 1, '3차': 2, '2차': 3, '1차': 4 };

// 저장값(1차/2차/3차/4차)은 그대로 두고 화면 표시 문구만 사용자 친화적으로 바꾼다.
//
// 2차를 '브랜드 관리자'에서 '실무 관리자'로 바꿨다. 요청을 받아 실무자를
// 배치하는 사람은 기획·IT 쪽이지 브랜드 소속이 아닌데, 예전 이름은 소속으로
// 읽혔다. 지금 이름은 사다리를 그대로 말한다 — 요청자가 올리고, 실무자가
// 처리하고, 실무 관리자가 실무자를 배치하고, 전체 관리자가 브랜드를 만든다.
//
// 직무 이름(기획자·개발자 …)은 쓰지 않는다. 그건 lib/signup.js 의 JOB_ROLES
// 라는 다른 축이고, 3차 권한은 개발자도 받을 수 있다. 등급에 직무 이름을 쓰면
// "직무 개발자 · 등급 기획자" 같은 줄이 생겨 둘 중 하나가 틀린 것처럼 보인다.
//
// 범위가 브랜드별이라는 사실은 이름이 아니라 도움말 첫 줄이 말한다.
export const TIER_LABELS = {
  '1차': '전체 관리자',
  '2차': '실무 관리자',
  '3차': '실무자',
  '4차': '요청자',
};

// 등급 셀렉트 아래에 붙는 한 줄.
//
// '실무자'와 '실무 관리자'는 이름만으로 한눈에 안 갈린다. 라벨 자체를 바꾸는
// 대신 설명을 더하는 이유는, 라벨이 도움말·온보딩·팀원 목록에 이미 퍼져
// 있어 이름을 바꾸면 그 전부를 함께 고쳐야 하기 때문이다.
//
// 문장은 "무엇을 할 수 있는가"로 쓴다. 등급 이름은 지위를 말하는데, 고르는
// 사람이 알아야 하는 건 그 지위가 무엇을 여는가다.
export const TIER_HINTS = {
  '1차': '브랜드와 조직을 만듭니다',
  '2차': '팀원을 배치하고 카테고리를 관리합니다',
  '3차': '상태와 담당자를 바꿉니다',
  '4차': '요구사항을 올리고 검토를 요청합니다',
};

// 요구사항 처리(상태변경/내용수정/담당자지정) 가능 여부. 1차/2차/3차.
export function canProcess(identity) {
  if (identity?.isGlobalAdmin === true) return true;
  return TIER_RANK[identity?.tier] >= TIER_RANK['3차'];
}

// 브랜드 운영 관리(팀원 배치/카테고리 관리) 가능 여부. 1차/2차.
export function canManageBrand(identity) {
  if (identity?.isGlobalAdmin === true) return true;
  return TIER_RANK[identity?.tier] >= TIER_RANK['2차'];
}

export function isGlobalAdmin(identity) {
  return identity?.isGlobalAdmin === true;
}
