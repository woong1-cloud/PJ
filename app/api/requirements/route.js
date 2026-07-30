import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';
import { INITIAL_STATUS, CLOSED_STATUSES } from '@/lib/statuses';
import { CHANNELS, DEFAULT_CHANNEL } from '@/lib/channels';

const BASE_COLUMNS =
  'id, priority, urgency, request_date, status, title, is_confidential, sprint_tag, duplicate_count, ' +
  'completed_at, expected_release_date, ' +
  'project_id, project:projects(id, name), ' +
  'requester:team_members!requirements_requester_fkey(id, name), ' +
  'assignee:team_members!requirements_assignee_fkey(id, name), ' +
  'category:brand_categories(id, category_name), ' +
  'requirement_images(count)';
const CHANNEL_COLUMNS = `${BASE_COLUMNS}, channel`;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const project = searchParams.get('project');
    const channel = searchParams.get('channel');
    const q = searchParams.get('q');
    // 이름은 'includeDone' 이지만 실제 의미는 "완료를 포함한 종결 상태 전체"다
    // (완료·반려·취소·중복). 목록 페이지와 보드가 이미 이 이름으로 쿼리를
    // 만들고 있어 지금 바꾸면 세 파일을 함께 고쳐야 하므로 이름은 둔다.
    const includeDone = searchParams.get('includeDone') === 'true';

    const { tier, isGlobalAdmin } = await requireBrandAccess(brandId, '4차');
    const canSeeConfidential = isGlobalAdmin || TIER_RANK[tier] >= TIER_RANK['3차'];

    const supabase = getSupabaseAdmin();

    function build(columns, { withChannel }) {
      let query = supabase
        .from('requirements')
        .select(columns)
        .eq('brand_id', brandId)
        .order('request_date', { ascending: false });

      if (!canSeeConfidential) query = query.eq('is_confidential', false);
      if (status) query = query.eq('status', status);
      if (assignee) query = query.eq('assignee', assignee);
      if (category) query = query.eq('category', category);
      if (priority) query = query.eq('priority', priority);
      if (project) query = query.eq('project_id', project);
      if (withChannel && channel) query = query.eq('channel', channel);
      if (q && q.trim()) query = query.ilike('title', `%${q.trim()}%`);
      // 종결된 건(완료·반려·취소·중복)은 기본으로 숨긴다. 끝난 건이 목록 상단을
      // 차지하면 지금 해야 할 일이 보이지 않는다.
      if (!includeDone) query = query.not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);
      return query;
    }

    let { data, error } = await build(CHANNEL_COLUMNS, { withChannel: true });
    // 42703 = undefined_column. 마이그레이션 0009 미적용 DB다. 이 목록은
    // 목록 페이지·보드·병합 다이얼로그가 모두 의존하므로, 새 컬럼 하나 때문에
    // 전부 500이 되면 안 된다. 물러날 때는 채널 필터도 함께 뺀다 — 없는
    // 컬럼으로는 거를 수 없기 때문이다(그 사이 채널 필터는 무시된다).
    // 0009 적용 후 지워도 되는 분기다.
    if (error?.code === '42703') {
      ({ data, error } = await build(BASE_COLUMNS, { withChannel: false }));
    }
    if (error) throw error;

    const requirements = (data ?? []).map((row) => {
      const { requirement_images, ...rest } = row;
      return { ...rest, image_count: requirement_images?.[0]?.count ?? 0 };
    });
    return Response.json({ requirements });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      brandId,
      priority,
      urgency,
      requestDate,
      category,
      title,
      asIs,
      toBe,
      note,
      isConfidential,
      channel,
    } = body;

    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (!title || !title.trim()) throw new ApiError(400, '제목은 필수입니다.');
    // 고정 목록 밖의 값은 거절한다. 자유 입력을 허용하면 채널별 집계가
    // 브랜드마다 다른 이름으로 흩어진다.
    if (channel && !CHANNELS.includes(channel)) {
      throw new ApiError(400, '유효하지 않은 채널입니다.');
    }

    const { memberId, isGlobalAdmin, tier } = await requireBrandAccess(brandId, '4차');
    const canSetConfidential = isGlobalAdmin || TIER_RANK[tier] >= TIER_RANK['3차'];

    const supabase = getSupabaseAdmin();
    const row = {
      brand_id: brandId,
      // 참고용 필드지만 비어 있으면 목록에서 노이즈가 된다. 기본값을 준다.
      priority: priority || '중',
      urgency: urgency || null,
      request_date: requestDate || new Date().toISOString().slice(0, 10),
      requester: memberId,
      category: category || null,
      title: title.trim(),
      as_is: asIs || null,
      to_be: toBe || null,
      note: note || null,
      is_confidential: canSetConfidential ? Boolean(isConfidential) : false,
      status: INITIAL_STATUS,
    };

    let { data, error } = await supabase
      .from('requirements')
      .insert({ ...row, channel: channel || DEFAULT_CHANNEL })
      .select()
      .single();
    // 42703 = undefined_column. 0009 미적용 DB에서 채널 하나 때문에 요구사항
    // 등록 자체가 막히면 안 된다. 0009 적용 후 지워도 되는 분기다.
    if (error?.code === '42703') {
      ({ data, error } = await supabase.from('requirements').insert(row).select().single());
    }
    if (error) throw error;
    return Response.json({ requirement: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
