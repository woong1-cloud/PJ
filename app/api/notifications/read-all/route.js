import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse } from '@/lib/apiError';

// 내 알림 전부를 읽음으로 표시한다.
//
// 여기도 대상은 세션의 memberId 로만 정해진다. 대상 회원을 인자로 받는 순간
// "남의 벨을 대신 비우는" 요청이 성립한다.
//
// /api/notifications/[id]/read 와 경로가 겹치지 않는다 — 이쪽은 한 단계
// 짧고(.../read-all), 저쪽은 두 단계다(.../{id}/read).
export async function PATCH() {
  try {
    const { memberId } = await getSessionMember();

    const supabase = getSupabaseAdmin();
    // 이미 읽은 행까지 건드리면 아무 의미 없는 업데이트가 대량으로 나간다.
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ is_read: true })
      .eq('team_member_id', memberId)
      .eq('is_read', false);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
