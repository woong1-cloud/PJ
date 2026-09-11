// 전사 직원 목록을 좁히는 규칙과 칩에 적을 숫자.
//
// 22명일 때는 눈으로 훑어도 됐다. 100명이 되면 「김동현이 어느 브랜드에
// 몇 차로 있나」를 찾을 방법이 아예 없어진다. 그래서 검색 한 칸과 칩 몇 개를
// 둔다 — 여기는 그 셈만 한다. 화면은 이 함수들이 준 것을 그리기만 한다.
//
// 거르는 일을 서버가 아니라 여기서 하는 이유는, /api/team-members 가 이미
// 전사 명단을 한 번에 주고 그 목록을 담당자 드롭다운 등 여러 화면이 함께
// 쓰기 때문이다. 글자 한 자마다 서버에 다시 물을 이유가 없다.

import { matchesQuery } from './launchSearch';

// 칩의 순서. 화면이 이 배열을 돌며 칩을 그리므로 순서는 여기서 정한다.
//
// 전체 → 재직중 → 비활성 → 전체관리자 → 소속 미지정. 넓은 것에서 좁은
// 것으로 간다.
export const MEMBER_FILTERS = ['all', 'active', 'off', 'admin', 'noOrg'];

// 조직으로 이관이 안 된 사람.
//
// lib/organizations.js 의 displayAffiliation 이 조직 이름 → 옛 affiliation →
// 대시 순으로 떨어지는데, 두 번째로 떨어진 사람은 화면에서 제대로 된 소속과
// 구별이 안 된다. 「본부」가 조직 이름인지 옛 자유 입력값인지 알 수가 없다.
//
// 판정을 organization?.name 으로 하는 이유: displayAffiliation 이 정확히 그
// 값이 없을 때 옛 값으로 떨어진다. organization 객체만 보면, 이름 없는 조직이
// 붙은 사람을 "이관됨"으로 세면서 화면에는 옛 값을 그리게 된다.
//
// displayAffiliation 자체는 안 건드린다 — 가입·승인 화면도 그 함수를 쓴다.
export function hasNoOrganization(member) {
  return !member?.organization?.name;
}

// 칩 하나가 뜻하는 술어. MEMBER_FILTERS 와 여기가 같은 키를 쓰므로
// 칩을 하나 더 만들 때 고칠 곳이 두 군데로 갈리지 않는다.
const PREDICATES = {
  all: () => true,
  active: (m) => m?.is_active === true,
  off: (m) => m?.is_active !== true,
  // 재직 여부를 같이 보지 않는다. 「전체관리자」 칩은 권한을 가진 사람을
  // 빠짐없이 보여줘야 하고, 그만둔 사람이 아직 1차를 들고 있다면 그거야말로
  // 이 칩으로 찾아내야 할 것이다.
  admin: (m) => m?.is_global_admin === true,
  // 여기도 재직 여부를 안 본다. 이관이 안 끝났다는 사실은 그 사람이 지금
  // 다니는지와 별개의 축이고, 둘을 섞으면 「소속 미지정」이 실제보다 적게
  // 보여서 이관이 끝난 줄 알게 된다.
  noOrg: (m) => hasNoOrganization(m),
};

// 배치 없음을 고르는 값. 브랜드 id 와 같은 칸을 쓴다.
//
// 칸을 따로 두면 「스파오 + 배치없음」 같은 뜻 없는 조합이 만들어진다.
// 한 칸에 넣으면 둘 중 하나만 고를 수 있어서 그 조합 자체가 생기지 않는다.
export const BRAND_NONE = 'none';

const brandIds = (member) =>
  (Array.isArray(member?.brandRoles) ? member.brandRoles : []).map((r) => r?.brandId);

// 검색이 훑는 칸.
//
// 이름만 보면 「kim_donghyun27 을 찾아 줘」가 안 된다. 사람은 계정 이름으로도
// 사람을 기억하고, 동명이인은 이메일로만 갈린다.
const searchFields = (member) => [member?.name, member?.email];

// 명단 → 걸러진 명단.
//
// q(검색) · f(칩) · brand(브랜드)는 AND 로 함께 건다. 셋 다 "좁히는" 축이라
// 하나를 더 걸면 결과가 줄어드는 것이 사람이 기대하는 방향이다.
//
// 모르는 값은 조용히 무시한다 — 주소를 손으로 고쳤거나 링크가 잘려 온
// 사람에게 빈 화면 대신 전체를 준다. lib/launchFilters.js 가 열거형을
// 기본값으로 떨어뜨리는 것과 같은 판단이다.
export function filterMembers(members, { q, f, brand } = {}) {
  const list = Array.isArray(members) ? members : [];
  const predicate = PREDICATES[f] ?? PREDICATES.all;

  return list.filter((member) => {
    if (!predicate(member)) return false;
    if (brand === BRAND_NONE) {
      if (brandIds(member).length > 0) return false;
    } else if (brand) {
      if (!brandIds(member).includes(brand)) return false;
    }
    // matchesQuery 가 앞뒤 공백과 대소문자를 맡는다. 런칭 보드의 찾기와
    // 같은 규칙이어야 한 화면에서 찾히는 것이 다른 화면에서 안 찾히는 일이
    // 안 생긴다.
    return matchesQuery(searchFields(member), q);
  });
}

// 칩에 적을 숫자.
//
// **브랜드·검색을 뺀 전체 기준**이다. 칩끼리 서로 줄이면 「재직중」을 누른
// 순간 「비활성 0」이 되어 거기로 건너갈 수가 없다. 칩은 서로 배타적인
// 갈림길이지 겹쳐 쌓는 필터가 아니다.
export function memberCounts(members) {
  const list = Array.isArray(members) ? members : [];
  return Object.fromEntries(
    MEMBER_FILTERS.map((key) => [key, list.filter(PREDICATES[key]).length]),
  );
}
