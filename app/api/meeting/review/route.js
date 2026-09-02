import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { DONE_STATUS } from '@/lib/statuses';

// 한 번에 보낼 수 있는 개수. '전부 확인'이 이 값을 넘으면 나눠 보낸다.
const MAX_IDS = 200;

// 완료 건을 회의에서 확인했다고 표시한다(되돌리기 포함).
//
// 회의 화면과 같은 문턱(3차)이다. 이 표시는 팀이 훑고 넘어갔다는 뜻이라
// 요청자가 스스로 찍을 것이 아니다.
//
// 건별로 받는다. '회의 마치기'로 한꺼번에 처리하지 않는 이유: 안 본 것까지
// 확인됨이 되면 이 기능을 만든 뜻이 사라진다. 대신 화면의 '전부 확인'이
// 지금 보이는 id 를 전부 실어 보낸다 — 그건 사람이 그렇게 하겠다고 누른 것이다.
export async function POST(request) {
  try {
    const { brandId, ids, reviewed } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (list.length === 0) throw new ApiError(400, '확인할 건이 없습니다.');
    if (list.length > MAX_IDS) throw new ApiError(400, '한 번에 처리할 수 있는 양을 넘었습니다.');

    const { memberId } = await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    // 완료 건만 건드린다. 다른 상태에 이 표시가 붙으면 나중에 그 값이 무슨
    // 뜻인지 아무도 모른다.
    //
    // brand_id 를 함께 거는 것이 관문이다. id 만 믿으면 다른 브랜드의 건에
    // 표시를 찍을 수 있다 — 권한은 이 브랜드로만 확인했다.
    const { data, error } = await supabase
      .from('requirements')
      .update({
        meeting_reviewed_at: reviewed === false ? null : now,
        meeting_reviewed_by: reviewed === false ? null : memberId,
      })
      .in('id', list)
      .eq('brand_id', brandId)
      .eq('status', DONE_STATUS)
      .select('id');
    if (error) throw error;

    return Response.json({ ok: true, updated: (data ?? []).length });
  } catch (error) {
    return errorResponse(error);
  }
}
