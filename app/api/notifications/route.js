import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse } from '@/lib/apiError';
import { NOTIFICATION_LIMIT } from '@/lib/notifications';

// 내 알림 목록.
//
// team_member_id 는 세션에서만 나온다. 쿼리 파라미터로 받는 순간 남의 알림을
// 읽는 URL 하나로 끝나는 문제라, 받을 자리를 아예 만들지 않는다.
//
// 목록은 최신순으로 NOTIFICATION_LIMIT 개까지다(읽음·안읽음 섞여서). 벨을 눌러
// 훑는 용도라 그 아래는 아무도 보지 않는다.
export async function GET() {
  try {
    const { memberId } = await getSessionMember();
    const supabase = getSupabaseAdmin();

    function query(columns) {
      return supabase
        .from('in_app_notifications')
        .select(columns)
        .eq('team_member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_LIMIT);
    }

    let { data, error } = await query('id, requirement_id, link, message, is_read, created_at');
    // 42703 = undefined_column. 0015 미적용 DB 에서는 link 없이 다시 읽는다.
    // 컬럼 하나 때문에 벨 전체가 오류로 죽는 것이 최악이다 — 알림은 부가
    // 기능인데 그 실패가 상단바를 망가뜨린다. 0015 적용 후 지워도 되는 분기다.
    if (error?.code === '42703') {
      ({ data, error } = await query('id, requirement_id, message, is_read, created_at'));
    }
    if (error) throw error;

    // 뱃지 숫자는 목록에서 세지 않는다. 안 읽은 것이 상한을 넘으면 목록에
    // 안 담긴 만큼 숫자가 실제보다 작아지고, 다 읽어도 0이 안 되는 벨이 된다.
    const { count, error: countError } = await supabase
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('team_member_id', memberId)
      .eq('is_read', false);
    if (countError) throw countError;

    return Response.json({ notifications: data ?? [], unreadCount: count ?? 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
