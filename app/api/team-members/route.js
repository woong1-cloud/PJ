// app/api/team-members/route.js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { getSessionMember } from '@/lib/auth';
import { errorResponse, ApiError } from '@/lib/apiError';

const BASE_COLUMNS = 'id, name, is_active, is_global_admin, auth_user_id';

// 이메일·소속·직무·신청 브랜드는 배치 대기 화면에서 관리자가 "이 사람이
// 누구인지" 판단하는 데만 쓰인다. 담당자 드롭다운에는 이름이면 충분하므로
// 전체관리자에게만 실어 보낸다 — 필요 없는 사람에게까지 전사 이메일부를
// 내려 줄 이유가 없다.
const ADMIN_COLUMNS =
  `${BASE_COLUMNS}, email, affiliation, job_role, signed_up_at, requested_brand_id, ` +
  'can_view_all_projects, organization_id, ' +
  'organization:organizations(id, name, brand_id, default_tier, default_view_all_projects), ' +
  'jobRole:job_roles(id, name), ' +
  'requested_brand:brands!team_members_requested_brand_id_fkey(name)';

export async function GET(request) {
  try {
    // 목록 조회는 로그인한 모든 팀원이 필요로 한다(요구사항 담당자 표시,
    // 브랜드 설정의 팀 배치 등 1차가 아닌 사용자도 쓰는 화면이 많다) —
    // requireGlobalAdmin이 아니라 세션 존재만 확인한다.
    const { isGlobalAdmin } = await getSessionMember();

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const supabase = getSupabaseAdmin();

    function build(columns) {
      let q = supabase.from('team_members').select(columns).order('name');
      if (!includeInactive) q = q.eq('is_active', true);
      return q;
    }

    let { data, error } = await build(isGlobalAdmin ? ADMIN_COLUMNS : BASE_COLUMNS);
    // 42703 = undefined_column. 마이그레이션 0008 미적용 DB에서는 기본
    // 컬럼만으로 물러난다. 이 목록은 담당자 선택 등 여러 화면이 의존하므로
    // 새 컬럼 때문에 전부 멈추면 안 된다. 0008 적용 후 지워도 되는 분기다.
    if (error?.code === '42703') {
      ({ data, error } = await build(BASE_COLUMNS));
    }
    if (error) throw error;

    // 어떤 팀원이 아직 어느 브랜드에도 배치되지 않았는지. "배치 대기"는 별도
    // 상태가 아니라 그냥 user_brand_roles 행이 없는 팀원이다.
    // 배치 여부만 보던 것을 브랜드·등급까지 실어 보내도록 넓혔다.
    // 팀원 관리 화면에서 "이 사람 지금 몇 차지"를 보려면 브랜드 설정으로 들어가야
    // 했고, 그러면 등급을 바꿀 곳을 찾지 못한다.
    let assignedIds = null;
    let rolesByMember = null;
    if (isGlobalAdmin) {
      const { data: roles, error: rolesError } = await supabase
        .from('user_brand_roles')
        .select('team_member_id, brand_id, tier, brands(name)');
      if (rolesError) throw rolesError;
      assignedIds = new Set((roles ?? []).map((r) => r.team_member_id));
      rolesByMember = new Map();
      for (const r of roles ?? []) {
        const list = rolesByMember.get(r.team_member_id) ?? [];
        list.push({ brandId: r.brand_id, brandName: r.brands?.name ?? '', tier: r.tier });
        rolesByMember.set(r.team_member_id, list);
      }
    }

    // auth_user_id 는 화면 밖으로 내보내지 않는다. 계정 유무만 알면 되는데
    // 내부 식별자까지 실어 보낼 이유가 없다.
    const teamMembers = (data ?? []).map((row) => {
      const { auth_user_id, requested_brand, ...rest } = row;
      const base = { ...rest, hasAccount: Boolean(auth_user_id) };
      if (!isGlobalAdmin) return base;
      return {
        ...base,
        requestedBrandName: requested_brand?.name ?? null,
        hasBrandAssignment: assignedIds.has(row.id),
        // 브랜드 이름순으로 고정한다. 순서가 요청마다 바뀌면 화면의 셀렉트가
        // 자리를 옮겨서 잘못 누르게 된다.
        brandRoles: (rolesByMember.get(row.id) ?? []).sort((a, b) =>
          a.brandName.localeCompare(b.brandName),
        ),
      };
    });
    return Response.json({ teamMembers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;
    if (!name || !name.trim()) throw new ApiError(400, '이름은 필수입니다.');

    await requireGlobalAdmin();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('team_members')
      .insert({ name: name.trim(), is_active: true, is_global_admin: false })
      .select()
      .single();
    if (error) throw error;
    return Response.json({ teamMember: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
