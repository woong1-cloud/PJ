import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import { COMMENT_SELECT, MAX_COMMENT_BODY, normalizeCommentBody } from '@/lib/comments';
import { notifyComment } from '@/lib/notify';

// 요구사항 코멘트 목록/등록.
//
// 읽기·쓰기 모두 4차면 된다. 요청자가 자기가 올린 건에 대해 "이거 이번 주에
// 되나요?"를 묻는 것이 이 기능의 주 용도라, 실무자(3차)로 막으면 정작 물어볼
// 사람이 못 쓴다.
//
// 코멘트는 change_logs 에 남기지 않는다. change_logs 는 감사 기록이고 코멘트는
// 대화다. 코멘트를 달았다는 사실 자체를 감사 기록에 남기면, 지운 코멘트의
// 흔적이 지울 수 없는 표에 남아 "지웠는데 안 지워지는" 상태가 된다.

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const supabase = getSupabaseAdmin();
    await requireRequirementAccess(supabase, id, brandId, '4차');

    // 상세의 history 와 같은 오름차순이다. 화면에서 둘을 시간순으로 섞는데
    // 정렬 방향이 다르면 합치는 쪽에서 한 번 더 뒤집어야 한다.
    const { data, error } = await supabase
      .from('requirement_comments')
      .select(COMMENT_SELECT)
      .eq('requirement_id', id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return Response.json({ comments: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, body } = await request.json();

    const supabase = getSupabaseAdmin();
    const { memberId } = await requireRequirementAccess(supabase, id, brandId, '4차');

    const trimmed = normalizeCommentBody(body);
    if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
    if (trimmed.length > MAX_COMMENT_BODY) throw new ApiError(400, '내용이 너무 깁니다.');

    const { data, error } = await supabase
      .from('requirement_comments')
      .insert({ requirement_id: id, author: memberId, body: trimmed })
      .select(COMMENT_SELECT)
      .single();
    if (error) throw error;

    // 이 기능이 있는 이유 자체다 — 코멘트를 달아도 상대가 상세를 열기 전에는
    // 아무것도 알 수 없었다. 알림이 실패해도 코멘트는 이미 등록됐다.
    //
    // 본문을 함께 넘긴다. @멘션은 본문에서만 나오고, 누가 불렸는지는 서버가
    // 다시 만든 브랜드 팀 목록으로 판정한다(화면이 보낸 목록을 믿지 않는다).
    await notifyComment({ requirementId: id, actorId: memberId, body: trimmed });

    return Response.json({ comment: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
