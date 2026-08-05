import { FILTER_KEYS } from './requirementFilters';

// 마지막으로 보던 목록 조건을 기억한다.
//
// 저장은 브라우저(localStorage)다. 서버에 두면 기기를 넘나드는데 그게 오히려
// 이상하다 — PC 에서 '담당자=나'를 걸어 놓고 폰을 열었을 때 그대로 따라오면,
// 폰에서는 전체를 훑고 싶은 경우가 많다.
//
// 브랜드마다 따로 저장한다. 담당자·카테고리·프로젝트 필터는 값이 브랜드에
// 묶인 uuid 라서, 한 곳에 저장하면 다른 브랜드로 옮겼을 때 그 브랜드에 없는
// id 로 걸러진다 — 결과가 0건인데 화면에는 이유가 없다.
export const FILTER_MEMORY_VERSION = 1;

export function filterMemoryKey(brandId) {
  return `moa.listFilters.v${FILTER_MEMORY_VERSION}.${brandId}`;
}

// 주소에 조회 조건이 하나라도 있으면 복원하지 않는다.
//
// 필터의 원본은 URL 이다. 누가 ?status=개발중 링크를 공유했는데 내 저장값이
// 덮으면, 두 사람이 서로 다른 화면을 보면서 같은 것을 본다고 믿게 된다.
// 링크가 항상 이긴다.
export function urlHasFilters(searchKey) {
  const params = new URLSearchParams(searchKey ?? '');
  const watched = [...FILTER_KEYS, 'q', 'mine', 'includeDone', 'missing'];
  return watched.some((key) => Boolean(params.get(key)));
}

// 저장할 모양으로 추린다.
//
// 검색어는 넣지 않는다. 일회성이라 어제 친 '쿠폰'이 오늘 되살아나면 도움이
// 아니라 사고다. 정렬은 넣는다 — "예상일 순으로 보기"를 매번 다시 누르는 것이
// 실제로 귀찮다.
export function packFilterMemory({ filters = {}, mine = false, includeDone = false, sort } = {}) {
  const packed = { filters: {}, mine: Boolean(mine), includeDone: Boolean(includeDone) };
  for (const key of FILTER_KEYS) {
    if (filters[key]) packed.filters[key] = String(filters[key]);
  }
  if (sort?.key) packed.sort = { key: sort.key, dir: sort.dir === 'asc' ? 'asc' : 'desc' };
  return packed;
}

// 읽을 때 화이트리스트로 거른다.
//
// localStorage 는 사용자가 손으로 고칠 수 있고, 예전 버전이 남아 있을 수도
// 있다. 모르는 키를 그대로 주소에 실으면 API 가 400 을 내거나 조용히 무시하는데
// 둘 다 화면에는 이유가 안 보인다.
export function unpackFilterMemory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const filters = {};
  const src = raw.filters && typeof raw.filters === 'object' ? raw.filters : {};
  for (const key of FILTER_KEYS) {
    if (typeof src[key] === 'string' && src[key]) filters[key] = src[key];
  }
  const out = { filters, mine: raw.mine === true, includeDone: raw.includeDone === true };
  if (raw.sort && typeof raw.sort.key === 'string' && raw.sort.key) {
    out.sort = { key: raw.sort.key, dir: raw.sort.dir === 'asc' ? 'asc' : 'desc' };
  }
  return out;
}

// 복원할 것이 있는지. 정렬만 남아 있는 경우는 "조건이 걸린" 상태가 아니다 —
// 안내 문구를 띄울 이유가 없다.
export function hasRestorableFilters(memory) {
  if (!memory) return false;
  return (
    Object.keys(memory.filters ?? {}).length > 0 ||
    memory.mine === true ||
    memory.includeDone === true
  );
}

// 주소에 써 넣을 패치. FILTER_KEYS 를 전부 담아 예전 값이 남지 않게 한다.
export function filterMemoryToParams(memory) {
  const patch = {};
  for (const key of FILTER_KEYS) patch[key] = memory?.filters?.[key] ?? '';
  patch.mine = memory?.mine ? 'true' : '';
  patch.includeDone = memory?.includeDone ? 'true' : '';
  return patch;
}

// 저장소 접근. 서버 렌더나 사생활 보호 모드에서 localStorage 가 없거나 던질 수
// 있는데, 필터 기억 때문에 목록 화면이 안 뜨면 안 된다.
export function readFilterMemory(brandId) {
  if (!brandId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(filterMemoryKey(brandId));
    return raw ? unpackFilterMemory(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeFilterMemory(brandId, memory) {
  if (!brandId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(filterMemoryKey(brandId), JSON.stringify(memory));
  } catch {
    // 용량 초과·차단. 기억을 못 하는 것뿐이라 조용히 넘어간다.
  }
}
