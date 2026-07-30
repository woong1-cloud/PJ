import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import { MAX_CHECKLIST_TITLE, normalizeChecklistTitle } from '@/lib/checklist';

// 완료 표시/제목 수정. 둘 다 3차 이상 — 목록 GET 의 이유와 같다.
export async function PATCH(request, { params }) {
  try {
    const { id, itemId } = await params;
    const body = await request.json();
    const { brandId, isDone, title } = body;

    const supabase = getSupabaseAdmin();
    await requireRequirementAccess(supabase, id, brandId, '3차');

    const updates = {};
    if (isDone !== undefined) updates.is_done = Boolean(isDone);
    if (title !== undefined) {
      const trimmed = normalizeChecklistTitle(title);
      if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
      if (trimmed.length > MAX_CHECKLIST_TITLE) throw new ApiError(400, '내용이 너무 깁니다.');
      updates.title = trimmed;
    }
    if (Object.keys(updates).length === 0) throw new ApiError(400, '수정할 내용이 없습니다.');

    const { data, error } = await supabase
      .from('requirement_checklist_items')
      .update(updates)
      .eq('id', itemId)
      // requirement_id 도 조건에 넣는다. itemId 만으로 걸면, 다른 요구사항의
      // 항목 id 를 이 URL 에 끼워 넣었을 때 그쪽을 고칠 수 있게 된다 —
      // brandId 검사는 requireRequirementAccess 가 이미 했지만 그건 이 id 의
      // 요구사항에 대한 것이지, itemId 가 정말 그 요구사항 소속인지는 별개다.
      .eq('requirement_id', id)
      .select('id, title, is_done, sort_order')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    return Response.json({ item: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, itemId } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const supabase = getSupabaseAdmin();
    await requireRequirementAccess(supabase, id, brandId, '3차');

    const { error, count } = await supabase
      .from('requirement_checklist_items')
      .delete({ count: 'exact' })
      .eq('id', itemId)
      .eq('requirement_id', id);
    if (error) throw error;
    if (count === 0) throw new ApiError(404, '항목을 찾을 수 없습니다.');

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
