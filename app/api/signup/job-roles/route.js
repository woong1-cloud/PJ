import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse } from '@/lib/apiError';

// 가입 화면은 비로그인 상태라 전체관리자 전용인 GET /api/job-roles 를 쓸 수
// 없다. GET /api/signup/organizations 와 같은 이유로 따로 둔다.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('job_roles')
      .select('id, name, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return Response.json({ jobRoles: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
