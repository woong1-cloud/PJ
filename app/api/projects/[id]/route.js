import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { computeProjectProgress } from '@/lib/projectProgress';
import { visibleRequirements } from '@/lib/visibleRequirements';
import { assertDateOrder, parseDateInput } from '@/lib/projectDates';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { memberId, isGlobalAdmin } = await getSessionMember();

    const supabase = getSupabaseAdmin();

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(
        'id, name, description, is_active, created_at, start_date, target_date, ' +
          'owner:team_members!projects_owner_fkey(id, name)',
      )
      .eq('id', id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new ApiError(404, '프로젝트를 찾을 수 없습니다.');

    const [pbResult, brandsResult, reqResult, rolesResult] = await Promise.all([
      supabase.from('project_brands').select('brand_id, status').eq('project_id', id),
      supabase.from('brands').select('id, name'),
      supabase
        .from('requirements')
        .select(
          'id, brand_id, priority, urgency, request_date, status, title, is_confidential, ' +
            'duplicate_count, ' +
            'assignee:team_members!requirements_assignee_fkey(id, name), ' +
            'category:brand_categories(id, category_name), ' +
            'requirement_images(count)',
        )
        .eq('project_id', id)
        .order('request_date', { ascending: false }),
      supabase.from('user_brand_roles').select('brand_id, tier').eq('team_member_id', memberId),
    ]);
    if (pbResult.error) throw pbResult.error;
    if (brandsResult.error) throw brandsResult.error;
    if (reqResult.error) throw reqResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const projectBrands = pbResult.data ?? [];
    const brands = brandsResult.data ?? [];

    // 비공개 판정 규칙은 lib/visibleRequirements.js 한 곳에 있다.
    // 프로젝트 목록 라우트도 같은 함수를 쓴다 — 규칙이 두 곳에 적혀 있으면
    // 한쪽만 고쳐지고, 새는 방향의 실수는 조용하다.
    const tierByBrand = new Map((rolesResult.data ?? []).map((r) => [r.brand_id, r.tier]));

    // allRequirements와 visible을 절대 바꿔 쓰면 안 된다.
    // - 진척률에 visible을 쓰면 분모가 사람마다 달라진다(같은 프로젝트가 다르게 보임).
    // - 응답에 all을 쓰면 비공개 요구사항이 그대로 새어나간다.
    const allRequirements = reqResult.data ?? [];
    const visible = visibleRequirements(allRequirements, { isGlobalAdmin, tierByBrand }).map(
      (row) => {
        const { requirement_images, ...rest } = row;
        return { ...rest, image_count: requirement_images?.[0]?.count ?? 0 };
      },
    );

    const progress = computeProjectProgress({
      requirements: allRequirements,
      projectBrands,
      brands,
    });

    return Response.json({
      project,
      byBrand: progress.byBrand,
      overall: progress.overall,
      requirements: visible,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();

    const body = await request.json();
    const patch = {};
    if (body.name !== undefined) {
      if (!body.name || !body.name.trim()) throw new ApiError(400, '프로젝트 이름은 필수입니다.');
      patch.name = body.name.trim();
    }
    if (body.description !== undefined) patch.description = body.description?.trim() || null;
    if (body.owner !== undefined) patch.owner = body.owner || null;
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
    const startDate = parseDateInput(body.startDate);
    const targetDate = parseDateInput(body.targetDate);
    if (startDate !== undefined) patch.start_date = startDate;
    if (targetDate !== undefined) patch.target_date = targetDate;
    // 두 날짜를 같이 보냈으면 여기서 잡는다. 한쪽만 보낸 경우는 저장된 값과
    // 비교해야 하는데 그 판정은 DB CHECK(projects_date_order)에 맡긴다 —
    // 읽고 나서 쓰는 사이에 다른 요청이 끼어들면 여기서 한 검사는 무의미해진다.
    assertDateOrder(startDate, targetDate);
    if (Object.keys(patch).length === 0) throw new ApiError(400, '변경할 내용이 없습니다.');
    patch.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      // POST /api/projects와 동일하게 처리한다 — 같은 잘못된 owner가 생성과 수정에서
      // 서로 다른 상태 코드를 내면 클라이언트 에러 처리가 갈린다.
      if (error.code === '23503' || error.code === '22P02') {
        throw new ApiError(400, '유효하지 않은 담당자입니다.');
      }
      // 23514 = CHECK 위반. 여기서는 projects_date_order 뿐이다 —
      // 한쪽 날짜만 보내서 저장된 값과 뒤집히는 경우가 이 길로 온다.
      if (error.code === '23514') {
        throw new ApiError(400, '목표일이 시작일보다 앞설 수 없습니다.');
      }
      throw error;
    }
    if (!data) throw new ApiError(404, '프로젝트를 찾을 수 없습니다.');

    return Response.json({ project: data });
  } catch (error) {
    return errorResponse(error);
  }
}
