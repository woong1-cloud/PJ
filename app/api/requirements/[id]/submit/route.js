import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { INITIAL_STATUS, REVIEW_PENDING_STATUS } from '@/lib/statuses';
import { canSubmitForReview } from '@/lib/submitRequirement';
import { notifyStatusChange } from '@/lib/notify';

// 브랜드가 '검토 요청'을 누르는 길.
//
// PATCH .../status 를 재사용하지 않고 라우트를 따로 둔 이유:
// 그 라우트는 3차 이상만 통과하고, 그 게이트를 낮추면 4차가 검토중·개발중·완료로
// 도 넘길 수 있게 된다. 여기는 목적지가 검토대기 하나로 고정이라 등급을 낮춰도
// 열리는 문이 하나뿐이다. 권한을 넓히는 대신 문을 하나 더 낸 셈이다.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId } = body;
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    // 4차도 들어와야 하므로 최소 등급은 4차다. 실제 판정은 아래 순수 함수가 한다.
    const actor = await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, status, requester')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    // 다른 브랜드의 건을 id 만 알아내 제출하는 길을 막는다. requireBrandAccess 는
    // "이 사람이 이 브랜드에 속하는가"만 보므로 이 확인이 따로 필요하다.
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    if (!canSubmitForReview(current, actor)) {
      // 왜 안 되는지를 나눠 말해 준다. "권한이 없습니다" 하나로 뭉개면
      // 이미 제출한 건을 다시 누른 사람이 자기 권한을 의심하게 된다.
      if (current.status !== INITIAL_STATUS) {
        throw new ApiError(400, `이미 제출된 건입니다. (현재 ${current.status})`);
      }
      throw new ApiError(403, '본인이 등록한 요구사항만 검토 요청할 수 있습니다.');
    }

    const nowIso = new Date().toISOString();
    const { error: updError } = await supabase
      .from('requirements')
      .update({ status: REVIEW_PENDING_STATUS, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: actor.memberId,
      change_type: '상태변경',
      field_name: 'status',
      old_value: current.status,
      new_value: REVIEW_PENDING_STATUS,
    });
    if (logError) throw logError;

    // 상태는 이미 바뀌었다. 알림이 실패해도 조용히 넘어간다(notify 는 던지지 않는다).
    await notifyStatusChange({
      requirementId: id,
      actorId: actor.memberId,
      status: REVIEW_PENDING_STATUS,
    });

    return Response.json({ ok: true, status: REVIEW_PENDING_STATUS });
  } catch (error) {
    return errorResponse(error);
  }
}
