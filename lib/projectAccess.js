// 프로젝트를 볼 수 있는가.
//
// 이 판정이 서버에 없어서 구멍이 있었다. GET /api/projects 는 로그인만 확인하고,
// 어느 브랜드로 좁힐지는 클라이언트가 보내는 brandId 에 의존했다. 그래서
// 화면의 '전사 전체' 버튼을 누르거나 brandId 를 빼고 직접 호출하면 누구나
// 전사 프로젝트 목록을 받았고, id 만 알면 다른 브랜드 프로젝트 상세(이름·담당자·
// 브랜드별 진척)까지 열렸다.
//
// 규칙은 요구사항 권한과 같은 자리에서 나온다: user_brand_roles.
// 내가 배치된 브랜드에 전개된 프로젝트만 보인다. 전체관리자는 전부.
//
// projectBrands: 그 프로젝트의 전개 행 [{ brand_id }] (또는 [{ brandId }])
// myBrandIds: 내가 배치된 브랜드 id 목록
export function canSeeProject({ projectBrands, myBrandIds, isGlobalAdmin }) {
  if (isGlobalAdmin === true) return true;
  const mine = new Set(myBrandIds ?? []);
  if (mine.size === 0) return false;
  // 전개 브랜드가 하나도 없는 프로젝트는 전체관리자만 본다. 방금 만들어 아직
  // 전개하지 않은 프로젝트가 여기 해당한다 — 아무 브랜드의 것도 아니므로
  // "내 브랜드에 전개됐다"가 성립하지 않는다.
  return (projectBrands ?? []).some((pb) => mine.has(pb?.brand_id ?? pb?.brandId));
}

// 목록용. 프로젝트마다 전개 행을 찾아 위 판정을 적용한다.
//
// projects: [{ id }]
// allProjectBrands: 전체 전개 행 [{ project_id, brand_id }]
export function visibleProjects({ projects, allProjectBrands, myBrandIds, isGlobalAdmin }) {
  const rows = allProjectBrands ?? [];
  return (projects ?? []).filter((p) =>
    canSeeProject({
      projectBrands: rows.filter((pb) => pb.project_id === p.id),
      myBrandIds,
      isGlobalAdmin,
    }),
  );
}

// 프로젝트 상세의 요구사항 목록을 내 브랜드 것만 남긴다.
//
// 비공개 판정(lib/visibleRequirements.js)과는 다른 축이다. 그건 "이 건이
// 비공개인가", 이건 "이 건이 내 브랜드인가"다. 둘 다 걸어야 한다 —
// 하나만 걸면 다른 축으로 새어 나간다.
//
// 진척률(byBrand)은 이걸로 거르지 않는다. 분모가 사람마다 달라지면 같은
// 프로젝트가 사람에 따라 다른 진척률로 보인다.
export function requirementsOfMyBrands(requirements, { myBrandIds, isGlobalAdmin }) {
  if (isGlobalAdmin === true) return requirements ?? [];
  const mine = new Set(myBrandIds ?? []);
  return (requirements ?? []).filter((r) => mine.has(r.brand_id));
}
