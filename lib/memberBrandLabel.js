// 직원 목록의 「브랜드 · 등급」 칸에 무엇을 적을지.
//
// 등급을 독립된 열로 못 만든다 — 브랜드마다 다르기 때문이다. 한 사람이
// 스파오에서는 실무 관리자, 미쏘에서는 요청자일 수 있다. 열 하나로는 어느
// 것을 보여줄지 정할 수가 없어서 브랜드와 함께 적는다.
//
// roles: [{ brandId, brandName, tier }] — /api/team-members 가 이름순으로 준다
// currentBrandId: 지금 상단바에서 보고 있는 브랜드
// filterBrandId: 목록에서 브랜드로 좁혔을 때 그 브랜드
export function memberBrandLabel(roles, { currentBrandId, filterBrandId } = {}) {
  const list = Array.isArray(roles) ? roles : [];
  const none = { empty: true, name: '', tier: '', more: 0 };
  if (list.length === 0) return none;

  // 필터가 지금 브랜드보다 세다. 눈으로 좁힌 것이 더 최근의 뜻이다.
  //
  // 필터가 걸렸을 때 「외 N」을 안 붙이는 것도 같은 이유다. 그 브랜드로
  // 좁혀 보는 중인 사람에게 다른 브랜드 수는 답이 아니라 잡음이다.
  if (filterBrandId) {
    const hit = list.find((r) => r.brandId === filterBrandId);
    return hit ? { empty: false, name: hit.brandName, tier: hit.tier, more: 0 } : none;
  }

  // 지금 보고 있는 브랜드가 명단에 있으면 그것을 대표로 올린다. 스파오를
  // 보다가 직원 목록에 온 사람이 알고 싶은 것은 "이 사람이 스파오에서 몇
  // 차인가"이지 이름순 첫 브랜드가 아니다. 없으면 첫째 — 이름순이라 요청마다
  // 자리가 바뀌지 않는다.
  const pick = list.find((r) => r.brandId === currentBrandId) ?? list[0];
  return { empty: false, name: pick.brandName, tier: pick.tier, more: list.length - 1 };
}
