import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse, ApiError } from '@/lib/apiError';

// 알림 하나를 읽음으로 표시한다.
//
// 소유 검사는 update 의 where 절 자체다 — .eq('team_member_id', memberId) 가
// 붙어 있으므로 남의 알림 id 를 넣으면 0행이 갱신되고 404 가 나간다. 먼저 읽어서
// 비교하는 방식보다 안전하다: 검사와 갱신 사이가 없다. 404 로 돌려주는 것도
// 의도적이다 — 403 은 "그 id 는 존재한다" 를 알려주는 셈이 된다.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { memberId } = await getSessionMember();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('in_app_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('team_member_id', memberId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, '알림을 찾을 수 없습니다.');

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
