// 런칭 보드 화면 상태의 단일 출처.
//
// 지금까지 보기·역할·검색·묶기는 LaunchBoard 의 useState 였고 역할만
// localStorage 에 남았다. 그래서 주소를 그대로 보내도 상대는 자기 화면을 봤고,
// 주간 진척에서 "막힌 5건"을 보고 보드로 건너갈 길이 없었다.
//
// 요구사항 쪽 lib/requirementFilters.js 와 같은 모양이다. 두 화면이 다른
// 규칙을 쓰면 언젠가 한쪽만 고쳐진다.

export const LAUNCH_TABS = ['board', 'decisions', 'weekly', 'gantt'];
export const DEFAULT_TAB = 'board';

export const LAUNCH_VIEWS = ['week', 'late', 'blocked', 'ready', 'na', 'all'];
export const DEFAULT_VIEW = 'ready';

export const LAUNCH_GROUPS = ['workstream', 'assignee', 'week'];
export const DEFAULT_GROUP = 'workstream';

// 기본값과 그 후보. merge 가 "이 값은 기본이니 주소에서 뺀다"를 판정할 때 쓴다.
const ENUMS = {
  tab: { list: LAUNCH_TABS, fallback: DEFAULT_TAB },
  view: { list: LAUNCH_VIEWS, fallback: DEFAULT_VIEW },
  group: { list: LAUNCH_GROUPS, fallback: DEFAULT_GROUP },
};

// 주소 → 화면 상태.
//
// 모르는 값은 기본값으로 떨어뜨린다. 손으로 주소를 고쳤거나 링크가 잘려서 온
// 사람에게 빈 화면을 주는 대신 기본 화면을 준다.
export function parseLaunchParams(searchParams) {
  const get = (key) => searchParams?.get(key) ?? '';
  const pick = (key) => {
    const value = get(key);
    return ENUMS[key].list.includes(value) ? value : ENUMS[key].fallback;
  };
  return {
    tab: pick('tab'),
    view: pick('view'),
    group: pick('group'),
    role: get('role'),
    // team_members.id (uuid). 「내 담당」 칩이 쓴다. assignee_name 은 아직
    // 주소에 없다 — 471건 모두 비어 있어 그 드롭다운이 안 그려진다.
    assignee: get('assignee'),
    q: get('q'),
    // 간트에서 막대를 눌러 넘어온 워크스트림.
    ws: get('ws'),
    // 항목 코드. 2단계에서 보기 창을 연다.
    task: get('task'),
    // 주소에 role 키 자체가 있었나.
    //
    // 값이 빈 문자열인 것("역할 전체를 골랐다")과 키가 아예 없는 것("아직 안
    // 골랐으니 브라우저 기억을 쓴다")은 다르다. get() 은 둘 다 '' 로 주므로
    // 여기서 따로 알려 준다.
    roleInUrl: Boolean(searchParams?.has?.('role')),
  };
}

// 지금 주소에 변경분만 얹는다.
//
// 빈 문자열·null·undefined·false 는 "그 키를 지운다"는 뜻이다. 열거형은
// 기본값이거나 모르는 값이면 역시 지운다 — 기본값을 주소에 남기면 "?" 가
// 붙어 있는 것이 필터가 걸렸다는 신호가 되지 못한다.
//
// 필터와 무관한 파라미터는 안 건드린다.
export function mergeLaunchParams(currentSearch, patch) {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(patch)) {
    const enumDef = ENUMS[key];
    const isDefault =
      enumDef && (value === enumDef.fallback || !enumDef.list.includes(value));
    if (value === '' || value === null || value === undefined || value === false || isDefault) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
