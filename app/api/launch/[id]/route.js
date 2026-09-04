import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 런칭 하나 — 항목 전부를 한 번에 준다.
//
// 403건을 통째로 내려보낸다. 페이지를 나누면 "지난 것"과 "이번 주"를 세려고
// 매번 서버를 다시 부르게 되고, 그 숫자가 화면 사이에서 갈린다. 400건은
// 브라우저에서 세기에 작다.

export async function GET(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: launch, error } = await supabase
      .from('launches')
      .select('id, name, open_date, kind, status, note, guide_id, brand_id, created_at, context')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!launch) throw new ApiError(404, '런칭을 찾을 수 없습니다.');

    const { data: tasks, error: taskError } = await supabase
      .from('launch_tasks')
      .select(
        // excluded_reason · source — 해당없음 사유와 항목 출처. 안 더하면
        // 화면(⋯ 메뉴·해당없음 줄)에 사유가 영영 빈칸이다.
        'id, code, workstream, category, title, channel, decision_org, owner_org, owner_role, support_role, depends_on, day_offset, deliverable, note, is_critical, sort_order, status, blocked_reason, done_at, excluded_reason, source, assignee:team_members!launch_tasks_assignee_fkey(id, name)',
      )
      .eq('launch_id', id)
      .order('workstream', { ascending: true })
      .order('sort_order', { ascending: true });
    if (taskError) throw taskError;

    return Response.json({ launch, tasks: tasks ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// 오픈일과 상태를 고친다.
//
// 오픈일이 바뀌면 403건의 기한이 전부 따라 움직인다 — 기한을 저장하지 않는
// 이유가 이것이다(0031_launch.sql).
export async function PATCH(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const body = await request.json();
    const patch = {};

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed) throw new ApiError(400, '브랜드명을 입력하세요.');
      patch.name = trimmed;
    }
    if (body.openDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.openDate))) {
        throw new ApiError(400, '오픈일을 골라 주세요.');
      }
      patch.open_date = body.openDate;
    }
    if (body.status !== undefined) {
      // 준비 ↔ 진행 중은 엑셀 문의 열쇠다.
      //
      // 준비 — 엑셀을 올릴 수 있다. 브랜드와 양식을 두세 번 주고받는 구간.
      // 진행 중 — 문이 닫힌다. 그 뒤로는 모아에서만 관리한다.
      //
      // 되돌릴 수 있어야 한다. "엑셀 한 번 더 올려야 하는데"가 생겼을 때
      // 막히면 사람이 다른 길을 찾는다. 되돌려도 상태·담당·막힌 이유는
      // 그대로 둔다 — 이 update 는 launches 만 건드리므로 저절로 그렇다.
      patch.status = body.status;
    }
    if (body.note !== undefined) patch.note = body.note || null;
    if (body.context !== undefined) {
      // 전제 — 00_개요 의 [제반사항] 7줄. 451건이 왜 그렇게 생겼는지의
      // 답이라 사람이 고칠 수 있어야 한다.
      //
      // 모양은 [{label, value}] 다. 라벨이 브랜드마다 달라서 컬럼으로
      // 박지 않았다(0032).
      if (!Array.isArray(body.context)) throw new ApiError(400, '전제 형식이 잘못됐습니다.');
      patch.context = body.context
        .filter((c) => String(c?.label ?? '').trim() && String(c?.value ?? '').trim())
        .slice(0, 40)
        .map((c) => ({ label: String(c.label).trim(), value: String(c.value).trim() }));
    }

    if (Object.keys(patch).length === 0) throw new ApiError(400, '바꿀 내용이 없습니다.');
    patch.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('launches')
      .update(patch)
      .eq('id', id)
      .select('id, name, open_date, kind, status, note, guide_id, brand_id, created_at, context')
      .maybeSingle();
    // 23514 = check_violation. status 가 네 개 밖일 때다.
    if (error?.code === '23514') throw new ApiError(400, '알 수 없는 상태입니다.');
    if (error) throw error;
    if (!data) throw new ApiError(404, '런칭을 찾을 수 없습니다.');

    return Response.json({ launch: data });
  } catch (error) {
    return errorResponse(error);
  }
}

// 런칭을 지운다. 항목은 on delete cascade 로 함께 사라진다.
export async function DELETE(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('launches').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
