import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { REJECTED_STATUS, CANCELLED_STATUS, MERGED_STATUS } from '@/lib/statuses';
import { computeCompletedAt } from '@/lib/completedAt';
import { notifyStatusChange } from '@/lib/notify';

// 종결은 별도 라우트다. PATCH .../status 는 BOARD_STATUSES 만 허용하고
// 사유를 받지 않는다 — 두 가지가 정확히 종결과 다른 점이다.
const CLOSABLE = [REJECTED_STATUS, CANCELLED_STATUS];

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, status, reason } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (!CLOSABLE.includes(status)) throw new ApiError(400, '반려 또는 취소만 지정할 수 있습니다.');
    // 사유 없는 반려는 한 달 뒤에 아무도 이유를 모른다.
    if (!reason?.trim()) throw new ApiError(400, '사유를 입력해 주세요.');

    // 반려는 IT의 결정이므로 3차 이상. 취소는 요청한 브랜드가 거두는 것이라
    // 4차도 할 수 있어야 한다.
    const minTier = status === REJECTED_STATUS ? '3차' : '4차';
    const { memberId } = await requireBrandAccess(brandId, minTier);

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, status, completed_at')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');
    // 중복만 막는다. 병합은 관계가 얽혀 있어 되돌리기 어렵지만 반려·취소는
    // 그냥 상태라, 반려된 건을 취소로 바꾸는 것 정도는 막을 이유가 없다.
    if (current.status === MERGED_STATUS) {
      throw new ApiError(400, '병합된 요구사항은 종결할 수 없습니다.');
    }

    const nowIso = new Date().toISOString();
    // 종결은 완료가 아니므로 completed_at 을 남기면 안 된다. 완료 상태에서
    // 넘어오는 경우 기존 값을 지운다(computeCompletedAt 이 담당).
    const completedAt = computeCompletedAt(current.status, status, current.completed_at, nowIso);

    const { error: updError } = await supabase
      .from('requirements')
      .update({ status, completed_at: completedAt, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '상태변경',
      field_name: 'status',
      old_value: current.status,
      new_value: status,
      comment: reason.trim(),
    });
    if (logError) throw logError;

    // 반려·취소도 요청자에게는 가장 알아야 할 상태 변경이다. 실패해도 조용히 넘어간다.
    await notifyStatusChange({ requirementId: id, actorId: memberId, status });

    return Response.json({ ok: true, status });
  } catch (error) {
    return errorResponse(error);
  }
}
