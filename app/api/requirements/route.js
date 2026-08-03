import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';
import { INITIAL_STATUS, REVIEW_PENDING_STATUS, CLOSED_STATUSES } from '@/lib/statuses';
import { HANDOFF_STATUSES } from '@/lib/redmineLink';
import { isValidType } from '@/lib/requirementTypes';
import { CHANNELS, DEFAULT_CHANNEL } from '@/lib/channels';

const BASE_COLUMNS =
  'id, priority, urgency, request_date, status, title, is_confidential, sprint_tag, duplicate_count, ' +
  'completed_at, expected_release_date, redmine_url, requirement_type, ' +
  'project_id, project:projects(id, name), ' +
  'requester:team_members!requirements_requester_fkey(id, name), ' +
  'assignee:team_members!requirements_assignee_fkey(id, name), ' +
  'category:brand_categories(id, category_name), ' +
  'requirement_images(count)';
const CHANNEL_COLUMNS = `${BASE_COLUMNS}, channel`;

// 본문(As-Is·To-Be·비고)은 기본 조회에 넣지 않는다. 목록 화면은 제목만
// 보여주는데 본문까지 실어 나르면 건수가 늘수록 그대로 낭비가 된다.
// CSV 내보내기처럼 본문이 필요한 호출만 detail=true 로 요청한다.
const DETAIL_SUFFIX = ', as_is, to_be, note';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');
    // '내 요청만' 토글이 보내는 값. 화면은 자기 id 를 넣지만 서버는 같은
    // 브랜드 안의 어떤 id 든 받는다 — 요청자 이름은 이미 목록에 다 보이므로
    // 이 필터로 새로 새는 정보가 없다. 비공개 판정은 아래 조건이 그대로 한다.
    const requester = searchParams.get('requester');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const project = searchParams.get('project');
    const channel = searchParams.get('channel');
    const q = searchParams.get('q');
    // 대시보드 '손볼 것'에서 링크로만 들어오는 값. 필터바에는 노출하지 않는다 —
    // 평소에 아무도 안 쓰는 셀렉트를 하나 더 만들 이유가 없다.
    //
    // assignee=none 처럼 기존 파라미터에 매직 문자열을 넣지 않는다. 그 자리는
    // uuid 자리이고, 특수값을 섞으면 규칙이 두 가지가 된다.
    const missing = searchParams.get('missing');
    // 이름은 'includeDone' 이지만 실제 의미는 "완료를 포함한 종결 상태 전체"다
    // (완료·반려·취소·중복). 목록 페이지와 보드가 이미 이 이름으로 쿼리를
    // 만들고 있어 지금 바꾸면 세 파일을 함께 고쳐야 하므로 이름은 둔다.
    const includeDone = searchParams.get('includeDone') === 'true';
    // CSV 내보내기 전용. 화면 목록은 본문을 쓰지 않는다.
    const detail = searchParams.get('detail') === 'true';

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
      if (requester) query = query.eq('requester', requester);
      if (type) query = query.eq('requirement_type', type);
      if (category) query = query.eq('category', category);
      if (priority) query = query.eq('priority', priority);
      if (project) query = query.eq('project_id', project);
      if (withChannel && channel) query = query.eq('channel', channel);
      if (missing === 'assignee') query = query.is('assignee', null);
      if (missing === 'expectedDate') query = query.is('expected_release_date', null);
      // 이것만 조건이 둘이다. '레드마인 미연결'은 컬럼이 비었다는 뜻이 아니라
      // "넘어갔어야 하는데 안 넘어갔다"는 뜻이라, 상태 조건이 함께 붙어야
      // 파라미터 이름과 결과가 일치한다. 작성중 건까지 잡아오면 대시보드
      // 숫자와 목록 건수가 어긋난다.
      if (missing === 'redmine') {
        query = query.is('redmine_url', null).in('status', HANDOFF_STATUSES);
      }
      if (q && q.trim()) query = query.ilike('title', `%${q.trim()}%`);
      // 종결된 건(완료·반려·취소·중복)은 기본으로 숨긴다. 끝난 건이 목록 상단을
      // 차지하면 지금 해야 할 일이 보이지 않는다.
      if (!includeDone) query = query.not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);
      return query;
    }

    const columns = detail ? CHANNEL_COLUMNS + DETAIL_SUFFIX : CHANNEL_COLUMNS;
    let { data, error } = await build(columns, { withChannel: true });
    // 42703 = undefined_column. 마이그레이션 0009 미적용 DB다. 이 목록은
    // 목록 페이지·보드·병합 다이얼로그가 모두 의존하므로, 새 컬럼 하나 때문에
    // 전부 500이 되면 안 된다. 물러날 때는 채널 필터도 함께 뺀다 — 없는
    // 컬럼으로는 거를 수 없기 때문이다(그 사이 채널 필터는 무시된다).
    // 0009 적용 후 지워도 되는 분기다.
    if (error?.code === '42703') {
      ({ data, error } = await build(
        detail ? BASE_COLUMNS + DETAIL_SUFFIX : BASE_COLUMNS,
        { withChannel: false }
      ));
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
      requirementType,
      submit,
    } = body;

    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (!title || !title.trim()) throw new ApiError(400, '제목은 필수입니다.');
    // 고정 목록 밖의 값은 거절한다. 자유 입력을 허용하면 채널별 집계가
    // 브랜드마다 다른 이름으로 흩어진다.
    if (channel && !CHANNELS.includes(channel)) {
      throw new ApiError(400, '유효하지 않은 채널입니다.');
    }
    // 화면에서 필수로 받지만 서버가 관문이다. 자유 입력을 허용하면 유형별
    // 집계가 브랜드마다 다른 이름으로 흩어진다(채널과 같은 이유).
    if (requirementType && !isValidType(requirementType)) {
      throw new ApiError(400, '유효하지 않은 요구사항 유형입니다.');
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
      // 0019 이전 건은 null(미분류)이다. 새로 등록되는 건은 화면이 필수로 받는다.
      requirement_type: requirementType || null,
      // 등록하면서 바로 제출할 수 있다.
      //
      // 예전에는 무조건 INITIAL_STATUS('작성중')로 들어갔고, 거기서 검토대기로
      // 올리는 길은 PATCH .../status 하나뿐인데 그건 3차 이상만 쓸 수 있었다.
      // 브랜드 가입자의 기본 등급은 4차다 — 즉 요청자가 자기 요구사항을
      // 제출할 방법이 없었고, 올린 건은 아무도 보지 않는 '작성중'에 머물렀다.
      // 올린 사람은 접수됐다고 믿고 IT 는 존재를 몰랐다.
      //
      // 여기서 고르는 값은 두 개뿐이다(작성중/검토대기). 자기가 지금 만드는
      // 건의 초기 상태를 정하는 것이라 등급을 더 볼 필요가 없다. 그 뒤의
      // 진행(검토중·개발중·완료)은 여전히 3차 이상만 움직인다.
      status: submit === true ? REVIEW_PENDING_STATUS : INITIAL_STATUS,
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
