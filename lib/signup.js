// 가입 화면에서 사용자가 고르는 값들.
//
// 여기 적힌 값은 전부 "신청"이지 "권한"이 아니다. 소속·직무·근무 브랜드는
// 시스템이 검증할 수 없는 자기 신고라, team_members에 참고 정보로만 남고
// 실제 접근 권한(user_brand_roles 행)은 관리자가 따로 만든다.
export const AFFILIATIONS = ['브랜드', '본부'];
export const JOB_ROLES = ['기획자', '개발자', '디자이너', '기타'];

// 소속에서 등급을 제안한다. 어디까지나 제안이고 확정은 관리자가 한다.
//
// 모르는 값은 가장 낮은 등급으로 떨어진다 — 판단이 안 될 때 권한을 더 주는
// 쪽으로 기울면 그게 곧 보안 구멍이다.
//
// 프로토타입이 없는 객체를 쓰는 이유: 평범한 리터럴이면 'toString' 같은
// 소속을 보냈을 때 Object.prototype의 함수가 잡혀 ?? 를 그냥 통과한다.
// 값이 등급 문자열이 아니게 되는 순간 아래 검사들이 전부 무의미해진다.
const TIER_BY_AFFILIATION = Object.assign(Object.create(null), {
  브랜드: '4차',
  본부: '3차',
});

export function suggestTier(affiliation) {
  return TIER_BY_AFFILIATION[affiliation] ?? '4차';
}

// 이메일 도메인 검사.
//
// endsWith 로 비교하면 'evil-eland.co.kr' 이 통과한다. @ 뒤를 통째로 잘라
// 정확히 일치하는지 본다.
export function isAllowedEmail(email, allowedDomains) {
  if (typeof email !== 'string') return false;
  if (!Array.isArray(allowedDomains)) return false;
  // 마지막 @ 를 기준으로 자른다. at < 1 이면 @ 가 없거나 로컬 파트가 비었다.
  const at = email.lastIndexOf('@');
  if (at < 1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain) return false;
  return allowedDomains.some((d) => domain === String(d).toLowerCase());
}
