import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse } from '@/lib/apiError';

// 가입 때 본인이 적은 값들. 배치 대기 화면에서 "내가 뭘로 신청했더라"를
// 답해 주는 용도다. 권한 판단에는 쓰지 않는다.
const BASE_COLUMNS = 'id, name, must_change_password, can_view_all_projects';
// onboarded_at(0020)을 BASE 가 아니라 이쪽에 둔다. BASE 는 마이그레이션이 안
// 돌아간 DB 를 위한 최후의 보루라, 여기에 새 컬럼을 넣으면 폴백까지 같이
// 죽어서 아무도 로그인하지 못한다.
const SIGNUP_COLUMNS =
  `${BASE_COLUMNS}, affiliation, job_role, onboarded_at, ` +
  'organization:organizations(name), ' +
  'requested_brand:brands!team_members_requested_brand_id_fkey(name)';

export async function GET() {
  try {
    const { memberId, isGlobalAdmin } = await getSessionMember({ allowPendingPasswordChange: true });

    const supabase = getSupabaseAdmin();

    let { data: member, error } = await supabase
      .from('team_members')
      .select(SIGNUP_COLUMNS)
      .eq('id', memberId)
      .single();

    // 42703 = undefined_column. 마이그레이션 0008이 아직 안 돌아간 DB다.
    // /api/me는 로그인 경로 전체가 의존하는 라우트라, 부가 정보인 가입 항목
    // 때문에 신원 확인까지 함께 죽으면 아무도 로그인하지 못한다.
    // 0008이 모든 환경에 적용되면 이 분기는 지워도 된다.
    if (error?.code === '42703') {
      ({ data: member, error } = await supabase
        .from('team_members')
        .select(BASE_COLUMNS)
        .eq('id', memberId)
        .single());
    }
    if (error) throw error;

    return Response.json({
      memberId: member.id,
      name: member.name,
      isGlobalAdmin,
      mustChangePassword: member.must_change_password,
      // 조직 이름을 먼저 쓴다. 이관되지 않은 사람은 옛 값으로 떨어진다
      // (lib/organizations.js 의 displayAffiliation 과 같은 순서).
      affiliation: member.organization?.name ?? member.affiliation ?? null,
      jobRole: member.job_role ?? null,
      // 등급과 직교하는 축. 로그인 직후 어느 화면으로 보낼지가 이 값으로 갈린다.
      canViewAllProjects: member.can_view_all_projects === true,
      requestedBrandName: member.requested_brand?.name ?? null,
      // null 이면 첫 로그인 안내를 아직 안 본 것이다.
      onboardedAt: member.onboarded_at ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
