// 전체관리자를 해제하면 어디에 남고 어디를 잃나.
//
// 창에서 세지 않고 여기서 센다 — 화면은 이 결과를 그리기만 한다.
//
// 비활성 브랜드를 따로 가르는 이유: 배치가 있어도 /api/my-brands 가
// 걸러내서 실제로는 못 들어간다. 개수만 세면 안전해 보이는데 실제는 절반일
// 수 있다 — 한지웅이 배치 4개 중 둘만 살아남는다.
//
// 브랜드 목록에 없는 배치는 어느 묶음에도 안 넣는다. 브랜드를 지웠거나
// 조회가 활성만 가져온 경우인데, keep 에 넣으면 못 들어가는 곳을 들어간다고
// 말하게 된다 — 이 창이 하지 말아야 할 딱 하나의 거짓말이다.
//
// brandRoles: [{ brandId, brandName, tier }]
// brands:     [{ id, name, is_active }]
export function demoteImpact({ brandRoles, brands } = {}) {
  const roles = Array.isArray(brandRoles) ? brandRoles : [];
  const list = Array.isArray(brands) ? brands : [];

  // 이름순으로 고정한다. 순서가 요청마다 바뀌면 같은 창이 다르게 보인다.
  const byName = (a, b) => String(a).localeCompare(String(b), 'ko');

  // 배치는 brandId 로 찾는다. brandName 으로 맞추면 이름을 바꾼 브랜드가
  // 통째로 빠진다.
  const tierOf = new Map(roles.map((r) => [r.brandId, r.tier]));

  const keep = [];
  const lose = [];
  const inactive = [];

  for (const brand of list) {
    const assigned = tierOf.has(brand.id);
    if (brand.is_active) {
      if (assigned) keep.push({ name: brand.name, tier: tierOf.get(brand.id) });
      else lose.push(brand.name);
    } else if (assigned) {
      inactive.push(brand.name);
    }
    // 배치도 없고 비활성인 브랜드는 아무 일도 안 일어난다 — 안 그린다.
  }

  keep.sort((a, b) => byName(a.name, b.name));
  lose.sort(byName);
  inactive.sort(byName);

  return { keep, lose, inactive };
}
