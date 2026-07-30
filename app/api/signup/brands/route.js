import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse } from '@/lib/apiError';

// 가입 화면은 비로그인 상태라 전체관리자 전용인 GET /api/brands를 쓸 수 없다.
// 여기서는 활성 브랜드의 id·name 만 내려준다 — code·workflow_template 같은
// 내부 정보는 가입 화면에 필요 없고, 필요 없는 건 내보내지 않는다.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return Response.json({ brands: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
