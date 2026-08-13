import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';

// 조직 목록·생성.
//
// 전체관리자 전용이다 — 이 목록은 가입 화면에 그대로 노출되고 등급 제안과
// 전사 열람 기본값까지 정한다. 브랜드 관리자가 건드릴 자리가 아니다.
export async function GET() {
  try {
    await requireGlobalAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .select(
        'id, name, brand_id, default_tier, default_view_all_projects, is_active, sort_order, ' +
          'brand:brands(id, name)'
      )
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return Response.json({ organizations: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    await requireGlobalAdmin();
    const body = await request.json();
    const { name, brandId, defaultTier, defaultViewAllProjects, sortOrder } = body;

    if (!name || !String(name).trim()) throw new ApiError(400, '조직 이름은 필수입니다.');
    // 등급 문자열을 그대로 믿지 않는다. 모르는 값이 DB CHECK 까지 가면
    // 사용자는 23514 라는 숫자만 보게 된다.
    //
    // hasOwnProperty 로 확인하는 이유는 'toString' 같은 값이 프로토타입을
    // 타고 통과하는 것을 막기 위해서다(lib/organizations.js 와 같은 규칙).
    if (defaultTier && !Object.prototype.hasOwnProperty.call(TIER_RANK, defaultTier)) {
      throw new ApiError(400, '유효하지 않은 등급입니다.');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: String(name).trim(),
        brand_id: brandId || null,
        default_tier: defaultTier || null,
        default_view_all_projects: Boolean(defaultViewAllProjects),
        sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      })
      .select()
      .single();
    // 23505 = unique_violation. 같은 이름을 두 번 만들면 가입 화면에 똑같은
    // 선택지가 둘 뜨고, 고른 사람마다 다른 조직에 들어간다. 그 상태는 화면만
    // 봐서는 알 수 없다.
    if (error?.code === '23505') throw new ApiError(409, '같은 이름의 조직이 이미 있습니다.');
    if (error) throw error;
    return Response.json({ organization: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
