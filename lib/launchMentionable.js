// 이 런칭에서 부를 수 있는 사람들 = launch_members.
//
// 범위는 "그 런칭을 열 수 있는 사람"이다. 열지도 못하는 사람을 부르면 벨에
// 알림은 뜨는데 눌러 들어가면 403 이 뜬다 — 안 부른 것보다 나쁘다.
//
// 이 목록은 두 곳이 함께 쓴다: 입력창 자동완성(편의)과 알림 수신자
// 판정(관문). 화면이 보내온 이름이 아니라 서버가 다시 만든 이 목록으로 본문을
// 해석하므로, 화면 목록을 조작해 남을 부르는 길은 없다.
// lib/mentionable.js 와 같은 규칙이다.
//
// 전체 관리자를 자동으로 넣지 않는다. 넣으면 모든 런칭의 후보에 늘 셋이 껴
// 있다 — 전체 관리자도 참여자로 넣으면 되고, 그게 명단을 진짜로 만드는 길이다.

// 순수 부분. launch_members 조인 결과를 후보 목록으로 줄인다.
export function mentionableFromMembers(rows = []) {
  const seen = new Set();
  const out = [];
  for (const r of rows ?? []) {
    const m = r?.member;
    const name = String(m?.name ?? '').trim();
    // 이름이 빈 사람을 남기면 안 된다. ''.startsWith 는 어느 위치에서나
    // 통과해서 '@' 하나가 그 사람 멘션이 되어버린다(lib/mentions.js 참조).
    if (!m?.id || !name) continue;
    if (m.is_active === false) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// 조회 + 줄이기. 라우트와 notify 가 같이 쓴다.
export async function loadLaunchMentionable(supabase, { launchId }) {
  if (!launchId) return [];
  const { data, error } = await supabase
    .from('launch_members')
    .select('member_id, role_name, member:team_members!launch_members_member_id_fkey(id, name, is_active)')
    .eq('launch_id', launchId);
  // 목록을 못 받아도 댓글은 쓸 수 있어야 한다. 자동완성은 편의다 —
  // 여기서 던지면 댓글 화면 전체가 죽는다.
  if (error) return [];
  return mentionableFromMembers(data);
}
