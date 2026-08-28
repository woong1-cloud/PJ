import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { REVIEW_PENDING_STATUS } from '@/lib/statuses';
import { ACKED_FEEDBACK_STATUS } from '@/lib/feedback';

// 제목에 쓸 길이. 의견은 한두 문단이라 그대로 제목에 넣으면 목록이 무너진다.
const MAX_TITLE = 60;

// 의견 한 건을 요구사항으로 올린다 — 전체 관리자 전용.
//
// 가벼운 것은 가볍게 받고 무거운 것만 무거운 흐름으로 넘긴다. 의견 폼이 한
// 칸인 대가로 여기서 나머지를 채운다.
//
// 등록 폼(RequirementFormDialog)을 열어 미리 채우는 대신 서버가 바로 만든다.
// 그 폼은 As-Is · To-Be · 카테고리 · 채널 · 유형을 받는데, 관리자는 이미
// 의견을 읽었고 그것을 그 다섯 칸에 옮겨 적는 일은 승격을 안 하게 만든다.
// 나머지는 요구사항 상세에서 채우면 된다.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { memberId } = await requireGlobalAdmin();
    const { brandId } = await request.json();
    // 의견에는 브랜드가 없다(0028). 자동으로 정할 수 없으므로 관리자가 고른다.
    if (!brandId) throw new ApiError(400, '브랜드를 골라 주세요.');

    const supabase = getSupabaseAdmin();
    const { data: feedback, error: fbError } = await supabase
      .from('moa_feedback')
      .select('id, body, requirement_id, member:team_members!moa_feedback_member_id_fkey(id, name)')
      .eq('id', id)
      .maybeSingle();
    if (fbError) throw fbError;
    if (!feedback) throw new ApiError(404, '의견을 찾을 수 없습니다.');
    if (feedback.requirement_id) {
      throw new ApiError(400, '이미 요구사항으로 올린 의견입니다.');
    }

    const text = (feedback.body ?? '').trim();
    // 첫 줄이 제목이다. 사람이 쓴 글의 첫 문장이 대개 요지라, 여기서 짐작해
    // 만드는 것보다 정확하다. 길면 자르고 나머지는 To-Be 에 그대로 남는다.
    const firstLine = text.split(/\r?\n/)[0] ?? '';
    const title = firstLine.length <= MAX_TITLE ? firstLine : `${firstLine.slice(0, MAX_TITLE)}…`;

    const nowIso = new Date().toISOString();
    const { data: created, error: reqError } = await supabase
      .from('requirements')
      .insert({
        brand_id: brandId,
        priority: '중',
        request_date: nowIso.slice(0, 10),
        // 요청자는 승격한 관리자다. 의견을 낸 사람은 그 브랜드 소속이 아닐
        // 수 있고, 요구사항은 브랜드 안에서만 보이기 때문이다. 대신 누가
        // 낸 의견인지는 비고에 남긴다.
        requester: memberId,
        title: title || '모아 의견',
        to_be: text || null,
        note: feedback.member?.name ? `모아 의견에서 올림 — ${feedback.member.name}` : '모아 의견에서 올림',
        // 바로 검토대기다. 작성중으로 넣으면 아무도 안 보는 곳에 들어가는데,
        // 관리자가 승격을 눌렀다는 것은 이미 다룰 값어치가 있다고 판단한 것이다.
        status: REVIEW_PENDING_STATUS,
        updated_at: nowIso,
      })
      .select('id, title')
      .single();
    if (reqError) throw reqError;

    const { error: linkError } = await supabase
      .from('moa_feedback')
      .update({ requirement_id: created.id, status: ACKED_FEEDBACK_STATUS })
      .eq('id', id);
    if (linkError) throw linkError;

    return Response.json({ ok: true, requirement: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
