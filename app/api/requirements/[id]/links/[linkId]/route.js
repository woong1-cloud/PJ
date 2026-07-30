import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

export async function DELETE(request, { params }) {
  try {
    const { id, linkId } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    // 이미지 삭제와 같은 기준이다 — 붙일 수 있는 사람은 뗄 수도 있어야 한다.
    await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: link, error: linkError } = await supabase
      .from('requirement_links')
      .select('id, requirement_id')
      .eq('id', linkId)
      .maybeSingle();
    if (linkError) throw linkError;
    // 다른 요구사항의 링크를 이 경로로 지울 수 없게 한다.
    if (!link || link.requirement_id !== id) {
      throw new ApiError(404, '링크를 찾을 수 없습니다.');
    }

    // brandId 는 세션 권한 확인에만 쓰였다. 그 brandId 가 정말 이 요구사항의
    // 브랜드인지 확인하지 않으면, 아무 브랜드 4차 권한만 있으면 남의 브랜드
    // 링크를 지울 수 있다.
    const { data: requirement, error: reqError } = await supabase
      .from('requirements')
      .select('id, brand_id')
      .eq('id', id)
      .maybeSingle();
    if (reqError) throw reqError;
    if (!requirement) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (requirement.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    const { error: delError } = await supabase
      .from('requirement_links')
      .delete()
      .eq('id', linkId);
    if (delError) throw delError;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
