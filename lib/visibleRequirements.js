import { canProcess } from './tiers';

// 비공개 요구사항을 볼 수 있는 사람만 남긴다.
//
// 프로젝트·로드맵 화면은 브랜드 경계를 넘어서 여러 브랜드의 건을 한 줄에
// 모아 보여준다. 화면이 경계를 넘는다고 비공개 정책까지 넘으면 안 되므로,
// 판정은 요구사항마다 그 요구사항 자신의 브랜드 등급으로 한다 —
// "스파오에 3차니까 미쏘 비공개도 보인다"가 되면 안 된다.
//
// 이 규칙이 두 라우트(프로젝트 목록·상세)에 각자 적혀 있으면 한쪽만 고쳐질 수
// 있다. 새는 방향의 실수는 조용하다: 화면에 제목이 하나 더 뜰 뿐이다.
//
// requirements: [{ brand_id, is_confidential, ... }]
// session: { isGlobalAdmin, tierByBrand: Map<brandId, tier> }
export function visibleRequirements(requirements, { isGlobalAdmin, tierByBrand }) {
  return (requirements ?? []).filter((r) => {
    if (!r.is_confidential) return true;
    return canProcess({ isGlobalAdmin, tier: tierByBrand?.get(r.brand_id) });
  });
}
