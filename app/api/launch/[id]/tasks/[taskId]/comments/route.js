import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import {
  LAUNCH_COMMENT_SELECT,
  MAX_COMMENT_BODY,
  normalizeCommentBody,
} from '@/lib/comments';

// 런칭 항목 코멘트 목록/등록.
//
// 읽기·쓰기 모두 'member' 다. 이 기능의 주 용도가 "이거 이번 주에 되나요?"를
// 그 항목 자리에서 묻는 것이라, 관리자로 막으면 정작 물어볼 사람이 못 쓴다.
// 그 런칭을 못 여는 사람은 문지기가 이미 막는다.
//
// 코멘트는 감사 기록에 안 남긴다. 요구사항 쪽과 같은 판단이다 — 감사 기록은
// 기록이고 코멘트는 대화라, 지운 코멘트의 흔적이 지울 수 없는 표에 남으면
// "지웠는데 안 지워지는" 상태가 된다.

export async function GET(_request, { params }) {
  try {
    // params 를 먼저 푼다. requireLaunchAccess(id) 보다 뒤에 두면 id 가
    // 아직 없는 채로 문지기에 들어간다.
    const { id, taskId } = await params;
    await requireLaunchAccess(id, 'member');

    const supabase = getSupabaseAdmin();
    // 이 항목이 정말 이 런칭의 것인지 본다. 접근 검사는 URL 의 런칭 기준으로
    // 이뤄지므로, 이 확인이 없으면 내가 낀 런칭 하나만 있으면 주소를 손으로
    // 고쳐 남의 런칭 항목의 대화를 읽을 수 있다.
    const { data: task, error: taskError } = await supabase
      .from('launch_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('launch_id', id)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    // 오래된 것 위·새 것 아래. 활동 피드(lib/activityFeed.js)와 같은 방향이다 —
    // 방향이 다르면 화면에서 한 번 더 뒤집어야 한다.
    const { data, error } = await supabase
      .from('launch_task_comments')
      .select(LAUNCH_COMMENT_SELECT)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return Response.json({ comments: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { id, taskId } = await params;
    const { memberId } = await requireLaunchAccess(id, 'member');
    const { body } = await request.json();

    const trimmed = normalizeCommentBody(body);
    if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
    if (trimmed.length > MAX_COMMENT_BODY) throw new ApiError(400, '내용이 너무 깁니다.');

    const supabase = getSupabaseAdmin();
    // 저장하기 전에 이 항목이 이 런칭의 것인지 본다. tasks/[taskId] 의 update 가
    // .eq('launch_id', id) 를 함께 거는 것과 같은 이유다 — 주소를 손으로 고쳐
    // 다른 런칭의 항목에 댓글을 다는 길을 막는다.
    const { data: task, error: taskError } = await supabase
      .from('launch_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('launch_id', id)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    // 작성자는 문지기가 준 memberId 다. 화면이 보낸 값을 안 믿는다 —
    // 믿으면 남의 이름으로 말할 수 있다.
    const { data, error } = await supabase
      .from('launch_task_comments')
      .insert({ task_id: taskId, author: memberId, body: trimmed })
      .select(LAUNCH_COMMENT_SELECT)
      .single();
    if (error) throw error;

    return Response.json({ comment: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
