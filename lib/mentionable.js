import { TIER_RANK } from './tiers';

// 이 요구사항에서 부를 수 있는 사람들.
//
// 범위는 "그 요구사항을 열 수 있는 사람"이다. 열지도 못하는 사람을 부르면
// 벨에 알림은 뜨는데 눌러 들어가면 403 이 뜬다 — 안 부른 것보다 나쁘다.
// 그래서 브랜드 팀으로 좁히고, 비공개 건이면 상세와 같은 규칙(3차 이상)을
// 한 번 더 건다(lib/requirementAccess.js 와 같은 판정이다).
//
// 이 목록은 두 곳이 함께 쓴다: 입력창 자동완성(편의)과 알림 수신자 판정(관문).
// 화면이 보내온 이름이 아니라 서버가 다시 만든 이 목록으로 본문을 해석하므로,
// 화면 목록을 조작해 남을 부르는 길은 없다.

// 이 등급이 이 요구사항을 열 수 있는가. requireRequirementAccess 와 같은 규칙.
export function canBeMentioned(tier, isConfidential) {
  const rank = TIER_RANK[tier];
  if (rank === undefined) return false;
  if (!isConfidential) return rank >= TIER_RANK['4차'];
  return rank >= TIER_RANK['3차'];
}

// embed 를 쓰지 않고 두 번 조회한다. requirements/team_members 사이에 FK 경로가
// 여럿이라 embed 는 FK 를 명시해야 하고(PGRST201), 여기서 필요한 건 id·이름뿐이다.
// notify.js 가 같은 이유로 같은 선택을 했다.
export async function loadMentionableMembers(supabase, { brandId, isConfidential }) {
  if (!brandId) return [];

  const { data: roles, error: rolesError } = await supabase
    .from('user_brand_roles')
    .select('team_member_id, tier')
    .eq('brand_id', brandId);
  if (rolesError) throw rolesError;

  const ids = [
    ...new Set(
      (roles ?? [])
        .filter((r) => canBeMentioned(r.tier, isConfidential))
        .map((r) => r.team_member_id)
        .filter(Boolean)
    ),
  ];

  // 전체관리자는 브랜드 배치와 무관하게 모든 건을 연다. 배치가 없다는 이유로
  // 못 부르게 하면, 정작 물어볼 상대(IT 관리자)를 부를 수 없는 화면이 된다.
  const { data: admins, error: adminError } = await supabase
    .from('team_members')
    .select('id, name')
    .eq('is_global_admin', true)
    .eq('is_active', true);
  if (adminError) throw adminError;

  let members = [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, name')
      .in('id', ids)
      .eq('is_active', true);
    if (error) throw error;
    members = data ?? [];
  }

  const byId = new Map();
  for (const m of [...members, ...(admins ?? [])]) {
    if (!m?.id || !m?.name) continue;
    byId.set(m.id, { id: m.id, name: m.name });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
