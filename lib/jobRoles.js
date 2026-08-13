// 직무 목록의 순수 로직.
//
// 조직(lib/organizations.js)과 같은 모양이다. 다른 점은 그룹이 없다는 것
// 하나뿐이라 파일이 짧다 — 억지로 한 파일에 합치면 "조직 함수인가 직무
// 함수인가"를 매번 확인해야 한다.

// 가입 화면에 보일 직무.
//
// 비활성은 뺀다. 쓰지 않기로 한 직무가 목록에 남아 있으면 새로 가입하는
// 사람이 그것을 고르고, 관리자는 왜 아직 그 값이 들어오는지 알 수 없다.
//
// sort_order 가 같을 때 이름으로 한 번 더 가른다. 안 그러면 목록 순서가
// 조회할 때마다 달라져서 "어제 여기 있었는데" 가 된다.
export function activeJobRoles(jobRoles) {
  return (Array.isArray(jobRoles) ? jobRoles : [])
    .filter((r) => r?.is_active !== false)
    .sort((a, b) => {
      const d = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      return d !== 0 ? d : String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
    });
}

// 화면에 보여줄 직무.
//
// 조인된 이름 -> 옛 job_role 문자열 -> 대시 순으로 떨어진다. 마이그레이션
// 0023 이 이름으로 이어 붙이므로 남는 행이 없어야 하지만, 이름을 바꾼 뒤에
// 들어온 옛 값이 있을 수 있다(lib/organizations.js 의 displayAffiliation 과
// 같은 규칙).
export function displayJobRole(member) {
  return member?.jobRole?.name ?? member?.job_role ?? '—';
}
