// app/api/brand-categories/[id]/route.js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess, requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { toCategoryPayload } from '@/lib/categories';

// 대상 카테고리를 찾고, 그 소유에 맞는 권한을 세운다.
//
// 조회 전에 requireBrandAccess(4차)를 먼저 부르는 것은 인증 없이 카테고리
// 존재 여부를 떠볼 수 없게 하기 위해서다. 그 다음 대상이 공통이면
// 전체관리자로, 브랜드 고유면 그 브랜드 2차로 올린다.
async function loadTargetWithPermission(id, brandId) {
  if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
  await requireBrandAccess(brandId, '4차');

  const supabase = getSupabaseAdmin();
  const { data: target, error } = await supabase
    .from('brand_categories')
    .select('id, brand_id, category_name, sort_order')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!target) throw new ApiError(404, '카테고리를 찾을 수 없습니다.');

  if (target.brand_id === null) {
    // 공통 카테고리를 2차 관리자가 고치면 다른 브랜드까지 바뀐다.
    await requireGlobalAdmin();
  } else {
    if (target.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');
    await requireBrandAccess(brandId, '2차');
  }

  return { supabase, target };
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId, categoryName, sortOrder } = body;

    const { supabase, target } = await loadTargetWithPermission(id, brandId);

    const updates = {};
    if (categoryName !== undefined) {
      if (!categoryName.trim()) throw new ApiError(400, '카테고리 이름은 필수입니다.');
      updates.category_name = categoryName.trim();
    }
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (Object.keys(updates).length === 0) throw new ApiError(400, '수정할 필드가 없습니다.');

    // 이미 id 로 대상을 확정하고 권한을 확인했으므로 id 로만 좁힌다.
    // 공통 카테고리는 brand_id 가 null 이라 .eq('brand_id', brandId) 로는
    // 한 행도 잡히지 않는다.
    const { data, error } = await supabase
      .from('brand_categories')
      .update(updates)
      .eq('id', target.id)
      .select('id, brand_id, category_name, sort_order')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, '카테고리를 찾을 수 없습니다.');
    return Response.json({ category: toCategoryPayload(data) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const { supabase, target } = await loadTargetWithPermission(id, brandId);

    // 사용 중 검사는 브랜드를 가리지 않는다. 공통 카테고리는 다른 브랜드의
    // 요구사항이 쓰고 있을 수 있고, 그것도 막아야 한다.
    const { count, error: usageError } = await supabase
      .from('requirements')
      .select('id', { count: 'exact', head: true })
      .eq('category', target.id);
    if (usageError) throw usageError;
    if ((count ?? 0) > 0) {
      throw new ApiError(400, '이 카테고리를 사용 중인 요구사항이 있어 삭제할 수 없습니다.');
    }

    const { error } = await supabase.from('brand_categories').delete().eq('id', target.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
