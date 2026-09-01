import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import { COMMENT_SELECT, MAX_COMMENT_BODY, normalizeCommentBody } from '@/lib/comments';
import { notifyAsk } from '@/lib/notify';

// 요청자에게 요건을 묻는다.
//
// 왜 코멘트를 그냥 쓰지 않나: 코멘트만 달면 그 건은 여전히 '검토대기 27일'로
// 남는다. 화면은 "IT 가 27일째 안 집었다"고 말하는데 공은 요청자에게 넘어가
// 있다. 이 라우트는 묻는 일과 그 사실을 기록하는 일을 한 번에 한다.
//
// 3차 이상이다. 회의 화면과 같은 문턱이고, 요청자가 자기 건에 스스로 질문을
// 걸어 안건에서 빼는 길을 열어 두지 않는다.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, question } = await request.json();

    const supabase = getSupabaseAdmin();
    const { memberId } = await requireRequirementAccess(supabase, id, brandId, '3차');

    const trimmed = normalizeCommentBody(question);
    if (!trimmed) throw new ApiError(400, '무엇을 확인하고 싶은지 적어 주세요.');
    if (trimmed.length > MAX_COMMENT_BODY) throw new ApiError(400, '내용이 너무 깁니다.');

    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, requester, awaiting_answer_since')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    // 두 번 물으면 첫 질문을 가리키던 포인터가 덮여 "무엇을 물어봤는지"가
    // 사라진다. 더 물을 것이 있으면 코멘트로 단다.
    if (current.awaiting_answer_since) {
      throw new ApiError(400, '이미 확인 대기 중입니다. 더 물을 것은 코멘트로 남겨 주세요.');
    }
    if (!current.requester) {
      throw new ApiError(400, '요청자가 없는 건은 확인을 요청할 수 없습니다.');
    }

    // 코멘트를 먼저 만들고 그 id 로 가리킨다. 순서를 뒤집으면 가리킬 것이 없다.
    //
    // @멘션을 붙이지 않는다. 붙이면 멘션 메일과 겹쳐 한 사건에 두 통이 간다.
    const { data: comment, error: cmtError } = await supabase
      .from('requirement_comments')
      .insert({ requirement_id: id, author: memberId, body: trimmed })
      .select(COMMENT_SELECT)
      .single();
    if (cmtError) throw cmtError;

    const { error: updError } = await supabase
      .from('requirements')
      .update({
        awaiting_answer_since: new Date().toISOString(),
        awaiting_answer_comment_id: comment.id,
      })
      .eq('id', id);
    if (updError) throw updError;

    await notifyAsk({ requirementId: id, actorId: memberId, question: trimmed });

    return Response.json({ ok: true, comment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
