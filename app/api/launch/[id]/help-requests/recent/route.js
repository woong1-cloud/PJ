import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireLaunchAccess } from '@/lib/permissions';
import { errorResponse } from '@/lib/apiError';
import { RECENT_HOURS } from '@/lib/helpRequest';

// 창이 열릴 때 한 번 부른다. 보내기 전에 "어제 이미 보냈습니다"를 말할
// 재료다 — 막지 않고 알려만 준다.
//
// 정말 다시 보내야 할 때가 있다(어제 답이 없었다면 오늘 또 물어야 한다).
// 판단은 사람이 하고, 여기서는 사실만 준다.

export async function GET(request, { params }) {
  try {
    // params 를 먼저 푼다. requireLaunchAccess(id) 보다 뒤에 두면 id 가
    // 아직 없는 채로 문지기에 들어간다.
    const { id } = await params;
    await requireLaunchAccess(id, 'member');

    const { searchParams } = new URL(request.url);
    const ids = [
      ...new Set(
        (searchParams.get('taskIds') ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    // 고른 항목이 없으면 볼 것도 없다. 빈 배열로 .in 을 부르지 않는다.
    if (ids.length === 0) return Response.json({ recent: [] });

    const supabase = getSupabaseAdmin();
    // 여기서도 이 항목들이 이 런칭의 것인지 본다. 읽기라도 남의 런칭에 누가
    // 언제 무엇을 요청했는지가 새어 나가면 안 된다 — 댓글 GET 라우트가
    // .eq('launch_id', id) 를 함께 거는 것과 같은 이유다.
    const { data: tasks, error: taskError } = await supabase
      .from('launch_tasks')
      .select('id')
      .in('id', ids)
      .eq('launch_id', id);
    if (taskError) throw taskError;
    // 찾은 것만으로 좁힌다. 404 를 던지지 않는다 — 이건 창이 열릴 때 한 번
    // 부르는 정보성 호출이라, 항목 하나가 그 사이 지워졌다고 패널 전체가
    // 「항목을 찾을 수 없습니다」가 되면 안 된다. 보내는 POST 는 다르다 —
    // 거기서는 못 찾으면 404 로 세운다.
    const mine = (tasks ?? []).map((t) => t.id);
    if (mine.length === 0) {
      return Response.json({ recent: [] });
    }

    const since = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();
    // request_roles 가 빈 것은 평범한 댓글이다. 그것까지 세면 "어제 요청했다"가
    // 아무 대화에나 붙는다.
    const { data, error } = await supabase
      .from('launch_task_comments')
      .select('task_id, request_roles, created_at')
      .in('task_id', mine)
      .gte('created_at', since)
      .not('request_roles', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return Response.json({ recent: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
