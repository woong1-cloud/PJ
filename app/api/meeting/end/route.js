import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { groupAssignmentsByRequester } from '@/lib/meetingSession';
import { notifyMeetingAssignments } from '@/lib/notify';

// 첫 회의에는 직전 세션이 없다. 그때는 지난 한 주를 본다 — 회의가 주 1회라
// 그보다 앞의 배정은 지난 회의에서 이미 다룬 것으로 친다. 여기를 넉넉하게
// 잡으면 첫 회의에서 몇 달치 배정 알림이 한꺼번에 나간다.
const FIRST_MEETING_LOOKBACK_DAYS = 7;

// 회의를 마친다. 이 회의에서 배정된 건을 요청자에게 알리고 세션을 닫는다.
export async function POST(request) {
  try {
    const { brandId } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const { memberId } = await requireBrandAccess(brandId, '3차');
    const supabase = getSupabaseAdmin();

    const { data: last, error: lastError } = await supabase
      .from('meeting_sessions')
      .select('ended_at')
      .eq('brand_id', brandId)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;

    const since =
      last?.ended_at ??
      new Date(Date.now() - FIRST_MEETING_LOOKBACK_DAYS * 86400000).toISOString();

    // 오래된 것부터 받는다. groupAssignmentsByRequester 가 뒤에 온 값으로
    // 덮어쓰므로, 회의 중 담당자를 두 번 바꿨으면 마지막 값이 이겨야 한다.
    const { data: logs, error: logError } = await supabase
      .from('change_logs')
      .select('requirement_id, new_value, created_at')
      .eq('brand_id', brandId)
      .eq('change_type', '담당자지정')
      .gt('created_at', since)
      .order('created_at', { ascending: true });
    if (logError) throw logError;

    const ids = [...new Set((logs ?? []).map((l) => l.requirement_id))];
    let requirements = [];
    if (ids.length > 0) {
      const { data: rows, error: reqError } = await supabase
        .from('requirements')
        .select('id, title, requester, expected_release_date')
        .in('id', ids);
      if (reqError) throw reqError;
      requirements = rows ?? [];
    }

    const groups = groupAssignmentsByRequester({ assignmentLogs: logs ?? [], requirements });

    // 세션을 먼저 닫는다.
    //
    // 메일이 실패해도 세션은 닫힌 것으로 둔다. 다시 눌렀을 때 아무것도 안
    // 나가는 것이 맞다 — 같은 메일을 두 번 받는 쪽이 더 나쁘고, 배정 사실은
    // 화면과 활동 피드에 그대로 남아 있다.
    const { error: insertError } = await supabase
      .from('meeting_sessions')
      .insert({ brand_id: brandId, ended_by: memberId });
    if (insertError) throw insertError;

    // 보낼 것이 없으면 그냥 닫힌다. notifyMeetingAssignments 가 빈 배열에서
    // 곧바로 돌아오므로 "0건이 배정되었습니다" 메일은 나가지 않는다.
    const result = await notifyMeetingAssignments(groups);

    return Response.json({
      ok: true,
      assigned: groups.reduce((sum, g) => sum + g.items.length, 0),
      notified: result.sent,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
