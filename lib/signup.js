// 가입 화면에서 사용자가 고르는 값들.
//
// 여기 적힌 값은 전부 "신청"이지 "권한"이 아니다. 소속(organizations)·직무는
// 시스템이 검증할 수 없는 자기 신고라, team_members에 참고 정보로만 남고
// 실제 접근 권한(user_brand_roles 행)은 관리자가 따로 만든다.
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
