import { getSupabaseAdmin } from './supabaseAdmin';
import { checkBrandAccess } from './checkBrandAccess';
import { ApiError } from './apiError';
import { getSessionMember } from './auth';

export async function requireBrandAccess(brandId, minTier) {
  if (!brandId) {
    throw new ApiError(400, 'brandId가 필요합니다.');
  }

  const { memberId, isGlobalAdmin } = await getSessionMember();

  const supabase = getSupabaseAdmin();
  const { data: roles, error: rolesError } = await supabase
    .from('user_brand_roles')
    .select('brand_id, tier')
    .eq('team_member_id', memberId);

  if (rolesError) {
    console.error(rolesError);
    throw new ApiError(500, '권한 조회 중 오류가 발생했습니다.');
  }

  const result = checkBrandAccess({
    isGlobalAdmin,
    roles: roles ?? [],
    brandId,
    minTier,
  });

  if (!result.allowed) {
    throw new ApiError(403, '해당 브랜드에 대한 권한이 없습니다.');
  }

  return { memberId, isGlobalAdmin, tier: result.tier };
}

export async function requireGlobalAdmin() {
  const { memberId, isGlobalAdmin } = await getSessionMember();
  if (!isGlobalAdmin) {
    throw new ApiError(403, '전역 관리자 권한이 필요합니다.');
  }
  return { memberId, isGlobalAdmin: true };
}

// 런칭 하나에 대한 권한.
//
// 요구사항의 브랜드×등급과 다른 축이다. 런칭은 브랜드가 아직 없을 수 있고
// (launches.brand_id 가 nullable 인 이유), 법무·재무·물류는 브랜드 소속이
// 아니며, 런칭은 오픈하면 끝나는데 브랜드 등급은 안 끝난다.
// 자세한 판단은 docs/superpowers/specs/2026-09-07-launch-participants-design.md
//
// 두 단계다:
//   'member' — 명단(launch_members)에 있으면 된다. 보고 고칠 수 있다.
//   'admin'  — 전체 관리자만. 되돌릴 수 없거나 파일이 밖으로 나가는 것들.
//
// 참관은 안 만든다. can_edit 컬럼은 남아 있지만 값이 늘 참이라 여기서
// 안 본다 — 보고 화면을 만들 때 되살아날 자리다.
export async function requireLaunchAccess(launchId, level = 'member') {
  if (!launchId) throw new ApiError(400, '런칭 id 가 필요합니다.');

  const { memberId, isGlobalAdmin } = await getSessionMember();
  // 전체 관리자는 늘 통과한다 — 지금까지와 같다.
  if (isGlobalAdmin) return { memberId, isGlobalAdmin: true, isMember: true };

  if (level === 'admin') {
    throw new ApiError(403, '전체 관리자만 할 수 있습니다.');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('launch_members')
    .select('member_id')
    .eq('launch_id', launchId)
    .eq('member_id', memberId)
    .limit(1);
  if (error) {
    console.error(error);
    throw new ApiError(500, '권한 조회 중 오류가 발생했습니다.');
  }
  // 명단 밖이면 404 가 아니라 403 이다. 404 로 답하면 "그런 런칭이 없다"가
  // 되어, id 를 바꿔 가며 있는지 없는지를 알아낼 수 있다.
  if ((data ?? []).length === 0) throw new ApiError(403, '이 런칭의 참여자가 아닙니다.');

  return { memberId, isGlobalAdmin: false, isMember: true };
}

// 내가 낀 런칭 id 들. 목록 라우트와 상단바가 쓴다.
//
// 전체 관리자에게는 null 을 준다 — "거르지 않는다"는 뜻이다. 빈 배열과
// 구별해야 한다(빈 배열은 "하나도 없다"라서 목록이 통째로 비어야 한다).
export async function myLaunchIds() {
  const { memberId, isGlobalAdmin } = await getSessionMember();
  if (isGlobalAdmin) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('launch_members')
    .select('launch_id')
    .eq('member_id', memberId);
  if (error) {
    console.error(error);
    throw new ApiError(500, '권한 조회 중 오류가 발생했습니다.');
  }
  return [...new Set((data ?? []).map((r) => r.launch_id))];
}
