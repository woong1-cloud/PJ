// 전사 직원 목록 화면 상태의 단일 출처.
//
// 검색·칩·브랜드를 페이지의 useState 로 들고 있으면 「비활성 3명」을 찾아
// 놓고 한 사람을 고친 뒤 돌아왔을 때 다시 22명 전체가 뜬다. 주소를 그대로
// 보내도 상대는 자기 화면을 본다.
//
// 런칭 보드 lib/launchFilters.js 와 같은 모양이다. 함수 이름·인자 모양을
// 일부러 맞췄다 — 두 곳이 다른 어법이면 다음 사람이 둘 다 읽어야 한다.
//
// 주소: /settings/members?q=한지&f=active&brand=s

import { MEMBER_FILTERS } from './memberFilter';

export const DEFAULT_MEMBER_FILTER = 'all';

// 기본값과 그 후보. merge 가 "이 값은 기본이니 주소에서 뺀다"를 판정할 때 쓴다.
//
// brand 는 여기 없다. uuid 라서 후보 목록을 미리 가질 수가 없다 —
// 열거형으로 막으면 브랜드가 하나 늘 때마다 이 파일을 고쳐야 한다.
// 없는 브랜드가 들어오면 목록이 비어 보일 뿐 화면은 안 죽는다.
const ENUMS = {
  f: { list: MEMBER_FILTERS, fallback: DEFAULT_MEMBER_FILTER },
};

// 주소 → 화면 상태.
//
// 모르는 값은 기본값으로 떨어뜨린다. 손으로 주소를 고쳤거나 링크가 잘려서 온
// 사람에게 빈 화면을 주는 대신 기본 화면을 준다.
export function parseMemberParams(searchParams) {
  const get = (key) => searchParams?.get(key) ?? '';
  const pick = (key) => {
    const value = get(key);
    return ENUMS[key].list.includes(value) ? value : ENUMS[key].fallback;
  };
  return {
    // 앞뒤 공백을 여기서 뗀다. 붙여넣기에는 공백이 딸려 오는데, 그대로 두면
    // 주소에 %20 이 남아 같은 검색이 서로 다른 주소가 된다.
    q: get('q').trim(),
    f: pick('f'),
    // 브랜드 id, 또는 '배치 없음'을 뜻하는 'none'(lib/memberFilter.js 의
    // BRAND_NONE). 둘이 같은 칸을 쓰므로 여기서도 갈라놓지 않는다.
    brand: get('brand'),
  };
}

// 지금 주소에 변경분만 얹는다.
//
// 빈 문자열·null·undefined·false 는 "그 키를 지운다"는 뜻이다. 열거형은
// 기본값이거나 모르는 값이면 역시 지운다 — 기본값을 주소에 남기면 "?" 가
// 붙어 있는 것이 필터가 걸렸다는 신호가 되지 못하고, 남에게 링크를 보낼 때
// ?f=all&q=&brand= 처럼 뜻이 흐려진다.
//
// 필터와 무관한 파라미터는 안 건드린다.
export function mergeMemberParams(currentSearch, patch) {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(patch)) {
    // 공백뿐인 검색어는 빈 검색어와 같다. parse 가 어차피 떼어내므로
    // 넣는 쪽에서도 떼어 두어야 두 방향이 어긋나지 않는다.
    const next = key === 'q' && typeof value === 'string' ? value.trim() : value;
    const enumDef = ENUMS[key];
    const isDefault =
      enumDef && (next === enumDef.fallback || !enumDef.list.includes(next));
    if (next === '' || next === null || next === undefined || next === false || isDefault) {
      params.delete(key);
    } else {
      params.set(key, String(next));
    }
  }
  return params.toString();
}
