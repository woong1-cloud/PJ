import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { computeProjectProgress } from '@/lib/projectProgress';
import { visibleRequirements } from '@/lib/visibleRequirements';
import { assertDateOrder, parseDateInput } from '@/lib/projectDates';
import { visibleProjects } from '@/lib/projectAccess';

export async function GET(request) {
  try {
    // 3차 실무자도 요구사항을 연결하려면 프로젝트를 봐야 하므로 로그인만 요구한다.
    const { memberId, isGlobalAdmin } = await getSessionMember();

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    // 로드맵이 막대 위에 점을 찍으려면 건별 제목·배포예상일이 필요하다.
    // 목록 화면은 진척률 숫자만 쓰므로 기본은 끈다 — 제목을 항상 실어 보내면
    // 비공개 판정을 안 해도 되는 화면에까지 그 책임이 번진다.
    const withRequirements = searchParams.get('withRequirements') === 'true';

    const supabase = getSupabaseAdmin();

    let projectQuery = supabase
      .from('projects')
      .select(
        'id, name, description, is_active, created_at, start_date, target_date, ' +
          'owner:team_members!projects_owner_fkey(id, name)',
      )
      .order('created_at', { ascending: false });
    if (!includeInactive) projectQuery = projectQuery.eq('is_active', true);

    const { data: projects, error: projectsError } = await projectQuery;
    if (projectsError) throw projectsError;

    const projectIds = (projects ?? []).map((p) => p.id);
    if (projectIds.length === 0) return Response.json({ projects: [] });

    const reqColumns = withRequirements
      ? 'id, title, project_id, brand_id, status, is_confidential, expected_release_date'
      : 'project_id, brand_id, status';

    const [pbResult, brandsResult, reqResult, myRoles, meResult] = await Promise.all([
      supabase.from('project_brands').select('project_id, brand_id, status').in('project_id', projectIds),
      supabase.from('brands').select('id, name'),
      supabase.from('requirements').select(reqColumns).in('project_id', projectIds),
      // 예전에는 withRequirements 일 때만 등급을 읽었다. 이제 권한 판정에
      // 항상 필요하므로 조건 없이 읽는다.
      supabase.from('user_brand_roles').select('brand_id, tier').eq('team_member_id', memberId),
      // 전사 열람 플래그. 등급과 직교하는 축이라 user_brand_roles 가 아니라
      // 사람에게 붙는다 — 법무팀·재무팀처럼 브랜드에 배치되지 않은 사람이
      // 어떤 프로젝트가 도는지 봐야 하는 경우를 위한 것이다.
      supabase
        .from('team_members')
        .select('can_view_all_projects')
        .eq('id', memberId)
        .maybeSingle(),
    ]);
    if (pbResult.error) throw pbResult.error;
    if (brandsResult.error) throw brandsResult.error;
    if (reqResult.error) throw reqResult.error;
    if (myRoles.error) throw myRoles.error;

    const allProjectBrands = pbResult.data ?? [];
    const brands = brandsResult.data ?? [];
    // allRequirements 는 진척률용이다. 여기에 비공개 필터를 걸면 분모가 사람마다
    // 달라져서 같은 프로젝트가 사람에 따라 다른 진척률로 보인다.
    const allRequirements = reqResult.data ?? [];
    const tierByBrand = new Map((myRoles.data ?? []).map((r) => [r.brand_id, r.tier]));

    let result = projects.map((project) => {
      const mine = allRequirements.filter((r) => r.project_id === project.id);
      const progress = computeProjectProgress({
        requirements: mine,
        projectBrands: allProjectBrands.filter((pb) => pb.project_id === project.id),
        brands,
      });
      const base = { ...project, byBrand: progress.byBrand, overall: progress.overall };
      if (!withRequirements) return base;
      // 응답에 실어 보내는 쪽은 반드시 필터를 통과한 것만. 진척률과 응답을
      // 바꿔 쓰면 한쪽은 사람마다 달라지고 다른 쪽은 비공개가 새어나간다.
      return {
        ...base,
        requirements: visibleRequirements(mine, { isGlobalAdmin, tierByBrand }).map((r) => ({
          id: r.id,
          title: r.title,
          project_id: r.project_id,
          status: r.status,
          expected_release_date: r.expected_release_date,
        })),
      };
    });

    // 여기서 두 단계로 거른다. 순서와 역할을 헷갈리면 안 된다.
    //
    // (1) 권한: 내가 배치된 브랜드에 전개된 프로젝트만. 서버가 판정한다.
    //     예전에는 이 단계가 없어서 클라이언트가 brandId 를 안 보내면 전사
    //     프로젝트가 그대로 나갔다 — '전사 전체' 버튼을 누르거나 API 를 직접
    //     부르면 스파오 4차가 미쏘 프로젝트를 볼 수 있었다.
    const myBrandIds = (myRoles.data ?? []).map((r) => r.brand_id);
    const canViewAllProjects = meResult.data?.can_view_all_projects === true;
    result = visibleProjects({
      projects: result,
      allProjectBrands,
      myBrandIds,
      canViewAllProjects,
      isGlobalAdmin,
    });

    // (2) 화면의 편의 필터: '내 브랜드' 탭이 보내는 brandId. 권한이 아니라
    //     보기 좁히기다. 이게 없어도 (1) 이 이미 막고 있다.
    if (brandId) {
      result = result.filter((p) => p.byBrand.some((b) => b.brandId === brandId));
    }

    return Response.json({ projects: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const { memberId } = await requireGlobalAdmin();

    const body = await request.json();
    const { name, description, owner } = body;
    if (!name || !name.trim()) throw new ApiError(400, '프로젝트 이름은 필수입니다.');
    const startDate = parseDateInput(body.startDate);
    const targetDate = parseDateInput(body.targetDate);
    assertDateOrder(startDate, targetDate);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner: owner || null,
        start_date: startDate,
        target_date: targetDate,
        created_by: memberId,
      })
      .select()
      .single();
    if (error) {
      // 23503 = FK 위반(없는 team_member), 22P02 = uuid 형식 오류.
      // 둘 다 클라이언트가 잘못 보낸 owner 값이므로 500이 아니라 400으로 돌려준다.
      if (error.code === '23503' || error.code === '22P02') {
        throw new ApiError(400, '유효하지 않은 담당자입니다.');
      }
      // 23514 = CHECK 위반. 여기서는 projects_date_order 뿐이다.
      if (error.code === '23514') {
        throw new ApiError(400, '목표일이 시작일보다 앞설 수 없습니다.');
      }
      throw error;
    }

    return Response.json({ project: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
