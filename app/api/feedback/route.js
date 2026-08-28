import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse, ApiError } from '@/lib/apiError';
import { MAX_FEEDBACK_BODY, normalizeFeedbackBody } from '@/lib/feedback';
import { notifyFeedback } from '@/lib/notify';

// 의견 등록.
//
// 로그인한 사람이면 누구나. 등급을 안 본다 — 가장 불편한 사람이 권한이 가장
// 낮은 요청자이고, 그 사람의 말을 못 받으면 이 창구를 만든 뜻이 없다.
//
// 브랜드를 안 받는다. 의견은 모아 전체에 대한 것이지 어느 브랜드의 것이
// 아니다(0028).
export async function POST(request) {
  try {
    const { memberId } = await getSessionMember();
    const { body } = await request.json();

    const trimmed = normalizeFeedbackBody(body);
    if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
    if (trimmed.length > MAX_FEEDBACK_BODY) throw new ApiError(400, '내용이 너무 깁니다.');

    const supabase = getSupabaseAdmin();
    // member_id 는 세션에서 온다. 폼이 보낸 값을 믿지 않는다 — 남의 이름으로
    // 의견을 넣을 수 있으면 관리자가 읽고 답할 상대를 못 찾는다.
    const { data, error } = await supabase
      .from('moa_feedback')
      .insert({ member_id: memberId, body: trimmed })
      .select('id, created_at, member:team_members!moa_feedback_member_id_fkey(id, name)')
      .single();
    if (error) throw error;

    // 메일이 실패해도 의견은 이미 저장됐다. 여기서 500 을 돌리면 낸 사람은
    // 안 들어간 줄 알고 같은 말을 또 쓴다.
    await notifyFeedback({ name: data.member?.name, message: trimmed });

    return Response.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
