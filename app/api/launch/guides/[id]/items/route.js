import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { isWorkstream, nextCode } from '@/lib/launchCode';

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

// 항목 하나를 손으로 더한다.
//
// 엑셀 가져오기만으로는 시작할 수 없다 — 시트가 아직 다듬어지는 동안에도
// 몇 건을 넣어 보드가 어떻게 도는지 봐야 하고, 런칭 중에 빠진 것을 발견하면
// 그 자리에서 더해야 한다.
//
// 코드는 사람에게 안 받는다. 손으로 적게 하면 중복이 나고, 중복은 unique
// 제약에 걸려 저장이 통째로 실패한다(lib/launchCode.js).
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();
    const body = await request.json();

    const workstream = String(body?.workstream ?? '').trim();
    const title = String(body?.title ?? '').trim();
    const dayOffset = Number(body?.day_offset);

    if (!isWorkstream(workstream)) {
      throw new ApiError(400, "워크스트림은 '01_신규법인' 처럼 두 자리 번호로 시작해야 합니다.");
    }
    if (!title) throw new ApiError(400, '체크 항목을 입력하세요.');
    if (!Number.isFinite(dayOffset)) throw new ApiError(400, 'D-day 를 입력하세요.');

    const supabase = getSupabaseAdmin();
    const { data: guide, error: guideError } = await supabase
      .from('launch_guides')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (guideError) throw guideError;
    if (!guide) throw new ApiError(404, '가이드를 찾을 수 없습니다.');

    const { data: existing, error: exError } = await supabase
      .from('launch_guide_items')
      .select('code, sort_order')
      .eq('guide_id', id);
    if (exError) throw exError;

    const code = nextCode({
      workstream,
      existingCodes: (existing ?? []).map((e) => e.code),
    });
    if (!code) throw new ApiError(400, '이 워크스트림에 더 넣을 자리가 없습니다.');

    // 맨 뒤에 붙인다. 시트에서 온 항목의 순서를 흔들지 않는다.
    const maxSort = (existing ?? []).reduce((m, e) => Math.max(m, e.sort_order ?? 0), 0);

    const { data, error } = await supabase
      .from('launch_guide_items')
      .insert({
        guide_id: id,
        code,
        workstream,
        category: body?.category?.trim() || null,
        title,
        channel: body?.channel?.trim() || null,
        decision_org: body?.decision_org?.trim() || null,
        owner_org: body?.owner_org?.trim() || null,
        owner_role: body?.owner_role?.trim() || null,
        support_role: body?.support_role?.trim() || null,
        depends_on: Array.isArray(body?.depends_on)
          ? body.depends_on.filter((c) => /^\d{2}-\d{2}$/.test(String(c)))
          : [],
        day_offset: Math.trunc(dayOffset),
        deliverable: body?.deliverable?.trim() || null,
        note: body?.note?.trim() || null,
        is_critical: body?.is_critical === true,
        sort_order: maxSort + 1,
      })
      .select(ITEM_SELECT)
      .single();
    if (error) throw error;

    return Response.json({ item: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
