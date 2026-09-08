import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import {
  LAUNCH_COMMENT_SELECT,
  MAX_COMMENT_BODY,
  canModifyComment,
  normalizeCommentBody,
} from '@/lib/comments';

// 런칭 항목 코멘트 수정/삭제.
//
// 작성자 본인만 할 수 있다. 전체 관리자도 남의 코멘트는 못 고치고 못 지운다 —
// 남의 말을 조용히 바꿔놓는 수정 버튼은 없느니만 못하다. 요구사항 쪽과 같은
// 판단이라 판정도 같은 함수(canModifyComment)를 쓴다.

// 이 항목의, 이 코멘트인지까지 확인하고 행을 돌려준다.
//
// task_id 를 함께 견준다. 주소를 고쳐 같은 런칭 안 다른 항목의 코멘트를
// 건드리는 길을 막는다 — 항목이 이 런칭의 것인지는 부르는 쪽이 먼저 본다.
async function loadComment(supabase, taskId, commentId) {
  const { data, error } = await supabase
    .from('launch_task_comments')
    .select('id, task_id, author')
    .eq('id', commentId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.task_id !== taskId) {
    throw new ApiError(404, '코멘트를 찾을 수 없습니다.');
  }
  return data;
}

// author 를 직접 === 로 견주지 않는다. 조회 방식에 따라 문자열일 수도
// 객체일 수도 있어서, 한쪽 모양만 알면 본인인데도 조용히 false 가 된다.
function requireAuthor(comment, memberId) {
  if (!canModifyComment(comment, memberId)) {
    throw new ApiError(403, '작성자만 수정하거나 삭제할 수 있습니다.');
  }
}

export async function PATCH(request, { params }) {
  try {
    // params 를 먼저 푼다. requireLaunchAccess(id) 보다 뒤에 두면 id 가
    // 아직 없는 채로 문지기에 들어간다.
    const { id, taskId, commentId } = await params;
    const { memberId } = await requireLaunchAccess(id, 'member');
    const { body } = await request.json();

    const supabase = getSupabaseAdmin();
    // 이 항목이 이 런칭의 것인지 먼저 본다. 주소를 손으로 고쳐 다른 런칭의
    // 항목에 달린 코멘트를 건드리는 길을 막는다.
    const { data: task, error: taskError } = await supabase
      .from('launch_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('launch_id', id)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    const existing = await loadComment(supabase, taskId, commentId);
    requireAuthor(existing, memberId);

    const trimmed = normalizeCommentBody(body);
    if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
    if (trimmed.length > MAX_COMMENT_BODY) throw new ApiError(400, '내용이 너무 깁니다.');

    // edited_at 을 채운다. 화면에 "수정됨"을 붙이기 위한 것이다 — 지금 보이는
    // 문장이 처음 쓴 그대로인지 아닌지는 읽는 사람이 알아야 한다.
    const { data, error } = await supabase
      .from('launch_task_comments')
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq('id', commentId)
      // 항목도 함께 건다. 위에서 이미 확인했지만, 확인과 쓰기 사이가 벌어져
      // 있어 쓰는 손에도 같은 범위를 걸어 둔다.
      .eq('task_id', taskId)
      .select(LAUNCH_COMMENT_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, '코멘트를 찾을 수 없습니다.');

    return Response.json({ comment: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id, taskId, commentId } = await params;
    const { memberId } = await requireLaunchAccess(id, 'member');

    const supabase = getSupabaseAdmin();
    // 지우기도 같다 — 이 항목이 이 런칭의 것인지 먼저 본다.
    const { data: task, error: taskError } = await supabase
      .from('launch_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('launch_id', id)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    const existing = await loadComment(supabase, taskId, commentId);
    requireAuthor(existing, memberId);

    const { error } = await supabase
      .from('launch_task_comments')
      .delete()
      .eq('id', commentId)
      .eq('task_id', taskId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
