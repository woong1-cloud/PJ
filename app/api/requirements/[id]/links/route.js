import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';
import { normalizeUrl } from '@/lib/links';

const MAX_LABEL = 100;
// 브라우저가 실제로 다루는 길이보다 넉넉하되, 한 행이 무한정 커지지 않게 막는다.
const MAX_URL = 2000;

// 이 요구사항에 접근할 수 있는지 확인하고 요구사항 행을 돌려준다.
// 비공개 요구사항은 상세 조회와 같은 규칙(3차 이상)을 적용한다 — 상세 화면은
// 막아놓고 링크 API 로는 새어 나가면 막은 의미가 없다.
async function requireRequirementAccess(supabase, id, brandId, minTier) {
  if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
  const { memberId, tier, isGlobalAdmin } = await requireBrandAccess(brandId, minTier);

  const { data: requirement, error } = await supabase
    .from('requirements')
    .select('id, brand_id, is_confidential')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!requirement) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
  if (requirement.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

  const canSeeConfidential = isGlobalAdmin || TIER_RANK[tier] >= TIER_RANK['3차'];
  if (requirement.is_confidential && !canSeeConfidential) {
    throw new ApiError(403, '비공개 요구사항은 조회할 수 없습니다.');
  }

  return { memberId, requirement };
}

async function loadLinks(supabase, requirementId) {
  const { data, error } = await supabase
    .from('requirement_links')
    .select('id, label, url, created_at, creator:team_members(id, name)')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const supabase = getSupabaseAdmin();
    await requireRequirementAccess(supabase, id, brandId, '4차');

    return Response.json({ links: await loadLinks(supabase, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, label, url } = await request.json();

    // 요청자(4차)도 자기 시안 링크를 달 수 있어야 한다 — 피그마 링크를
    // 붙이려고 실무자를 부르게 만들면 아무도 안 붙인다.
    const supabase = getSupabaseAdmin();
    const { memberId } = await requireRequirementAccess(supabase, id, brandId, '4차');

    if (typeof url === 'string' && url.length > MAX_URL) {
      throw new ApiError(400, '주소가 너무 깁니다.');
    }
    // 여기를 통과한 값만 <a href> 에 들어간다. javascript: 는 반드시 막힌다.
    const normalized = normalizeUrl(url);
    if (!normalized) {
      throw new ApiError(400, 'http 또는 https 주소만 등록할 수 있습니다.');
    }

    // 이름을 비우면 도메인을 쓴다. 이름 두 칸을 다 채우게 하면 링크를 덜 붙인다.
    const trimmedLabel = typeof label === 'string' ? label.trim() : '';
    if (trimmedLabel.length > MAX_LABEL) throw new ApiError(400, '이름이 너무 깁니다.');
    const finalLabel = trimmedLabel || new URL(normalized).hostname;

    const { data, error } = await supabase
      .from('requirement_links')
      .insert({
        requirement_id: id,
        label: finalLabel,
        url: normalized,
        created_by: memberId,
      })
      .select('id, label, url, created_at, creator:team_members(id, name)')
      .single();
    if (error) throw error;

    return Response.json({ link: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
