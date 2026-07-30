import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import {
  COMMENT_SELECT,
  MAX_COMMENT_BODY,
  canModifyComment,
  normalizeCommentBody,
} from '@/lib/comments';

// 코멘트 수정/삭제.
//
// 작성자 본인만 할 수 있다. 브랜드 관리자도, 전역 관리자도 남의 코멘트는 못
// 고치고 못 지운다 — 남의 말을 조용히 바꿔놓는 수정 버튼은 없느니만 못하다.
// (관리자가 부적절한 코멘트를 치워야 하는 상황은 아직 요구가 없다. 필요해지면
// "관리자가 지웠음"이 보이는 별도 동작으로 만들어야지, 여기에 얹으면 안 된다.)
//
// 링크·이미지는 "붙일 수 있는 사람이면 뗄 수도 있다"인데 코멘트는 다르다.
// 링크는 자료를 가리키는 포인터라 누가 붙였든 같은 것을 가리키지만, 코멘트는
// 그 사람이 한 말이라 다른 사람이 대신 고칠 수 있는 성질이 아니다.

// 이 요구사항의, 이 코멘트인지까지 확인하고 행을 돌려준다.
async function loadComment(supabase, requirementId, commentId) {
  const { data, error } = await supabase
    .from('requirement_comments')
    .select('id, requirement_id, author')
    .eq('id', commentId)
    .maybeSingle();
  if (error) throw error;
  // 다른 요구사항의 코멘트를 이 경로로 건드릴 수 없게 한다. 접근 검사는
  // URL 의 요구사항 기준으로 이뤄지므로, 이 확인이 없으면 내가 볼 수 있는
  // 요구사항 하나만 있으면 아무 코멘트나 id 를 넣어 건드릴 수 있다.
  if (!data || data.requirement_id !== requirementId) {
    throw new ApiError(404, '코멘트를 찾을 수 없습니다.');
  }
  return data;
}

function requireAuthor(comment, memberId) {
  if (!canModifyComment(comment, memberId)) {
    throw new ApiError(403, '작성자만 수정하거나 삭제할 수 있습니다.');
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id, commentId } = await params;
    const { brandId, body } = await request.json();

    const supabase = getSupabaseAdmin();
    const { memberId } = await requireRequirementAccess(supabase, id, brandId, '4차');

    const existing = await loadComment(supabase, id, commentId);
    requireAuthor(existing, memberId);

    const trimmed = normalizeCommentBody(body);
    if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
    if (trimmed.length > MAX_COMMENT_BODY) throw new ApiError(400, '내용이 너무 깁니다.');

    // edited_at 을 채운다. 화면에 "수정됨"을 붙이기 위한 것이다 — 지금 보이는
    // 문장이 처음 쓴 그대로인지 아닌지는 읽는 사람이 알아야 한다.
    const { data, error } = await supabase
      .from('requirement_comments')
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq('id', commentId)
      .select(COMMENT_SELECT)
      .single();
    if (error) throw error;

    return Response.json({ comment: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, commentId } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const supabase = getSupabaseAdmin();
    const { memberId } = await requireRequirementAccess(supabase, id, brandId, '4차');

    const existing = await loadComment(supabase, id, commentId);
    requireAuthor(existing, memberId);

    const { error } = await supabase.from('requirement_comments').delete().eq('id', commentId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
