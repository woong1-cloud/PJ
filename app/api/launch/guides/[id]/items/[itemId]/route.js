import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 가이드 항목 하나를 지운다.
//
// 가이드는 지식이라 지우는 일이 드물지만, 손으로 넣어 보다가 잘못 넣은 것을
// 치울 길이 있어야 한다.
//
// 이미 복제된 런칭 항목은 안 지운다. launch_tasks.guide_item_id 가
// on delete set null 이라 연결만 끊긴다 — 진행 중인 런칭에서 항목이 사라지면
// 그 사이 체크한 것이 통째로 없어진다.
export async function DELETE(request, { params }) {
  try {
    const { id, itemId } = await params;
    await requireGlobalAdmin();

    const supabase = getSupabaseAdmin();
    const { data: item, error: findError } = await supabase
      .from('launch_guide_items')
      .select('id, guide_id, code')
      .eq('id', itemId)
      .maybeSingle();
    if (findError) throw findError;
    // 다른 가이드의 항목을 이 경로로 지울 수 없게 한다.
    if (!item || item.guide_id !== id) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    // 이 항목을 쓰고 있는 런칭이 몇 개인지 알려 준다. 지우고 나서 "왜
    // 연결이 끊겼지"가 되지 않게 화면이 미리 말할 수 있다.
    const { count } = await supabase
      .from('launch_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('guide_item_id', itemId);

    const { error } = await supabase.from('launch_guide_items').delete().eq('id', itemId);
    if (error) throw error;

    return Response.json({ ok: true, code: item.code, usedByLaunches: count ?? 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
