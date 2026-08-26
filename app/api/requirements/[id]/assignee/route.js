import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { notifyAssigneeChange } from '@/lib/notify';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId, assignee } = body; // assignee: team_member id 또는 null
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const { memberId } = await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, assignee')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    if (assignee) {
      // 담당자는 같은 브랜드 소속(또는 전역관리자)이어야 한다.
      const { data: role } = await supabase
        .from('user_brand_roles')
        .select('id')
        .eq('team_member_id', assignee)
        .eq('brand_id', brandId)
        .maybeSingle();
      const { data: adminMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('id', assignee)
        .eq('is_global_admin', true)
        .maybeSingle();
      if (!role && !adminMember) {
        throw new ApiError(400, '담당자는 해당 브랜드 소속이어야 합니다.');
      }
    }

    const { error: updError } = await supabase
      .from('requirements')
      .update({ assignee: assignee || null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updError) throw updError;

    // 담당자 변경을 감사 기록에 남긴다.
    //
    // 지금까지 이 라우트는 아무 로그도 남기지 않았다. 그래서 change_logs 만
    // 봐서는 담당자가 언제 누구로 정해졌는지 알 수 없다. 운영 로그 72건에
    // 담당자 변경이 한 줄도 없는 이유가 이것이다.
    //
    // 기록이 없으면 '마지막 활동' 계산에서도 배정이 통째로 빠진다 — 어제
    // 배정한 건이 20일 멈춘 것으로 잡혀 회의 안건에 오른다.
    //
    // change_type 을 '내용수정'과 나누는 이유: 회의 마치기가 "이 회의에서
    // 배정된 건"을 찾아야 하는데 '내용수정'은 field_name 없이 여러 필드를
    // 뭉뚱그린다.
    //
    // old/new 에 id 가 아니라 이름을 넣는다. 상태변경이 상태 이름을,
    // 예상일변경이 날짜 문자열을 그대로 넣는 것과 같은 규칙이고, 활동 피드가
    // 그 값을 그대로 그린다.
    if ((assignee || null) !== (current.assignee || null)) {
      const ids = [current.assignee, assignee].filter(Boolean);
      const names = new Map();
      if (ids.length > 0) {
        const { data: people } = await supabase
          .from('team_members')
          .select('id, name')
          .in('id', ids);
        for (const p of people ?? []) names.set(p.id, p.name);
      }
      const { error: logError } = await supabase.from('change_logs').insert({
        requirement_id: id,
        brand_id: brandId,
        changed_by: memberId,
        change_type: '담당자지정',
        field_name: 'assignee',
        old_value: current.assignee ? (names.get(current.assignee) ?? null) : null,
        new_value: assignee ? (names.get(assignee) ?? null) : null,
      });
      if (logError) throw logError;
    }

    // 담당자가 실제로 '새로' 바뀌었을 때만 알린다. 같은 사람을 다시 고르는
    // 저장은 아무 일도 아닌데, 그때마다 알림이 가면 벨이 금방 의미를 잃는다.
    // update 뒤에 부르는 이유: 수신자에 새 담당자가 들어가야 하고 그 값은
    // 갱신된 행에만 있다. 실패해도 조용히 넘어간다.
    if (assignee && assignee !== current.assignee) {
      await notifyAssigneeChange({ requirementId: id, actorId: memberId, assigneeId: assignee });
    }

    return Response.json({ ok: true, assignee: assignee || null });
  } catch (error) {
    return errorResponse(error);
  }
}
