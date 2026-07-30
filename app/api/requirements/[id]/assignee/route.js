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
