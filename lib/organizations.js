// 조직(소속) 판정의 순수 로직.
//
// 가입 화면·관리 화면·승인 화면이 같은 파일을 읽는다. 세 곳에 규칙을
// 복제하면 언젠가 한 곳만 고쳐지고, 그때 화면마다 다른 목록이 보인다.

import { TIER_RANK } from './tiers';

// 가입 화면의 소속 셀렉트에 쓸 두 그룹.
//
// 조직이 20개쯤 되면 한 줄로 늘어놓을 수 없다. 브랜드와 본부·팀은 고르는
// 사람의 머릿속에서 이미 갈라져 있으므로 화면도 그렇게 나눈다.
//
// 그룹 판정은 brand_id 로 한다 — 그룹 컬럼을 따로 두면 언젠가 brand_id 와
// 어긋나고, 그때 어느 쪽이 진실인지 알 수 없다.
export function groupOrganizations(organizations) {
  const active = (Array.isArray(organizations) ? organizations : [])
    .filter((o) => o?.is_active !== false)
    // sort_order 가 같을 때 이름으로 한 번 더 가른다. 안 그러면 목록 순서가
    // 조회할 때마다 달라져서 "어제 여기 있었는데" 가 된다.
    .sort((a, b) => {
      const d = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      return d !== 0 ? d : String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
    });
  return {
    brands: active.filter((o) => o.brand_id),
    teams: active.filter((o) => !o.brand_id),
  };
}

// 가입 승인 화면에 미리 채울 등급.
//
// 제안일 뿐이고 확정은 관리자가 한다. 소속은 가입자가 스스로 고르는
// 자기 신고라, '재무팀' 을 골랐다는 이유로 권한이 자동으로 열리면 그건
// 스스로 권한을 부여하는 길이 된다.
//
// 모르는 값은 전부 가장 낮은 등급으로 떨어진다. hasOwnProperty 로 확인하는
// 이유는 'toString' 같은 값이 프로토타입을 타고 통과하는 것을 막기 위해서다
// (lib/signup.js 의 옛 TIER_BY_AFFILIATION 이 같은 이유로 프로토타입 없는
// 객체를 썼다).
export function suggestTierFromOrg(organization) {
  const tier = organization?.default_tier;
  return Object.prototype.hasOwnProperty.call(TIER_RANK, tier) ? tier : '4차';
}

// 화면에 보여줄 소속.
//
// 조직 이름 -> 옛 affiliation -> 대시 순으로 떨어진다. 마이그레이션 0022 가
// affiliation='본부' 인 사람을 비워 두므로, 그 사람들도 이관될 때까지
// 관리자 눈에 계속 보여야 한다.
export function displayAffiliation(member) {
  return member?.organization?.name ?? member?.affiliation ?? '—';
}
