import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { DONE_STATUS } from '@/lib/statuses';
import { canApprove } from '@/lib/approval';
import { computeCompletedAt } from '@/lib/completedAt';
import { notifyStatusChange } from '@/lib/notify';

const MAX_REASON = 500;

// 최종 승인 — 완료로 가는 유일한 길.
//
// PATCH .../status 가 완료를 받지 않기 때문에(DIRECT_STATUSES) 여기가 관문이다.
// 출발 상태를 가리지 않는다: 개발중에서 바로 와도 받는다. 절차를 강제하지
// 않되 건너뛴 사실은 상태 이력에 남는다 — 사소한 건까지 QA를 거치게 하면
// 사람들은 규칙을 우회할 방법부터 찾는다.
//
// 최소 등급이 4차인 것이 status 라우트(3차)와 다른 점이다. 승인은 요청한
// 브랜드가 "받았다"고 확인하는 행동이라 요청자도 할 수 있어야 한다.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, reason } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    // 무엇을 확인했는지가 안 남으면 이 단계를 만든 의미가 없다.
    if (!reason?.trim()) throw new ApiError(400, '확인 내용을 입력해 주세요.');
    if (reason.trim().length > MAX_REASON) {
      throw new ApiError(400, `확인 내용은 ${MAX_REASON}자 이하여야 합니다.`);
    }

    const { memberId, isGlobalAdmin } = await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, status, assignee, completed_at')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    const verdict = canApprove({
      requirement: current,
      actor: { memberId, isGlobalAdmin },
    });
    if (!verdict.allowed) throw new ApiError(403, verdict.reason);

    const nowIso = new Date().toISOString();
    const completedAt = computeCompletedAt(
      current.status,
      DONE_STATUS,
      current.completed_at,
      nowIso
    );

    const { error: updError } = await supabase
      .from('requirements')
      .update({ status: DONE_STATUS, completed_at: completedAt, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    // 상태 변경으로 기록한다. 별도 change_type 을 만들지 않는 이유:
    // lib/statusDurations.js 가 field_name === 'status' 로 걸러 구간을 계산하는데,
    // 그 필터에 걸리려면 여기도 같은 모양이어야 한다. 승인은 상태 변경의 한
    // 종류이고, 확인 내용은 반려·취소 사유와 같은 자리(comment)에 들어간다.
    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '상태변경',
      field_name: 'status',
      old_value: current.status,
      new_value: DONE_STATUS,
      comment: reason.trim(),
    });
    if (logError) throw logError;

    // 완료는 요청자가 가장 알고 싶어 하는 소식이다. 실패해도 조용히 넘어간다.
    await notifyStatusChange({ requirementId: id, actorId: memberId, status: DONE_STATUS });

    return Response.json({ ok: true, status: DONE_STATUS });
  } catch (error) {
    return errorResponse(error);
  }
}
