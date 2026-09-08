import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireLaunchAccess } from '@/lib/permissions';
import { errorResponse } from '@/lib/apiError';
import { loadLaunchMentionable } from '@/lib/launchMentionable';

// 자동완성용 후보. 이 목록이 곧 알림이 갈 수 있는 사람의 상한이다 —
// 서버가 본문을 해석할 때도 같은 함수를 쓴다(lib/launchMentionable.js).
//
// 문지기는 'member' 다. 그 런칭을 못 여는 사람에게 참여자 명단을 보여줄
// 이유가 없고, 후보 목록은 명단을 그대로 옮긴 것이다.
export async function GET(_request, { params }) {
  try {
    // params 를 먼저 푼다. requireLaunchAccess(id) 보다 뒤에 두면 id 가
    // 아직 없는 채로 문지기에 들어간다.
    const { id } = await params;
    await requireLaunchAccess(id, 'member');

    const members = await loadLaunchMentionable(getSupabaseAdmin(), { launchId: id });
    return Response.json({ members });
  } catch (error) {
    return errorResponse(error);
  }
}
