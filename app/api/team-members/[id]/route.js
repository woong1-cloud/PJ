import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { checkLastGlobalAdmin } from '@/lib/checkLastGlobalAdmin';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, isActive, isGlobalAdmin, organizationId, jobRoleId, canViewAllProjects } = body;

    await requireGlobalAdmin();

    const supabase = getSupabaseAdmin();

    if (isGlobalAdmin === false || isActive === false) {
      const { data: teamMembers, error: listError } = await supabase
        .from('team_members')
        .select('id, is_global_admin, is_active');
      if (listError) throw listError;
      if (checkLastGlobalAdmin({ teamMembers, targetMemberId: id })) {
        throw new ApiError(400, '이 시스템의 마지막 전체 관리자는 해제하거나 강등할 수 없습니다.');
      }
    }

    const updates = {};
    if (name !== undefined) {
      if (!name.trim()) throw new ApiError(400, '이름은 필수입니다.');
      updates.name = name.trim();
    }
    if (isActive !== undefined) updates.is_active = isActive;
    if (isGlobalAdmin !== undefined) updates.is_global_admin = isGlobalAdmin;
    // 소속·직무는 가입 때 한 번 적고 영구 고정이었다. 사람이 브랜드에서 본부로
    // 옮기거나 직무가 바뀌면 고칠 방법이 SQL 뿐이었고, 그건 기능이 없는 것과 같다.
    //
    // 가입 폼과 같은 목록으로 검증한다. DB CHECK 도 같은 값이라 여기서 막지
    // 않으면 23514 가 사용자 화면에 뜬다.
    if (organizationId !== undefined) {
      // 조직 존재 여부는 FK 가 지킨다. 여기서는 null 로 비우는 것만 허용한다 —
      // 이관되지 않은 사람을 되돌릴 길이 없으면 실수를 고칠 수 없다.
      updates.organization_id = organizationId || null;
    }
    // 등급과 직교하는 축이다. 브랜드 배치(user_brand_roles)와 달리 사람에게
    // 붙으므로 여기서 다룬다.
    if (canViewAllProjects !== undefined) {
      updates.can_view_all_projects = Boolean(canViewAllProjects);
    }
    // 직무는 id 로 받는다. 이름을 그대로 넣으면 관리자가 목록에서 이름을
    // 바꿨을 때 옛 문자열이 남아 조인이 끊긴다.
    //
    // 존재 여부는 FK 가 지킨다. null 로 비우는 것은 허용한다 — 이관되지 않은
    // 사람을 되돌릴 길이 없으면 실수를 고칠 수 없다(organization_id 와 같은 규칙).
    if (jobRoleId !== undefined) {
      updates.job_role_id = jobRoleId || null;
    }
    if (Object.keys(updates).length === 0) throw new ApiError(400, '수정할 필드가 없습니다.');

    const { data, error } = await supabase
      .from('team_members')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, '팀원을 찾을 수 없습니다.');
    return Response.json({ teamMember: data });
  } catch (error) {
    return errorResponse(error);
  }
}
