import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse } from '@/lib/apiError';

// 가입 화면은 비로그인 상태라 전체관리자 전용인 GET /api/organizations 를
// 쓸 수 없다. GET /api/signup/brands 와 같은 이유로 따로 둔다.
//
// default_tier 와 default_view_all_projects 는 내려보내지 않는다.
// 가입 화면에 필요한 것은 이름과 그룹뿐이고, 등급 구조를 밖에서 알 이유가
// 없다. 필요 없는 것을 내보내지 않는 것이 이 라우트의 요점이다.
//
// brand_id 는 내려보낸다 — 값 자체는 비밀이 아니고(브랜드 목록은 이미
// /api/signup/brands 로 공개돼 있다), 화면이 브랜드/본부 그룹을 가르는
// 데 필요하다.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, brand_id, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return Response.json({ organizations: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
