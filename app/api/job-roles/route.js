import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 직무 목록·생성.
//
// 전체관리자 전용이다 — 이 목록은 가입 화면에 그대로 노출된다.
export async function GET() {
  try {
    await requireGlobalAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('job_roles')
      .select('id, name, is_active, sort_order')
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return Response.json({ jobRoles: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    await requireGlobalAdmin();
    const body = await request.json();
    const { name, sortOrder } = body;
    if (!name || !String(name).trim()) throw new ApiError(400, '직무 이름은 필수입니다.');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('job_roles')
      .insert({
        name: String(name).trim(),
        // 새로 만든 직무는 '기타'(999) 앞에 붙는다. 순서를 안 정하면 이름
        // 순으로 아무 데나 끼어들어 목록이 매번 다르게 보인다.
        sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 500,
      })
      .select()
      .single();
    // 23505 = unique_violation. 같은 이름이 둘이면 가입 화면에 똑같은 선택지가
    // 두 번 뜨고, 고른 사람마다 다른 행에 들어간다.
    if (error?.code === '23505') throw new ApiError(409, '같은 이름의 직무가 이미 있습니다.');
    if (error) throw error;
    return Response.json({ jobRole: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
