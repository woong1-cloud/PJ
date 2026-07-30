import { requireBrandAccess } from './permissions';
import { ApiError } from './apiError';
import { TIER_RANK } from './tiers';

// 요구사항 하위 리소스(코멘트 등)를 다루기 전 통과해야 하는 검사.
//
// 세 가지를 한자리에서 확인한다. 하나라도 빠지면 구멍이 난다:
//
// 1) brandId 에 대한 등급 — requireBrandAccess 가 본다.
// 2) 그 brandId 가 정말 이 요구사항의 브랜드인가. brandId 는 요청이 보내는
//    값이라, 아무 브랜드에 4차만 있으면 그 brandId 를 얹어 남의 브랜드
//    요구사항을 건드릴 수 있다. 링크 API 에서 실제로 이 구멍이 났었다.
// 3) 비공개 요구사항이면 상세와 같은 규칙(3차 이상). 상세 화면은 막아놓고
//    하위 리소스 API 로 새어 나가면 막은 의미가 없다 — 4차에게 요구사항 본문은
//    가리면서 그 밑의 논의는 보여주는 꼴이 된다.
//
// 반환: { memberId, tier, isGlobalAdmin, requirement }
export async function requireRequirementAccess(supabase, id, brandId, minTier) {
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

  return { memberId, tier, isGlobalAdmin, requirement };
}
