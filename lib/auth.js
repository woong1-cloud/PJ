import 'server-only';
import { createClient } from './supabaseServer';
import { getSupabaseAdmin } from './supabaseAdmin';
import { ApiError } from './apiError';

// 요청 쿠키의 Supabase 세션을 검증하고 team_members에서 실제 memberId/
// isGlobalAdmin을 조회한다. Route Handler 안에서만 호출 가능하다
// (next/headers의 cookies()에 의존).
//
// getUser()가 아니라 getClaims()를 쓴다. getUser()는 JWT 하나당 Supabase 인증
// 서버로 요청을 보내는데, 이 함수는 모든 API 요청의 첫 줄에서 호출된다. 화면
// 한 번 열면 5~6번씩 나가고, 실제로 개발 중에 'over_request_rate_limit'(429)에
// 걸려 앱 전체가 멈췄다.
//
// getClaims()는 JWT 서명을 JWKS로 로컬 검증한다(이 프로젝트는 ES256 비대칭키를
// 쓰므로 네트워크 호출 없이 끝난다. 대칭키 프로젝트였다면 getUser()와 똑같이
// 서버로 나가므로 이 최적화가 의미 없다).
//
// 보안상 잃는 것: 서버에서 즉시 폐기된 계정도 토큰 만료(약 1시간) 전까지는
// 서명이 유효하다. 다만 아래에서 team_members.is_active를 DB로 확인하므로,
// 비활성화한 사용자는 토큰과 무관하게 그 즉시 차단된다 — 이 앱에서 사용자를
// 막는 수단은 원래 그쪽이다.
//
// must_change_password가 true인 세션은 기본적으로 차단한다(비밀번호 변경 화면과
// 관련된 API만 allowPendingPasswordChange: true로 예외를 둔다) — 클라이언트의
// /login 화면 리다이렉트만으로는 /api/*를 직접 호출하는 경로를 막을 수 없기 때문.
export async function getSessionMember({ allowPendingPasswordChange = false } = {}) {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  if (authError) console.error(authError);
  const authUserId = claimsData?.claims?.sub;
  if (!authUserId) {
    throw new ApiError(401, '로그인이 필요합니다.');
  }

  const admin = getSupabaseAdmin();
  const { data: member, error } = await admin
    .from('team_members')
    .select('id, is_active, is_global_admin, must_change_password')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new ApiError(500, '사용자 조회 중 오류가 발생했습니다.');
  }
  if (!member || !member.is_active) {
    throw new ApiError(403, '유효하지 않은 사용자입니다.');
  }
  if (member.must_change_password && !allowPendingPasswordChange) {
    throw new ApiError(403, '비밀번호를 먼저 변경해야 합니다.');
  }

  return {
    memberId: member.id,
    isGlobalAdmin: member.is_global_admin,
    mustChangePassword: member.must_change_password,
  };
}
