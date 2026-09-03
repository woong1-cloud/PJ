import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { LAUNCH_STATUSES, DONE_STATUS, BLOCKED_STATUS, NA_STATUS } from '@/lib/launchTask';

const TASK_SELECT =
  'id, code, workstream, category, title, channel, decision_org, owner_org, owner_role, support_role, depends_on, day_offset, deliverable, note, is_critical, sort_order, status, blocked_reason, done_at, excluded_reason, source, assignee:team_members!launch_tasks_assignee_fkey(id, name)';

// 항목 하나를 고친다 — 보드에서 상태를 누르는 것이 대부분이다.
//
// 여기서 지키는 것 둘:
//  - 완료 시각은 서버가 찍는다. 완료를 풀면 지운다 — 안 지우면 "완료 아닌데
//    완료한 날이 있는" 줄이 남고, 나중에 실적을 세는 쪽이 그걸 믿는다.
//  - 막힘이 풀리면 막힌 이유도 지운다. 남겨 두면 다음에 막혔을 때 지난 이유가
//    그대로 붙어 나온다.
export async function PATCH(request, { params }) {
  try {
    const { memberId } = await requireGlobalAdmin();
    const { id, taskId } = await params;
    const body = await request.json();
    const patch = {};

    if (body.status !== undefined) {
      if (!LAUNCH_STATUSES.includes(body.status)) throw new ApiError(400, '알 수 없는 상태입니다.');

      // 해당없음은 사유가 필수다. 사유 없는 해당없음은 6개월 뒤 아무 말도
      // 못 한다 — 다음 브랜드가 "HOKA는 왜 앱을 뺐지"에 답해야 한다.
      if (body.status === NA_STATUS) {
        const reason = String(body.excludedReason ?? '').trim();
        if (!reason) throw new ApiError(400, '해당없음 사유를 적어 주세요.');
        patch.excluded_reason = reason;
        patch.excluded_at = new Date().toISOString();
        patch.excluded_by = memberId;
      } else {
        // 되돌아오면 사유도 지운다. 남겨 두면 다음에 뺄 때 지난 사유가
        // 그대로 붙어 나온다.
        patch.excluded_reason = null;
        patch.excluded_at = null;
        patch.excluded_by = null;
      }

      patch.status = body.status;
      patch.done_at = body.status === DONE_STATUS ? new Date().toISOString() : null;
      if (body.status !== BLOCKED_STATUS) patch.blocked_reason = null;
    }
    // 막힌 이유는 상태와 같이 올 수도, 따로 올 수도 있다. 상태가 '막힘'이
    // 아닌 채로 오면 위에서 방금 null 로 밀었으므로 여기서 다시 안 쓴다.
    if (body.blockedReason !== undefined && patch.blocked_reason !== null) {
      patch.blocked_reason = String(body.blockedReason).trim() || null;
    }
    if (body.assignee !== undefined) patch.assignee = body.assignee || null;
    if (body.note !== undefined) patch.note = body.note || null;

    if (Object.keys(patch).length === 0) throw new ApiError(400, '바꿀 내용이 없습니다.');
    patch.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('launch_tasks')
      .update(patch)
      .eq('id', taskId)
      // 런칭 id 도 함께 건다. 주소를 손으로 고쳐 다른 런칭의 항목을 건드리는
      // 것을 막는다.
      .eq('launch_id', id)
      .select(TASK_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    return Response.json({ task: data });
  } catch (error) {
    return errorResponse(error);
  }
}

// 항목을 지운다.
//
// 해당없음과 다른 일이다. 해당없음은 "이 브랜드에는 안 하는 일"이라 이유가
// 남고 다음 브랜드를 위한 기록이 되지만, 지우기는 잘못 넣은 것을 치우는
// 일이다. 화면에서도 구분선 아래에 둔다.
export async function DELETE(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id, taskId } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('launch_tasks')
      .delete()
      .eq('id', taskId)
      // 런칭 id 도 함께 건다. 주소를 손으로 고쳐 다른 런칭의 항목을
      // 지우는 것을 막는다.
      .eq('launch_id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
