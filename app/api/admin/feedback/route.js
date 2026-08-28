import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse } from '@/lib/apiError';

// 의견 목록 — 전체 관리자 전용.
//
// FK 이름을 명시한다. moa_feedback 에서 team_members 로 가는 FK 는 지금
// member_id 하나뿐이지만, 나중에 누가 handled_by 같은 컬럼을 붙이는 순간
// PostgREST 가 어느 관계를 타야 할지 못 고르고 PGRST201 로 죽는다.
const FEEDBACK_SELECT =
  'id, body, status, admin_note, requirement_id, created_at, resolved_at, ' +
  'member:team_members!moa_feedback_member_id_fkey(id, name), ' +
  'requirement:requirements!moa_feedback_requirement_id_fkey(id, title, brand_id)';

export async function GET() {
  try {
    await requireGlobalAdmin();

    const supabase = getSupabaseAdmin();
    // 새로 온 것이 위다. 관리 화면에 들어오는 이유가 "새 의견이 왔다"이므로
    // 그것이 첫 줄이어야 한다.
    const { data, error } = await supabase
      .from('moa_feedback')
      .select(FEEDBACK_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return Response.json({ feedback: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
