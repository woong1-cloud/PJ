import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin, requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { isWorkstream, nextCode } from '@/lib/launchCode';

// 런칭에 항목을 손으로 더한다.
//
// 지금까지 추가는 가이드에만 있었다. 매주 흔들리는 목록에서 그건 뒤집힌
// 구조다 — 회의 중에 빠진 것을 발견하면 그 자리에서 넣어야 한다.
//
// source = 'manual' 이 중요하다. 재가져오기가 안 건드리는 근거이고,
// 나중에 "HOKA 에서 새로 생긴 것"을 뽑아 가이드로 되돌리는 근거다(4단계).
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    await requireLaunchAccess(id, 'member');
    const body = await request.json();

    const workstream = String(body?.workstream ?? '').trim();
    const title = String(body?.title ?? '').trim();
    const dayOffset = Number(body?.day_offset);
    if (!isWorkstream(workstream)) throw new ApiError(400, '워크스트림을 골라 주세요.');
    if (!title) throw new ApiError(400, '체크 항목을 입력하세요.');
    if (!Number.isFinite(dayOffset)) throw new ApiError(400, 'D-day 를 숫자로 입력하세요.');

    const supabase = getSupabaseAdmin();
    const { data: codes, error: cErr } = await supabase
      .from('launch_tasks')
      // workstream 도 읽는다 — 코드 앞자리를 그 워크스트림의 기존
      // 항목에게 물어보기 때문이다(lib/launchCode.js 의 codePrefix).
      .select('code, workstream')
      .eq('launch_id', id);
    if (cErr) throw cErr;

    const code = nextCode({ workstream, existing: codes ?? [] });
    if (!code) throw new ApiError(400, '코드를 지을 수 없습니다.');

    const { data, error } = await supabase
      .from('launch_tasks')
      .insert({
        launch_id: id,
        code,
        workstream,
        title,
        day_offset: Math.trunc(dayOffset),
        category: body?.category || null,
        channel: body?.channel || null,
        decision_org: body?.decision_org || null,
        owner_org: body?.owner_org || null,
        owner_role: body?.owner_role || null,
        support_role: body?.support_role || null,
        depends_on: Array.isArray(body?.depends_on) ? body.depends_on : [],
        deliverable: body?.deliverable || null,
        note: body?.note || null,
        plain_text: body?.plain_text || null,
        is_critical: body?.is_critical === true,
        assignee_name: body?.assignee_name || null,
        source: 'manual',
      })
      .select('*')
      .single();
    // 23505 = unique_violation. (launch_id, code) 가 겹쳤다는 뜻이다.
    if (error?.code === '23505') {
      throw new ApiError(409, '같은 코드가 이미 있습니다. 다시 시도해 주세요.');
    }
    if (error) throw error;

    return Response.json({ task: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
