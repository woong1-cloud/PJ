import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import {
  COMMENT_SELECT,
  COMMENT_SELECT_WITH_IMAGES,
  MAX_COMMENT_BODY,
  normalizeCommentBody,
} from '@/lib/comments';
import { signCommentImages } from '@/lib/storage';
import { notifyComment, notifyAnswered } from '@/lib/notify';

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
      .select(COMMENT_SELECT_WITH_IMAGES)
      .eq('requirement_id', id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    // 서명은 짧게 살아 있는 URL 이라 매번 새로 만든다. 코멘트 전부의 시안을
    // 한 번에 서명한다 — 코멘트마다 부르면 대화 길이만큼 요청이 나간다.
    const comments = await signCommentImages(data ?? []);
    return Response.json({ comments });
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

    // 요청자가 말하면 확인 대기를 푼다.
    //
    // 크론으로 미루지 않는다 — "답했는데 화면이 그대로"인 구간이 생기고,
    // 그 구간에 요청자가 다시 답하면 같은 말이 두 번 올라온다.
    //
    // 판정은 여기서 안 한다(lib/awaitingAnswer.js 의 hasAnswered 와 같은
    // 규칙이지만, 방금 단 코멘트 하나만 보면 되므로 조건이 더 단순하다).
    // 실패해도 코멘트는 이미 등록됐다 — 조용히 넘어간다.
    await releaseAwaitingAnswer(supabase, id, memberId);

    // 방금 만든 코멘트에는 아직 시안이 없다. 화면이 이 id 로 이어서 올린다 —
    // 코멘트가 먼저 있어야 붙일 곳이 생기므로 순서를 뒤집을 수 없다.
    return Response.json({ comment: { ...data, images: [] } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// 요청자가 답했으면 확인 대기를 푼다.
//
// 이 함수는 절대 던지지 않는다. 코멘트는 이미 등록됐고, 여기서 500 을 돌리면
// 화면은 "코멘트 등록 실패"를 띄우는데 실제로는 등록된 상태다.
async function releaseAwaitingAnswer(supabase, requirementId, authorId) {
  try {
    const { data, error } = await supabase
      .from('requirements')
      .select('id, requester, awaiting_answer_since, awaiting_answer_comment_id')
      .eq('id', requirementId)
      .maybeSingle();
    if (error) throw error;
    // 확인 대기가 아니거나, 말한 사람이 요청자가 아니면 그대로 둔다.
    if (!data?.awaiting_answer_since || data.requester !== authorId) return;

    // 물어본 사람을 먼저 읽는다. 플래그를 지운 뒤에는 누구에게 알릴지 알 수
    // 없다 — 질문 코멘트의 작성자가 그 사람이다.
    let askedBy = null;
    if (data.awaiting_answer_comment_id) {
      const { data: q } = await supabase
        .from('requirement_comments')
        .select('author')
        .eq('id', data.awaiting_answer_comment_id)
        .maybeSingle();
      askedBy = q?.author ?? null;
    }

    const { error: updError } = await supabase
      .from('requirements')
      .update({ awaiting_answer_since: null, awaiting_answer_comment_id: null })
      .eq('id', requirementId);
    if (updError) throw updError;

    await notifyAnswered({ requirementId, askedBy, answeredBy: authorId });
  } catch (error) {
    console.error('확인 대기 해제 실패', requirementId, error);
  }
}
