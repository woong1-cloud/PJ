// 런칭 유형과 가져올 워크스트림.
//
// 지금 가이드는 '신규 법인' 기준으로 쓰여 있다. 기존 법인 안의 새 브랜드라면
// 01_신규법인(27건)과 02_양수·라이선스(25건)가 통째로 필요 없다 — 52건을
// 지우면서 시작하게 된다. 만들 때 한 번 고르면 그 일이 없어진다.

export const LAUNCH_KINDS = ['신규 법인', '양수·라이선스', '기존 법인 내 신규 브랜드'];

// 유형별로 기본에서 빼는 워크스트림 앞자리.
//
// 앞자리로 가르는 것이 이 가이드의 번호 체계에 묶여 있다는 점을 안다.
// 그래도 이름으로 맞추는 것보다 낫다 — 시트에서 '01_신규법인' 을
// '01_법인설립' 으로 고쳐도 번호는 그대로다.
//
// 맞는 워크스트림이 없으면 아무것도 안 빠진다. 유형 매핑이 어긋났을 때
// 조용히 항목이 사라지는 것보다, 전부 들어오고 사람이 빼는 쪽이 안전하다.
const EXCLUDED = {
  '신규 법인': [],
  '양수·라이선스': ['01'],
  '기존 법인 내 신규 브랜드': ['01', '02'],
};

export function excludedPrefixes(kind) {
  return EXCLUDED[kind] ?? [];
}

// 그 유형에서 기본으로 고를 워크스트림.
//
// workstreams: 가이드에 실제로 있는 이름들 ['01_신규법인', ...]
export function defaultWorkstreams({ kind, workstreams = [] } = {}) {
  const skip = excludedPrefixes(kind);
  return (workstreams ?? []).filter((w) => !skip.includes(String(w).slice(0, 2)));
}
