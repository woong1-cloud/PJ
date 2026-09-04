// 항목의 코드 짓기.
//
// 사람에게 코드를 받지 않는다. '01-04' 를 손으로 적게 하면 중복이 나고,
// 중복은 unique(code) 에 걸려 저장이 통째로 실패한다. 그때 화면은
// "저장하지 못했습니다"만 말하고 사람은 뭐가 문제인지 모른다.

// 코드 모양. 통합 WBS 가 07B-01 · 10A-03 을 쓴다 — 앞자리에 한 글자가 붙는다.
const CODE = /^(\d{2}[A-Z]?)-(\d{2})$/;

// 워크스트림 이름에서 뽑는 앞자리. 마지막 수단이다(아래 codePrefix 참고).
const NAME_DIGITS = /(\d{2})/;

// 워크스트림인가 — 비어 있지만 않으면 된다.
//
// 예전에는 '01_신규법인' 모양을 요구했다. 그 규칙이 통합 WBS 에서 깨졌다:
// 워크스트림이 D01_법인·행정 ~ D19_플랫폼구축 이라 열아홉 개가 하나도
// 통과하지 못했고, 그래서 '＋ 항목' 이 이 파일을 쓰는 런칭에서 아예 동작하지
// 않았다.
//
// 이름 규칙에 기대지 않는다. 시트 판정에서 이미 배운 것과 같다
// (lib/launchImport.js 의 isTaskSheet) — 이름은 다음 파일에서 또 바뀐다.
export function isWorkstream(name) {
  return typeof name === 'string' && name.trim().length > 0;
}

// 그 워크스트림이 실제로 쓰는 코드 앞자리.
//
// 이름에서 뽑지 않는다. 통합 WBS 를 보면 19개 워크스트림 중 이름의 숫자와
// 코드 앞자리가 맞는 것이 하나도 없다:
//
//   D08_WMS·재고     → 07B      D11_자사몰연결   → 10A
//   D09_물류운영      → 08       D17_앱(네이티브) → 16
//
// 이름은 사람이 붙인 제목이고 코드는 따로 자란다. 그러니 이미 있는 항목에게
// 물어보는 것이 유일하게 맞는 방법이다.
//
// existing: [{ code, workstream }]
export function codePrefix({ workstream, existing = [] } = {}) {
  const name = typeof workstream === 'string' ? workstream.trim() : '';
  if (!name) return null;

  // 그 워크스트림 안에서 가장 많이 쓰인 앞자리. 한 워크스트림에 두 가지가
  // 섞여 있어도(사람이 손으로 옮겼다면) 다수를 따른다.
  const count = new Map();
  for (const row of existing ?? []) {
    if (String(row?.workstream ?? '').trim() !== name) continue;
    const m = String(row?.code ?? '').match(CODE);
    if (!m) continue;
    count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  }
  if (count.size > 0) {
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // 항목이 하나도 없는 워크스트림이면 그때만 이름에서 뽑는다.
  // 'D01_법인·행정' 도 '01_신규법인' 도 '01' 이 된다.
  const m = name.match(NAME_DIGITS);
  return m ? m[1] : null;
}

// 그 워크스트림의 다음 코드. 못 지으면 null.
//
// 빈자리를 메우지 않는다. 01-02 를 지웠어도 다음은 01-04 다 — 지운 코드를
// 되쓰면 옛 기록(런칭 항목의 guide_item_id, 회의록의 코드)이 다른 항목을
// 가리키게 된다.
//
// existing: [{ code, workstream }]
export function nextCode({ workstream, existing = [] } = {}) {
  const prefix = codePrefix({ workstream, existing });
  if (!prefix) return null;

  // 같은 앞자리를 쓰는 코드는 워크스트림을 가리지 않고 전부 센다. 앞자리가
  // 겹치는데 워크스트림 안에서만 세면 번호가 겹치고, 겹치면 unique 제약에
  // 걸려 저장이 통째로 실패한다.
  let max = 0;
  for (const row of existing ?? []) {
    const code = typeof row === 'string' ? row : row?.code;
    const m = String(code ?? '').match(CODE);
    if (!m || m[1] !== prefix) continue;
    max = Math.max(max, Number(m[2]));
  }
  const next = max + 1;
  // 한 앞자리에 99건이 넘으면 코드 체계가 감당 못 한다. 지금 가장 큰
  // 워크스트림이 45건이라 한참 남았지만, 넘으면 조용히 '01-100' 을 만들어
  // 모양이 깨지는 것보다 막는 쪽이 낫다.
  if (next > 99) return null;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}
