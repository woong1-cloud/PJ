import { canManageBrand, isGlobalAdmin } from './tiers';

// 설정 레일의 묶음.
//
// 여기 있는 것이 곧 설정의 전부다. 화면을 더할 때 이 목록에 한 줄을 넣으면
// 레일과 폰의 select 가 함께 늘어난다 — 두 곳을 맞추게 하면 언젠가 한쪽만
// 고친다.
//
// 묶음 제목에 브랜드 이름을 붙이는 일은 화면이 한다(SettingsRail). 여기서
// 붙이면 순수 함수가 identity 의 브랜드 이름까지 알아야 한다.
export const SETTINGS_GROUPS = [
  {
    id: 'account',
    title: '내 계정',
    items: [
      { href: '/settings/profile', label: '내 정보' },
      { href: '/settings/password', label: '비밀번호' },
      { href: '/settings/install', label: '폰에 설치하기' },
    ],
  },
  {
    // 「이 브랜드」다. 아래 org 묶음의 「브랜드」와 이름이 겹쳐 보이지만
    // 묶음이 달라서 안 헷갈린다 — 그게 이 화면을 다시 짠 이유다.
    //
    // 다만 이름을 한 단어로 짧게 두면 묶음 제목을 안 읽는다. 처음에
    // 「팀」과 「팀원」으로 뒀더니 레일을 훑을 때 둘이 중복처럼 보였다 —
    // 자리가 이름을 설명하게 하겠다고 해 놓고 이름이 자리에 너무 기댄
    // 셈이다. 그래서 각 줄이 혼자서도 무엇인지 말하게 길게 적는다.
    //
    // 지금 이름은 화면이 이미 쓰는 말에서 가져왔다 — 전사 화면의 단추가
    // 「+ 새 직원」이고, 이 화면의 소제목이 「팀원 배치」다.
    id: 'brand',
    title: '이 브랜드',
    need: 'brand',
    items: [
      { href: '/settings/brand/team', label: '팀 배치' },
      { href: '/settings/brand/categories', label: '요구사항 분류' },
    ],
  },
  {
    id: 'org',
    title: '전사',
    need: 'global',
    items: [
      { href: '/settings/brands', label: '브랜드' },
      { href: '/settings/members', label: '직원' },
      { href: '/settings/organizations', label: '조직 · 직무' },
      { href: '/settings/feedback', label: '받은 의견' },
    ],
  },
];

// 이 사람이 볼 수 있는 묶음.
export function settingsGroupsFor(identity) {
  return SETTINGS_GROUPS.filter((group) => {
    if (group.need === 'brand') return canManageBrand(identity);
    if (group.need === 'global') return isGlobalAdmin(identity);
    return true;
  });
}

// 묶음을 펴서 줄만. 폰의 select 와 문지기가 쓴다.
export function settingsItemsFor(identity) {
  return settingsGroupsFor(identity).flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.title })),
  );
}

// 이 주소를 볼 수 있나.
//
// 목록에 없는 주소는 막는다. true 로 돌리면 새 화면을 더하면서 목록에
// 안 넣었을 때 문지기가 조용히 빠진다.
export function isSettingsPathAllowed(identity, pathname) {
  return settingsItemsFor(identity).some((item) => item.href === pathname);
}
