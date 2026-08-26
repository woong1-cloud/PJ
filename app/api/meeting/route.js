import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { CLOSED_STATUSES } from '@/lib/statuses';
import { STALL_DAYS, groupByRequirement, stalledDays } from '@/lib/stalled';

// '이번 주'의 길이. meetingDigest 와 같은 값이라 화면과 메일이 같은 것을
// '신규'라고 부른다.
const PERIOD_DAYS = 7;

// 회의 화면이 필요한 것을 한 번에 준다.
//
// 미종결 건 전부를 정체 순으로 내려보내고, 필터 세 개는 화면에서 건다. 회의
// 중에 왔다 갔다 하는 조작이라 왕복이 없어야 한다. 브랜드 하나의 미종결 건은
// 지금 38건이고, 몇 배가 되어도 한 번에 보낼 만한 양이다.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    // 담당자 지정과 같은 문턱이다. 4차는 배정할 수 없으므로 이 화면에 들어올
    // 이유가 없다.
    await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    // FK 이름을 명시한다. team_members(id, name) 처럼 짧게 쓰면 PostgREST 가
    // 어느 관계를 타야 할지 못 고르고 PGRST201 로 죽는다 — requirements 에서
    // team_members 로 가는 FK 가 assignee·requester 둘이다.
    const { data: rows, error } = await supabase
      .from('requirements')
      .select(
        'id, title, status, created_at, expected_release_date, ' +
          'assignee:team_members!requirements_assignee_fkey(id, name), ' +
          'requester:team_members!requirements_requester_fkey(id, name)'
      )
      .eq('brand_id', brandId)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);
    if (error) throw error;

    const ids = (rows ?? []).map((r) => r.id);
    let changeLogs = [];
    let comments = [];
    // .in() 에 빈 배열을 넘기면 PostgREST 가 400 을 낸다. 요구사항이 하나도
    // 없는 새 브랜드에서 화면이 통째로 깨지는 자리다.
    if (ids.length > 0) {
      const { data: logs, error: logError } = await supabase
        .from('change_logs')
        .select('requirement_id, created_at')
        .in('requirement_id', ids);
      if (logError) throw logError;
      changeLogs = logs ?? [];

      const { data: rawComments, error: commentError } = await supabase
        .from('requirement_comments')
        .select('requirement_id, created_at')
        .in('requirement_id', ids);
      if (commentError) throw commentError;
      comments = rawComments ?? [];
    }

    const logsBy = groupByRequirement(changeLogs);
    const commentsBy = groupByRequirement(comments);
    const now = new Date().toISOString();
    const since = new Date(Date.parse(now) - PERIOD_DAYS * 86400000).toISOString();

    const items = (rows ?? [])
      .map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        expectedDate: r.expected_release_date,
        assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name } : null,
        requester: r.requester ? { id: r.requester.id, name: r.requester.name } : null,
        stalledDays: stalledDays({
          requirement: r,
          changeLogs: logsBy.get(r.id) ?? [],
          comments: commentsBy.get(r.id) ?? [],
          now,
        }),
        isNew: (r.created_at ?? '') >= since,
      }))
      // 오래 멈춘 것이 위. 여기서 정렬해 두면 화면의 기본 보기가 곧 회의
      // 진행 순서가 된다.
      .sort((a, b) => (b.stalledDays ?? 0) - (a.stalledDays ?? 0));

    return Response.json({
      summary: {
        stalled: items.filter((i) => (i.stalledDays ?? 0) >= STALL_DAYS).length,
        unassigned: items.filter((i) => !i.assignee).length,
        incoming: items.filter((i) => i.isNew).length,
      },
      // 기준일을 함께 내려보낸다. 화면이 14를 따로 갖고 있으면 상수를 고칠 때
      // 한쪽만 바뀐다.
      stallDays: STALL_DAYS,
      items,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
