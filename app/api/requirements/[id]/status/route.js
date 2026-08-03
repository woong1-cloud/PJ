import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { DIRECT_STATUSES, MERGED_STATUS, DONE_STATUS } from '@/lib/statuses';
import { computeCompletedAt } from '@/lib/completedAt';
import { notifyStatusChange } from '@/lib/notify';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId, status } = body;
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (status === MERGED_STATUS) {
      throw new ApiError(400, "'중복'은 중복처리로만 설정할 수 있습니다.");
    }
    // 완료를 여기서 막는 것이 v1.4 의 핵심이다. 화면이 승인 창을 띄우게
    // 되어 있지만, 서버가 관문이어야 그 화면을 우회해도 막힌다.
    if (status === DONE_STATUS) {
      throw new ApiError(400, '완료는 승인 절차로만 처리할 수 있습니다.');
    }
    if (!DIRECT_STATUSES.includes(status)) {
      throw new ApiError(400, '유효하지 않은 상태입니다.');
    }

    const { memberId } = await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, status, completed_at')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');
    // 막는 것은 '중복'뿐이다. 병합은 관계가 얽혀 있어 되돌리기 어렵지만
    // 반려·취소는 그냥 상태라, 여기로 다시 보드 상태를 지정하면 재개된다.
    if (current.status === MERGED_STATUS) {
      throw new ApiError(400, '병합된 요구사항의 상태는 변경할 수 없습니다.');
    }
    // 같은 상태로의 '변경'은 아무 일도 아니다. 그런데 예전에는 이력을 남겼고,
    // 실제로 '대기 → 대기' 같은 행이 DB에 쌓였다. 보드에서 카드를 집었다가
    // 제자리에 놓기만 해도 기록이 생긴다. 이력이 지저분해지는 것도 문제지만,
    // 상태별 소요 시간을 이력에서 계산할 때 0초짜리 구간이 섞여 계산이 틀어진다.
    if (current.status === status) {
      return Response.json({ ok: true, status, unchanged: true });
    }

    const nowIso = new Date().toISOString();
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
    });
    if (logError) throw logError;

    // 상태는 이미 바뀌었다. 알림은 여기서 실패해도 조용히 넘어간다.
    await notifyStatusChange({ requirementId: id, actorId: memberId, status });

    return Response.json({ ok: true, status });
  } catch (error) {
    return errorResponse(error);
  }
}
