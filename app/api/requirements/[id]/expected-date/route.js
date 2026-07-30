import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId, expectedReleaseDate } = body;
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (expectedReleaseDate !== null && !DATE_PATTERN.test(expectedReleaseDate ?? '')) {
      throw new ApiError(400, '날짜 형식이 올바르지 않습니다.');
    }

    // 배포예상일은 IT가 정한다. 요청한 쪽이 희망일을 적으면 의미가 없어진다.
    const { memberId } = await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, expected_release_date')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    const nowIso = new Date().toISOString();
    const { error: updError } = await supabase
      .from('requirements')
      .update({ expected_release_date: expectedReleaseDate, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    // 날짜가 밀리는 것 자체가 추적할 가치가 있는 정보다.
    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '예상일변경',
      field_name: 'expected_release_date',
      old_value: current.expected_release_date,
      new_value: expectedReleaseDate,
    });
    if (logError) throw logError;

    return Response.json({ ok: true, expectedReleaseDate });
  } catch (error) {
    return errorResponse(error);
  }
}
