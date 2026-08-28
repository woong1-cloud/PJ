import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { CLOSED_STATUSES, DONE_STATUS } from '@/lib/statuses';
import { closureReason } from '@/lib/closureReason';
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
    const doneSince = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();
    const { data: rows, error } = await supabase
      .from('requirements')
      .select(
        'id, title, status, created_at, completed_at, expected_release_date, ' +
          'assignee:team_members!requirements_assignee_fkey(id, name), ' +
          'requester:team_members!requirements_requester_fkey(id, name)'
      )
      .eq('brand_id', brandId)
      // 미종결 + 지난 7일 안에 완료된 것.
      //
      // 완료를 함께 가져오는 이유: 회의 화면이 밀린 것만 보여주고 있었다.
      // 요약 칩 셋이 전부 문제를 세는 숫자라 회의가 나쁜 소식으로만 시작한다.
      //
      // 종결 전체를 가져오지는 않는다. 완료 11건이 다 딸려오면 목록이 흐려진다 —
      // 회의는 "이번 주에 뭘 끝냈나"를 보는 자리이지 완료 이력을 보는 자리가
      // 아니다.
      //
      // 반려·취소·중복은 넣지 않는다. 끝낸 것이 아니라 안 하기로 한 것이라,
      // 성과 칸에 섞이면 숫자가 거짓말을 한다.
      .or(
        `status.not.in.(${CLOSED_STATUSES.join(',')}),` +
          `and(status.eq.${DONE_STATUS},completed_at.gte.${doneSince})`
      );
    if (error) throw error;

    const ids = (rows ?? []).map((r) => r.id);
    let changeLogs = [];
    let comments = [];
    // .in() 에 빈 배열을 넘기면 PostgREST 가 400 을 낸다. 요구사항이 하나도
    // 없는 새 브랜드에서 화면이 통째로 깨지는 자리다.
    if (ids.length > 0) {
      const { data: logs, error: logError } = await supabase
        .from('change_logs')
        // 완료 건의 승인 확인 내용을 만들려면 comment 가 필요하다. 같은
        // 쿼리에 컬럼 셋을 더하는 것은 행이 늘지 않으므로 거의 공짜다.
        .select('requirement_id, created_at, field_name, new_value, comment')
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
      .map((r) => {
        const rowLogs = logsBy.get(r.id) ?? [];
        const done = r.status === DONE_STATUS;
        return {
          id: r.id,
          title: r.title,
          status: r.status,
          expectedDate: r.expected_release_date,
          assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name } : null,
          requester: r.requester ? { id: r.requester.id, name: r.requester.name } : null,
          stalledDays: stalledDays({
            requirement: r,
            changeLogs: rowLogs,
            comments: commentsBy.get(r.id) ?? [],
            now,
          }),
          isNew: (r.created_at ?? '') >= since,
          isDone: done,
          // 완료 건은 경과가 아니라 소요를 말한다. 상세 머리 줄과 같은 규칙이다 —
          // 끝난 일에 경과를 붙이면 시간이 갈수록 숫자가 커져 나쁜 소식처럼 읽힌다.
          tookDays:
            done && r.created_at && r.completed_at
              ? Math.floor((Date.parse(r.completed_at) - Date.parse(r.created_at)) / 86400000)
              : null,
          // 승인 확인 내용. 상세 배너와 같은 함수를 쓰므로 문구가 갈리지 않는다.
          closure: closureReason({ requirement: r, changeLogs: rowLogs }),
        };
      })
      // 오래 멈춘 것이 위. 여기서 정렬해 두면 화면의 기본 보기가 곧 회의
      // 진행 순서가 된다.
      .sort((a, b) => (b.stalledDays ?? 0) - (a.stalledDays ?? 0));

    return Response.json({
      summary: {
        stalled: items.filter((i) => (i.stalledDays ?? 0) >= STALL_DAYS).length,
        // 완료 건은 빼고 센다. 목록에 들어오면서 담당자 없이 끝난 건이
        // '담당 없음'으로 세어지는데, 그건 지금 손볼 일이 아니다.
        unassigned: items.filter((i) => !i.assignee && !i.isDone).length,
        incoming: items.filter((i) => i.isNew).length,
        done: items.filter((i) => i.isDone).length,
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
