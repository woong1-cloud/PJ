import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { MAX_COMMENT_BODY, normalizeCommentBody } from '@/lib/comments';
import { recipientsForRoles, tooMany } from '@/lib/helpRequest';

// 협조 요청 보내기.
//
// 요청의 본체는 댓글이다(마이그레이션 0037). 새 표를 만들지 않으므로 "언제
// 누구에게 요청했더라"가 항목의 대화 안에 그대로 남는다.
//
// 문지기는 'member' 다. 막힌 항목을 밀어야 하는 사람이 곧 요청하는 사람이라
// 관리자로 막으면 정작 쓸 사람이 못 쓴다 — 댓글 라우트와 같은 판단이다.

export async function POST(request, { params }) {
  try {
    // params 를 먼저 푼다. requireLaunchAccess(id) 보다 뒤에 두면 id 가
    // 아직 없는 채로 문지기에 들어간다.
    const { id } = await params;
    const { memberId } = await requireLaunchAccess(id, 'member');
    const { taskIds, roles, message } = await request.json();

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new ApiError(400, '항목을 선택하세요.');
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new ApiError(400, '역할을 선택하세요.');
    }

    // 같은 값이 두 번 오면 아래의 "받은 개수와 찾은 개수" 비교가 항상 틀린다
    // (.in 은 중복을 한 행으로 돌려준다). 세기 전에 한 번만 남긴다.
    const ids = [...new Set(taskIds.filter(Boolean))];
    const wantedRoles = [...new Set(roles.filter((r) => typeof r === 'string' && r.trim()))];
    if (ids.length === 0) throw new ApiError(400, '항목을 선택하세요.');
    if (wantedRoles.length === 0) throw new ApiError(400, '역할을 선택하세요.');

    const supabase = getSupabaseAdmin();
    // 이 항목들이 정말 이 런칭의 것인지 본다. 접근 검사는 URL 의 런칭 기준으로
    // 이뤄지므로, 이 확인이 없으면 내가 낀 런칭 하나만 있으면 주소를 손으로
    // 고쳐 남의 런칭 항목에 요청을 넣을 수 있다.
    const { data: tasks, error: taskError } = await supabase
      .from('launch_tasks')
      .select('id, code, title')
      .in('id', ids)
      .eq('launch_id', id);
    if (taskError) throw taskError;
    if ((tasks ?? []).length !== ids.length) {
      throw new ApiError(404, '항목을 찾을 수 없습니다.');
    }

    // 받는 사람은 서버가 다시 만든다. 화면이 보내온 사람 목록을 믿지 않는다 —
    // lib/launchMentionable.js 가 "관문"이라고 부르는 그 규칙이다. select 모양도
    // mentionable 라우트(loadLaunchMentionable)와 같아야 recipientsForRoles 가
    // 기대하는 member 객체가 온다.
    const { data: members, error: memberError } = await supabase
      .from('launch_members')
      .select('member_id, role_name, member:team_members!launch_members_member_id_fkey(id, name, is_active)')
      .eq('launch_id', id);
    // loadLaunchMentionable 은 조회 실패를 삼키지만(자동완성은 편의다) 여기서는
    // 삼키면 안 된다. 빈 목록으로 이어가면 "그 역할에 참여자가 없습니다"라는
    // 틀린 이유를 보여 주고, 사람은 역할을 다시 고르며 헤맨다.
    if (memberError) throw memberError;

    const recipients = recipientsForRoles(members ?? [], wantedRoles);
    if (recipients.length === 0) throw new ApiError(400, '그 역할에 참여자가 없습니다.');
    if (tooMany(recipients.length)) throw new ApiError(400, '한 번에 20명까지 보낼 수 있습니다.');

    // body 는 not null 이다. 한마디를 안 적고 보내는 것이 정상 경로라
    // (역할만 고르고 보내는 것으로 충분할 때가 많다) 빈 값을 400 으로 막지 않고
    // 기본 문장을 넣는다.
    const trimmed = normalizeCommentBody(message);
    if (trimmed.length > MAX_COMMENT_BODY) throw new ApiError(400, '내용이 너무 깁니다.');
    const body = trimmed || '협조를 요청했습니다.';

    // 항목마다 한 줄. request_roles 가 차 있는 것이 곧 "이건 협조 요청"이라는
    // 표시이고, 24시간 검사도 이 칸으로 찾는다.
    //
    // 작성자는 문지기가 준 memberId 다. 화면이 보낸 값을 안 믿는다 —
    // 믿으면 남의 이름으로 요청할 수 있다.
    const { error: insertError } = await supabase
      .from('launch_task_comments')
      .insert(
        (tasks ?? []).map((task) => ({
          task_id: task.id,
          author: memberId,
          body,
          request_roles: wantedRoles,
        })),
      );
    if (insertError) throw insertError;

    // 화면이 센 수가 아니라 서버가 실제로 만든 수를 돌려준다.
    // recipientsForRoles 가 다시 쓰는 mentionableFromMembers 는 이름이 빈
    // 사람과 비활성을 조용히 뺀다 — 화면이 「5명」이라 해도 실제로 3명일 수
    // 있고, 화면은 이 수를 말해야 한다.
    return Response.json({ sent: recipients.length, tasks: (tasks ?? []).length });
  } catch (error) {
    return errorResponse(error);
  }
}
