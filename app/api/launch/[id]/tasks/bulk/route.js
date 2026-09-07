import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin, requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { NA_STATUS, TODO_STATUS } from '@/lib/launchTask';

// 한 번에 여러 줄.
//
// 앱을 안 하기로 하면 18건이다. 한 줄씩 누르면 18번 클릭에 18번 입력이고,
// 그러면 아무도 안 한다. 엑셀에서는 복붙으로 되는 일이라 이게 없으면
// "차라리 엑셀이 낫다"가 된다.
const MAX = 500;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { memberId } = await requireLaunchAccess(id, 'member');
    const { taskIds, action, reason } = await request.json();

    const ids = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];
    // .in() 에 빈 배열을 넘기면 PostgREST 가 400 을 낸다.
    if (ids.length === 0) throw new ApiError(400, '고른 항목이 없습니다.');
    if (ids.length > MAX) throw new ApiError(400, '한 번에 처리할 수 있는 양을 넘었습니다.');

    const now = new Date().toISOString();
    let patch;

    if (action === 'not_applicable') {
      const text = String(reason ?? '').trim();
      if (!text) throw new ApiError(400, '해당없음 사유를 적어 주세요.');
      patch = {
        status: NA_STATUS,
        excluded_reason: text,
        excluded_at: now,
        excluded_by: memberId,
        blocked_reason: null,
        done_at: null,
      };
    } else if (action === 'restore') {
      patch = {
        status: TODO_STATUS,
        excluded_reason: null,
        excluded_at: null,
        excluded_by: null,
      };
    } else {
      throw new ApiError(400, '알 수 없는 동작입니다.');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('launch_tasks')
      .update({ ...patch, updated_at: now, updated_by: memberId })
      .eq('launch_id', id)
      .in('id', ids)
      .select('id');
    if (error) throw error;

    return Response.json({ ok: true, changed: (data ?? []).length });
  } catch (error) {
    return errorResponse(error);
  }
}
