import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import {
  RESOLVED_FEEDBACK_STATUS,
  normalizeFeedbackBody,
  validateStatusChange,
} from '@/lib/feedback';
import { notifyFeedbackResolved } from '@/lib/notify';

// 의견의 상태와 메모 — 전체 관리자 전용.
//
// requirementId 를 함께 받는다. 관리 화면에서 요구사항으로 승격했을 때 그
// 건을 이어 붙이는 자리다. 승격 자체는 기존 요구사항 등록 라우트가 하고,
// 여기는 이어 붙이기만 한다 — 등록 규칙을 두 벌 만들지 않는다.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();
    const { status, note, requirementId } = await request.json();

    const check = validateStatusChange({ status, note });
    if (!check.ok) throw new ApiError(400, check.error);

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('moa_feedback')
      .select('id, member_id, status')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '의견을 찾을 수 없습니다.');

    const trimmedNote = normalizeFeedbackBody(note);
    const resolving = status === RESOLVED_FEEDBACK_STATUS;

    const patch = {
      status,
      admin_note: trimmedNote || null,
      // 반영에서 벗어나면 지운다. 남겨 두면 '확인함'으로 되돌린 뒤에도
      // 화면이 "언제 반영됨"을 그린다.
      resolved_at: resolving ? new Date().toISOString() : null,
    };
    if (requirementId !== undefined) patch.requirement_id = requirementId || null;

    const { error: updError } = await supabase.from('moa_feedback').update(patch).eq('id', id);
    if (updError) throw updError;

    // 반영으로 처음 넘어갈 때만 알린다. 메모를 고칠 때마다 알림이 가면
    // 낸 사람은 같은 소식을 여러 번 받는다.
    if (resolving && current.status !== RESOLVED_FEEDBACK_STATUS) {
      await notifyFeedbackResolved({ memberId: current.member_id, note: trimmedNote });
    }

    return Response.json({ ok: true, status });
  } catch (error) {
    return errorResponse(error);
  }
}
