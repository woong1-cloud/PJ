import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';

// 조직 수정.
//
// DELETE 는 만들지 않는다.
//
// 조직을 진짜로 지우면 그 조직으로 가입한 사람의 소속 기록이 깨진다. 끄는
// 것은 is_active 를 false 로 바꾸는 것이고, 그러면 가입 화면 목록에서만
// 빠지고 기존 팀원 표시에는 남는다(lib/organizations.js 의 groupOrganizations
// 가 비활성을 걸러 낸다). 지울 길을 열어 두면 언젠가 눌린다.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();
    const body = await request.json();
    const { name, brandId, defaultTier, defaultViewAllProjects, isActive, sortOrder } = body;

    const updates = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw new ApiError(400, '조직 이름은 필수입니다.');
      updates.name = String(name).trim();
    }
    // brandId 는 null 을 명시적으로 넣을 수 있어야 한다. 브랜드였던 조직을
    // 본부으로 되돌리는 길이 없으면 잘못 만든 조직을 고칠 수 없다.
    if (brandId !== undefined) updates.brand_id = brandId || null;
    if (defaultTier !== undefined) {
      if (defaultTier && !Object.prototype.hasOwnProperty.call(TIER_RANK, defaultTier)) {
        throw new ApiError(400, '유효하지 않은 등급입니다.');
      }
      updates.default_tier = defaultTier || null;
    }
    if (defaultViewAllProjects !== undefined) {
      updates.default_view_all_projects = Boolean(defaultViewAllProjects);
    }
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
      updates.sort_order = Number(sortOrder);
    }
    if (Object.keys(updates).length === 0) throw new ApiError(400, '변경할 값이 없습니다.');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error?.code === '23505') throw new ApiError(409, '같은 이름의 조직이 이미 있습니다.');
    if (error) throw error;
    if (!data) throw new ApiError(404, '조직을 찾을 수 없습니다.');
    return Response.json({ organization: data });
  } catch (error) {
    return errorResponse(error);
  }
}
