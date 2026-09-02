import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 가이드 항목과 역할 사전을 한 번에 준다.
//
// 403건을 한 번에 내려보낸다. 워크스트림별로 나눠 부르면 화면이 18번 왕복하고,
// 그 사이 접었다 폈다 하는 동안 또 부른다. 403행 × 열 열댓 개는 한 번에 보낼
// 만한 양이다(요구사항 목록이 이미 비슷한 규모를 그렇게 한다).

const ITEM_SELECT =
  'id, code, workstream, category, title, channel, decision_org, owner_org, ' +
  'owner_role, support_role, depends_on, day_offset, deliverable, note, ' +
  'is_critical, sort_order';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();

    const supabase = getSupabaseAdmin();
    const { data: guide, error: guideError } = await supabase
      .from('launch_guides')
      .select('id, name, description, source_version, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (guideError) throw guideError;
    if (!guide) throw new ApiError(404, '가이드를 찾을 수 없습니다.');

    const [itemsRes, rolesRes] = await Promise.all([
      supabase
        .from('launch_guide_items')
        .select(ITEM_SELECT)
        .eq('guide_id', id)
        // 워크스트림 안에서는 시트 순서 그대로다. 사람이 정한 순서에 뜻이
        // 있다 — D-day 로 다시 정렬하면 같은 날 여러 건의 앞뒤가 흔들린다.
        .order('workstream', { ascending: true })
        .order('sort_order', { ascending: true }),
      supabase
        .from('launch_roles')
        .select('id, name, org, scope_text, sort_order')
        .eq('guide_id', id)
        .order('sort_order', { ascending: true }),
    ]);
    if (itemsRes.error) throw itemsRes.error;
    if (rolesRes.error) throw rolesRes.error;

    return Response.json({
      guide,
      items: itemsRes.data ?? [],
      roles: rolesRes.data ?? [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
