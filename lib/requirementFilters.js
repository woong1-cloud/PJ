// 목록·보드가 공유하는 요구사항 필터의 단일 출처.
//
// 필터를 페이지의 useState 로 들고 있으면 목록 ↔ 보드 전환에서 조용히 사라진다.
// 화면은 "뷰 전환"처럼 생겼는데 실제로는 초기화라, 사용자는 자기가 뭘 잘못
// 눌렀는지 알 수 없다. 그래서 필터 상태는 URL 쿼리스트링에 둔다 — 두 화면이
// 같은 값을 읽고, 주소를 그대로 붙여넣어 남에게 같은 화면을 보여줄 수 있다.
//
// 파라미터 이름은 /api/requirements 가 이미 받는 이름(q, assignee, category,
// channel, priority, project, includeDone)을 그대로 쓴다. 주소창과 API 가 같은
// 어휘를 쓰면 둘 사이에 변환 표를 둘 필요가 없다.

import { CLOSED_STATUSES } from './statuses';

export const FILTER_KEYS = [
  'status',
  'assignee',
  'category',
  'channel',
  'priority',
  'project',
];

// 필터 초기화용 패치. 빈 문자열은 mergeFilterParams 에서 "삭제"로 해석된다.
export const EMPTY_FILTERS = Object.freeze(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));

// URLSearchParams → 화면이 쓰는 필터 상태.
// 없는 파라미터는 null 이 아니라 '' 로 내려준다. select 의 "선택 안 함"과
// "값이 없음"을 화면에서 구분할 이유가 없고, 구분하면 분기만 늘어난다.
export function parseFilterParams(searchParams) {
  const get = (key) => searchParams?.get(key) ?? '';
  return {
    filters: Object.fromEntries(FILTER_KEYS.map((key) => [key, get(key)])),
    query: get('q'),
    // 문자열 'true' 만 참으로 본다. includeDone=1 같은 변형을 받아주면
    // 우리가 만드는 주소와 사람이 손으로 고친 주소의 의미가 갈린다.
    includeDone: get('includeDone') === 'true',
    // '내 요청만'. 요청자 셀렉트 대신 토글로 둔 이유는, 이걸 가장 자주 쓰는
    // 사람이 4차 요청자이고 그에게 필요한 답은 늘 "내가 올린 것" 하나이기
    // 때문이다. 팀원 20명 목록에서 자기 이름을 찾게 만들 이유가 없다.
    mine: get('mine') === 'true',
  };
}

// 지금 주소의 쿼리스트링에 변경분만 얹는다.
//
// 빈 문자열·false·null 은 "그 파라미터를 지운다"는 뜻이다. 기본값을 URL 에
// 남기지 않아야 "?" 가 붙어 있으면 필터가 걸려 있다는 신호가 된다.
// 필터와 무관한 파라미터는 건드리지 않는다.
export function mergeFilterParams(currentSearch, patch) {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(patch)) {
    if (value === '' || value === false || value === null || value === undefined) {
      params.delete(key);
    } else {
      params.set(key, value === true ? 'true' : String(value));
    }
  }
  return params.toString();
}

// 필터 상태 → /api/requirements 에 붙일 쿼리스트링.
//
// forceIncludeDone: 보드 전용. 보드에는 '완료' 컬럼이 있으므로 종결된 건을
// 항상 받아와야 한다. 빼먹으면 그 컬럼이 통째로 비어 보인다(과거에 실제로
// 그랬다). 그래서 보드는 URL 의 includeDone 값과 무관하게 항상 true 로 부른다.
export function buildRequirementsQuery({
  brandId,
  filters = {},
  query = '',
  includeDone = false,
  forceIncludeDone = false,
  mine = false,
  memberId = '',
} = {}) {
  const params = new URLSearchParams({ brandId: String(brandId ?? '') });
  for (const key of FILTER_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  const trimmed = (query ?? '').trim();
  if (trimmed) params.set('q', trimmed);
  // mine 은 결국 requester 필터다. 내 id 를 모르는 순간(세션 로딩 중 등)에
  // requester= 를 빈 값으로 보내면 API 가 "요청자가 빈 문자열인 건"을 찾아
  // 0건이 된다 — 필터가 걸린 것처럼 보이지만 아무것도 안 나오는 상태다.
  if (mine && memberId) params.set('requester', String(memberId));

  // 상태 필터가 종결 상태를 가리키면 includeDone 을 강제로 켠다.
  //
  // API 는 status 로 좁힌 뒤 includeDone 이 false 면 종결 상태를 걷어낸다.
  // 그래서 '완료'를 고르면 "완료인 것 AND 완료가 아닌 것"이 되어 항상 0건이다.
  // 빈 목록은 에러가 아니라, 사용자는 완료된 건이 없다고 믿는다.
  const closedPicked = CLOSED_STATUSES.includes(filters.status);
  if (includeDone || forceIncludeDone || closedPicked) params.set('includeDone', 'true');
  return params.toString();
}

// 필터가 하나라도 걸려 있는지. FilterBar 의 '필터 초기화' 노출 조건.
export function hasActiveFilters({ filters = {}, query = '', mine = false } = {}) {
  return FILTER_KEYS.some((key) => Boolean(filters[key])) || Boolean(query) || mine === true;
}
