import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 직무 수정.
//
// DELETE 는 만들지 않는다(조직과 같은 이유). 지우면 그 직무로 가입한 사람의
// 기록이 깨진다. 끄는 것은 is_active 를 false 로 바꾸는 것이고, 그러면 가입
// 화면에서만 빠지고 기존 팀원 표시에는 남는다.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();
    const body = await request.json();
    const { name, isActive, sortOrder } = body;

    const updates = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw new ApiError(400, '직무 이름은 필수입니다.');
      updates.name = String(name).trim();
    }
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
      updates.sort_order = Number(sortOrder);
    }
    if (Object.keys(updates).length === 0) throw new ApiError(400, '변경할 값이 없습니다.');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('job_roles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error?.code === '23505') throw new ApiError(409, '같은 이름의 직무가 이미 있습니다.');
    if (error) throw error;
    if (!data) throw new ApiError(404, '직무를 찾을 수 없습니다.');
    return Response.json({ jobRole: data });
  } catch (error) {
    return errorResponse(error);
  }
}
