// 가이드 항목의 코드 짓기.
//
// 사람에게 코드를 받지 않는다. '01-04' 를 손으로 적게 하면 중복이 나고,
// 중복은 unique(guide_id, code) 에 걸려 저장이 통째로 실패한다. 그때 화면은
// "저장하지 못했습니다"만 말하고 사람은 뭐가 문제인지 모른다.
//
// 워크스트림은 시트 이름 모양('01_신규법인')을 그대로 쓴다. 앞 두 자리가
// 코드의 앞자리가 되므로, 시트에서 가져온 항목과 손으로 넣은 항목이 같은
// 체계 안에 있게 된다.

const WORKSTREAM = /^(\d{2})_.+/;

export function isWorkstream(name) {
  return typeof name === 'string' && WORKSTREAM.test(name.trim());
}

// '01_신규법인' → '01'
export function workstreamPrefix(name) {
  const m = typeof name === 'string' ? name.trim().match(WORKSTREAM) : null;
  return m ? m[1] : null;
}

// 그 워크스트림의 다음 코드. 못 지으면 null.
//
// 빈자리를 메우지 않는다. 01-02 를 지웠어도 다음은 01-04 다 — 지운 코드를
// 되쓰면 옛 기록(런칭 항목의 guide_item, 회의록의 코드)이 다른 항목을
// 가리키게 된다.
export function nextCode({ workstream, existingCodes = [] } = {}) {
  const prefix = workstreamPrefix(workstream);
  if (!prefix) return null;

  let max = 0;
  for (const code of existingCodes ?? []) {
    const m = String(code ?? '').match(/^(\d{2})-(\d{2})$/);
    if (!m || m[1] !== prefix) continue;
    max = Math.max(max, Number(m[2]));
  }
  const next = max + 1;
  // 한 워크스트림에 99건이 넘으면 코드 체계가 감당 못 한다. 지금 가장 큰
  // 워크스트림이 40건이라 한참 남았지만, 넘으면 조용히 '01-100' 을 만들어
  // 모양이 깨지는 것보다 막는 쪽이 낫다.
  if (next > 99) return null;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}
