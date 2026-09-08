import { matchesQuery } from './launchSearch';

// 런칭 참여자 — 역할별로 누가 있고 몇 건을 맡나.
//
// 스펙: docs/superpowers/specs/2026-09-07-launch-members-step1-design.md
//
// 참여자와 담당자는 다른 층이다:
//   참여자 — 이 런칭에 누가 있나. 역할 ↔ 사람들 (1:N)
//   담당자 — 이 항목을 누가 하나. 항목 ↔ 사람 (0:1)
//
// 역할 하나에 사람이 여럿이라(재무팀·법무팀) 여럿을 붙이면 "내 일"이
// 사라진다. 그래서 역할은 1차 배분으로만 쓰고, 담당자는 주간 회의에서
// 집는다. 이 파일은 그 둘을 한 화면에 나란히 놓기 위한 셈이다.

// 역할 문자열 하나. LaunchBoard 의 splitRoles 와 같은 규칙이다 —
// support_role 에 '온라인BU 광고기획 , 브랜드PM' 처럼 쉼표로 둘이 든
// 값이 있어서 정확히 같은지만 보면 그 건들이 안 잡힌다.
export function splitRoles(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// 해당없음은 안 센다. 안 하기로 한 일이 역할의 짐으로 잡히면 "재무팀
// 17건"이 거짓말이 된다 — 진척률이 해당없음을 분모에서 빼는 것과 같은 뜻이다.
const counted = (task) => task?.status !== '해당없음';

// 화면에 그릴 역할 줄들.
//
// 항목에서 뽑은 역할과 명단에 든 역할을 합집합으로 낸다:
//   · 항목에는 있는데 사람이 없는 역할 → 빈 줄로 남긴다. 그 빈 줄이 곧
//     "여기 아무도 없다"는 말이고, 이 화면을 보는 이유다.
//   · 명단에는 있는데 항목에 없는 역할 → 역할 이름을 잘못 골랐다는 뜻이라
//     보여야 고쳐진다. 0건으로 남긴다.
//
// 정렬은 주관 건수 많은 순. 역할 띠와 같은 규칙이다 — 숫자가 보이는
// 목록이 그 숫자로 정렬돼 있어야 눈이 한 번만 훑는다.
export function memberRows({ tasks = [], members = [] } = {}) {
  const rows = new Map();
  const row = (role) => {
    if (!rows.has(role)) {
      rows.set(role, { role, members: [], ownerCount: 0, supportCount: 0, assignedCount: 0 });
    }
    return rows.get(role);
  };

  for (const task of tasks ?? []) {
    if (!counted(task)) continue;
    const owners = splitRoles(task.owner_role);
    for (const r of owners) {
      const it = row(r);
      it.ownerCount += 1;
      // 담당자는 주관 쪽에서만 센다. 지원 역할까지 세면 한 항목이 두 줄에
      // 잡혀 "담당자 붙은 것"의 합이 항목 수보다 커진다.
      if (hasAssignee(task)) it.assignedCount += 1;
    }
    for (const r of splitRoles(task.support_role)) row(r).supportCount += 1;
  }

  for (const m of members ?? []) {
    if (m?.role_name) row(m.role_name).members.push(m);
  }

  return [...rows.values()]
    .map((it) => ({ ...it, members: sortMembers(it.members) }))
    .sort(
      (a, b) =>
        b.ownerCount - a.ownerCount ||
        b.supportCount - a.supportCount ||
        a.role.localeCompare(b.role, 'ko'),
    );
}

// 담당자의 계정 id.
//
// 모양이 둘이다. 목록 API 는 team_members 를 붙여 주므로 객체로 오고
// ({ id, name }), 저장값이나 PATCH 로 보내는 값은 문자열이다. 한쪽만 보면
// 조용히 틀린다 — 「내 담당」 필터가 실제로 그랬다. 객체와 문자열을 === 로
// 견주니 담당자가 붙어 있어도 늘 0건이었고, 담당자가 없어서 0인 것과
// 화면에서 구분이 안 됐다.
export function assigneeId(task) {
  const value = task?.assignee;
  if (!value) return '';
  return typeof value === 'string' ? value : (value.id ?? '');
}

// 담당자가 붙었나. 계정(assignee)이 먼저고 자유 글자(assignee_name)가 뒤다 —
// 계정으로 붙으면 메일 주소가 따라오고, 계정 없는 사람만 글자로 남는다.
export function hasAssignee(task) {
  return Boolean(task?.assignee || String(task?.assignee_name ?? '').trim());
}

// 이름순.
//
// 참관(can_edit 거짓)은 안 만든다 — 그래서 정렬 축이 이름 하나다.
// 컬럼은 남아 있지만 값이 늘 참이라 여기서 가를 것이 없다.
function sortMembers(list) {
  return [...list].sort((a, b) =>
    String(a.member?.name ?? '').localeCompare(String(b.member?.name ?? ''), 'ko'),
  );
}

// 넣기 창의 후보.
//
// 이미 그 역할로 들어온 사람은 뺀다 — 체크해도 아무 일이 안 일어나는 줄을
// 두지 않는다. 다른 역할로 들어온 사람은 남긴다(한 사람이 두 역할을 가질
// 수 있는 것이 PK 를 넓힌 이유다).
//
// 활성 팀원만 받는 것은 부르는 쪽에서 이미 걸러 온다(is_active).
//
// query 로 이름·소속을 찾는다. 19명이면 체크박스를 다 깔아도 되지만 50명이
// 되면 벽이 된다.
//
// 이미 고른 사람은 검색어와 안 맞아도 남긴다. 셋을 체크하고 다른 이름을
// 치는 순간 그 셋이 화면에서 사라지면, 고른 것이 없어진 줄 안다 —
// 실제로는 남아 있는데 그렇게 안 보인다.
//
// 찾는 규칙은 lib/launchSearch.js 의 matchesQuery 다. 보드·가이드·선행조건
// 고르기가 다 쓰는 그 함수라 대소문자를 안 가린다.
export function memberCandidates({
  people = [], members = [], roleName = '', query = '', picked = [],
} = {}) {
  const taken = new Set(
    (members ?? []).filter((m) => m?.role_name === roleName).map((m) => m?.member_id),
  );
  const chosen = new Set(picked ?? []);
  const all = (people ?? [])
    .filter((p) => p?.id && !taken.has(p.id))
    .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));

  const hits = all.filter(
    (p) => chosen.has(p.id) || matchesQuery([p.name, p.organization?.name], query),
  );
  // total 은 거르기 전 수. "19명 중 4명"을 화면이 쓸 수 있어야 한다.
  return { hits, total: all.length };
}

// 이 항목의 담당자 후보 — 주관 역할로 들어온 참여자들.
//
// 항목 창의 담당자 칸이 19명이 아니라 2~3명이 되게 하는 것이 이 함수다.
// 담당자가 501건 중 0건인 이유는 한 줄씩 손으로 채우게 되어 있어서다.
//
// can_edit 이 거짓인 사람은 뺀다. 지금은 그런 사람을 안 만들지만(참관을
// 없앴다), 컬럼이 남아 있고 보고 화면에서 되살아날 수 있다 — 그때 이
// 필터가 없으면 보기만 하는 사람에게 일이 배정된다.
export function assigneeCandidates({ task, members = [] } = {}) {
  const roles = new Set(splitRoles(task?.owner_role));
  if (roles.size === 0) return [];
  const seen = new Set();
  return (members ?? [])
    .filter((m) => m?.can_edit !== false && roles.has(m?.role_name) && m?.member)
    .filter((m) => (seen.has(m.member_id) ? false : seen.add(m.member_id)))
    .sort((a, b) => String(a.member.name ?? '').localeCompare(String(b.member.name ?? ''), 'ko'));
}
