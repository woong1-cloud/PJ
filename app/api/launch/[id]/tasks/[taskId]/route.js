import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { LAUNCH_STATUSES, DONE_STATUS, BLOCKED_STATUS, NA_STATUS } from '@/lib/launchTask';

const TASK_SELECT =
  'id, code, workstream, category, title, channel, decision_org, owner_org, owner_role, support_role, depends_on, day_offset, deliverable, plain_text, note, is_critical, sort_order, status, blocked_reason, blocked_decision_id, done_at, excluded_reason, source, assignee:team_members!launch_tasks_assignee_fkey(id, name)';

// lib/launchImport.js 의 CODE 와 같아야 한다. 통합 WBS 가 07B-01 · 10A-03
// 을 쓴다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;

// 엑셀이 원본이던 열. 화면에서 고치면 그 줄은 엑셀에서 독립한다 —
// source 가 'manual' 로 올라가고, 다음 업로드가 이 줄을 안 덮는다
// (lib/launchReimport.js).
//
// code 는 없다. 코드가 엑셀 왕복의 못이라, 그게 바뀌면 다음 업로드가
// 같은 항목을 새것으로 본다.
const PLAN_FIELDS = [
  'title', 'workstream', 'category', 'channel', 'decision_org', 'owner_org',
  'owner_role', 'support_role', 'depends_on', 'day_offset', 'deliverable',
  'plain_text', 'is_critical', 'note',
];

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
      // 막힘을 벗어나면 이유도 · 걸려 있던 결정도 함께 지운다. 남겨 두면
      // 다음에 막혔을 때 지난 이유·결정이 그대로 붙어 나온다.
      if (body.status !== BLOCKED_STATUS) {
        patch.blocked_reason = null;
        patch.blocked_decision_id = null;
      }
    }
    // 막힌 이유·연결된 결정은 상태와 같이 올 수도, 따로 올 수도 있다. 상태가
    // '막힘'이 아닌 채로 오면 위에서 방금 null 로 밀었으므로 여기서 다시 안
    // 쓴다. body 값이 명시적으로 null 이면(BlockDialog 가 종류를 바꿀 때
    // 그렇게 보낸다) 그대로 null 로 — String(null) 은 "null" 이라는 글자가
    // 되어 버리므로 따로 갈라야 한다.
    if (body.blockedReason !== undefined && patch.blocked_reason !== null) {
      patch.blocked_reason = body.blockedReason === null ? null : String(body.blockedReason).trim() || null;
    }
    if (body.blockedDecisionId !== undefined && patch.blocked_decision_id !== null) {
      patch.blocked_decision_id = body.blockedDecisionId || null;
    }
    if (body.assignee !== undefined) patch.assignee = body.assignee || null;

    // 계획 열을 하나라도 고치면 엑셀에서 독립시킨다.
    //
    // 열 단위로 "이건 내 것, 저건 엑셀 것"을 추적하지 않는다. 476건에서
    // 어느 열이 누구 것인지 사람이 못 따라간다 — 항목 단위로 잘라야 한
    // 문장으로 설명된다.
    let touchedPlan = false;
    for (const field of PLAN_FIELDS) {
      if (body[field] === undefined) continue;
      touchedPlan = true;
      if (field === 'day_offset') {
        const n = Number(body[field]);
        if (!Number.isFinite(n)) throw new ApiError(400, 'D-day 를 숫자로 입력하세요.');
        patch.day_offset = Math.trunc(n);
      } else if (field === 'depends_on') {
        patch.depends_on = Array.isArray(body[field])
          ? body[field].filter((c) => CODE.test(String(c)))
          : [];
      } else if (field === 'is_critical') {
        patch.is_critical = body[field] === true;
      } else {
        const text = String(body[field] ?? '').trim();
        // 제목과 워크스트림은 비울 수 없다. 빈 제목은 목록에서 사라진
        // 것처럼 보인다.
        if ((field === 'title' || field === 'workstream') && !text) {
          throw new ApiError(400, `${field === 'title' ? '체크 항목' : '워크스트림'}을 입력하세요.`);
        }
        patch[field] = text || null;
      }
    }
    if (touchedPlan) patch.source = 'manual';

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
