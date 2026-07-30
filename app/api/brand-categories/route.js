// app/api/brand-categories/route.js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess, requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { toCategoryPayload } from '@/lib/categories';

// brandId 는 PostgREST 필터 문자열(.or)에 그대로 들어간다. 전체관리자는 어떤
// brandId 로도 통과하므로(checkBrandAccess) 형식을 여기서 막아야 한다.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (!UUID_PATTERN.test(brandId)) throw new ApiError(400, 'brandId 형식이 올바르지 않습니다.');

    await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    // brand_id 가 null 인 행은 공통 카테고리다 — 모든 브랜드에서 함께 보인다.
    const { data, error } = await supabase
      .from('brand_categories')
      .select('id, brand_id, category_name, sort_order')
      .or(`brand_id.eq.${brandId},brand_id.is.null`)
      // 브랜드 고유를 먼저, 공통을 뒤에 둔다. 두 묶음의 sort_order 는 서로
      // 다른 수열이라 섞어서 정렬하면 순서가 뒤죽박죽이 된다.
      .order('brand_id', { nullsFirst: false })
      .order('sort_order');
    if (error) throw error;
    return Response.json({ categories: (data ?? []).map(toCategoryPayload) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { brandId, categoryName, isCommon } = body;
    if (!categoryName || !categoryName.trim()) throw new ApiError(400, '카테고리 이름은 필수입니다.');

    // 공통 카테고리는 모든 브랜드에 나타난다. 한 브랜드의 관리자가 전사에
    // 영향을 주는 항목을 만들 수 있으면 안 되므로 전체관리자로 제한한다.
    const common = isCommon === true;
    if (common) {
      await requireGlobalAdmin();
    } else {
      if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
      await requireBrandAccess(brandId, '2차');
    }

    const supabase = getSupabaseAdmin();
    // sort_order 는 묶음별로 따로 매긴다.
    let lastQuery = supabase.from('brand_categories').select('sort_order');
    lastQuery = common ? lastQuery.is('brand_id', null) : lastQuery.eq('brand_id', brandId);
    const { data: last, error: lastError } = await lastQuery
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;
    const nextSortOrder = (last?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('brand_categories')
      .insert({
        brand_id: common ? null : brandId,
        category_name: categoryName.trim(),
        sort_order: nextSortOrder,
      })
      .select('id, brand_id, category_name, sort_order')
      .single();
    if (error) throw error;
    return Response.json({ category: toCategoryPayload(data) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
