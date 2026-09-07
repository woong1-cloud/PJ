import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin, requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

const DECIDED_STATUS = '결정';
const PENDING_STATUS = '대기';

function trimmedOrNull(value) {
  const t = String(value ?? '').trim();
  return t || null;
}

// 결정을 기록하거나 내용을 고친다.
//
// '결정' 으로 갈 때 decidedNote 가 비면 400 — 무엇으로 정했는지 없는 결정
// 기록은 6개월 뒤 아무 말도 못 한다. app/api/requirements 의 ApprovalDialog 와
// 같은 생각이다: "확인했다"가 아니라 "무엇을 확인했는지"를 남긴다.
//
// 상태를 자동으로 안 바꾼다. 결정이 났다고 그걸 기다리던 항목이 저절로
// 풀리는 것은 아니다 — 사람이 본다. 대신 그 항목 목록을 응답에 담아
// 화면이 그 자리에서 보여줄 수 있게 한다.
export async function PATCH(request, { params }) {
  try {
    const { id, decisionId } = await params;
    const { memberId } = await requireLaunchAccess(id, 'member');
    const body = await request.json();
    const patch = {};

    if (body.status !== undefined) {
      if (body.status === DECIDED_STATUS) {
        const note = String(body.decidedNote ?? '').trim();
        if (!note) throw new ApiError(400, '무엇으로 정했는지 적어 주세요.');
        patch.decided_note = note;
        patch.decided_at = new Date().toISOString();
        patch.decided_by = memberId;
      } else if (body.status === PENDING_STATUS) {
        // 대기로 되돌리면 결정의 흔적을 지운다. 남겨 두면 다음에 다시
        // 결정할 때 지난 메모가 그대로 붙어 나온다.
        patch.decided_at = null;
        patch.decided_by = null;
        patch.decided_note = null;
      }
      // '보류' 는 결정 기록을 안 건드린다 — 보류 자체가 아직 결정이 아니다.
      patch.status = body.status;
    }

    if (body.when_text !== undefined) patch.when_text = trimmedOrNull(body.when_text);
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new ApiError(400, '결정 항목을 입력하세요.');
      patch.title = title;
    }
    if (body.impact !== undefined) patch.impact = trimmedOrNull(body.impact);
    if (body.owner_text !== undefined) patch.owner_text = trimmedOrNull(body.owner_text);
    if (body.note !== undefined) patch.note = trimmedOrNull(body.note);
    // decidedNote 만 따로 고치는 경우(상태 변경 없이 메모를 정정) — 위에서
    // status === '결정' 처리 중 이미 채웠으면 다시 안 건드린다.
    if (body.decidedNote !== undefined && patch.decided_note === undefined) {
      patch.decided_note = trimmedOrNull(body.decidedNote);
    }

    if (Object.keys(patch).length === 0) throw new ApiError(400, '바꿀 내용이 없습니다.');
    patch.updated_at = new Date().toISOString();
    patch.updated_by = memberId;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('launch_decisions')
      .update(patch)
      .eq('id', decisionId)
      // 런칭 id 도 함께 건다. 주소를 손으로 고쳐 다른 런칭의 결정을
      // 건드리는 것을 막는다.
      .eq('launch_id', id)
      .select('*')
      .maybeSingle();
    // 23514 = check_violation. status 가 대기·결정·보류 밖일 때다.
    if (error?.code === '23514') throw new ApiError(400, '알 수 없는 상태입니다.');
    if (error) throw error;
    if (!data) throw new ApiError(404, '결정을 찾을 수 없습니다.');

    // 이 결정을 기다리던 막힌 항목들. "이걸 기다리던 3건" 을 화면이 그
    // 자리에서 보여줘야 한다.
    const { data: waiting, error: waitErr } = await supabase
      .from('launch_tasks')
      .select('id, code, title')
      .eq('launch_id', id)
      .eq('blocked_decision_id', decisionId);
    if (waitErr) throw waitErr;

    return Response.json({ decision: data, waiting: waiting ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// 결정을 지운다. blocked_decision_id 는 on delete set null 이라 막힌
// 항목이 고아가 되지 않는다 — 참조만 풀리고 항목은 그대로 남는다.
export async function DELETE(request, { params }) {
  try {
    const { id, decisionId } = await params;
    // 지우기는 관리자다. 결정을 지우면 그것을 기다리던 항목의 연결이
    // 풀리고, 참여자가 그걸 되돌릴 방법이 없다.
    await requireLaunchAccess(id, 'admin');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('launch_decisions')
      .delete()
      .eq('id', decisionId)
      .eq('launch_id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
