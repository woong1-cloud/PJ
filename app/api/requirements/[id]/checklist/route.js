import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import { CHECKLIST_SELECT, MAX_CHECKLIST_TITLE, normalizeChecklistTitle } from '@/lib/checklist';

// 하위 작업 체크리스트 목록/등록.
//
// 조회는 4차도 된다 — 자기가 올린 요구사항이 어디까지 쪼개져 진행되는지
// 보는 것은 코멘트를 읽는 것과 같은 수준이다. 항목을 추가·완료 표시하는
// 것은 3차 이상이다 — "어떤 작업으로 쪼갤지"는 처리하는 쪽의 판단이라,
// 4차가 마음대로 항목을 만들면 실무자가 계획하지 않은 일이 목록에 섞인다.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const supabase = getSupabaseAdmin();
    await requireRequirementAccess(supabase, id, brandId, '4차');

    const { data, error } = await supabase
      .from('requirement_checklist_items')
      .select(CHECKLIST_SELECT)
      .eq('requirement_id', id)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    return Response.json({ items: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, title } = await request.json();

    const supabase = getSupabaseAdmin();
    const { memberId } = await requireRequirementAccess(supabase, id, brandId, '3차');

    const trimmed = normalizeChecklistTitle(title);
    if (!trimmed) throw new ApiError(400, '내용을 입력하세요.');
    if (trimmed.length > MAX_CHECKLIST_TITLE) throw new ApiError(400, '내용이 너무 깁니다.');

    // 이미지 첨부(requirement_images)와 같은 방식이다 — 서버가 현재 최대
    // sort_order 를 조회해 다음 값을 매긴다. 동시에 두 사람이 추가하면 같은
    // 값이 매겨질 수 있지만, 순서가 한 번 뒤섞이는 것뿐이라 재시도할 정도의
    // 문제는 아니다.
    const { data: existing, error: countError } = await supabase
      .from('requirement_checklist_items')
      .select('sort_order')
      .eq('requirement_id', id)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (countError) throw countError;
    const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('requirement_checklist_items')
      .insert({ requirement_id: id, title: trimmed, sort_order: nextSort, created_by: memberId })
      .select(CHECKLIST_SELECT)
      .single();
    if (error) throw error;

    return Response.json({ item: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
