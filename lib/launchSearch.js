// 런칭 항목 찾기.
//
// 가이드와 보드가 같은 방식으로 찾아야 한다. 두 화면에 각각 쓰면 한쪽만
// 고쳐지고, 실제로 그랬다 — 보드에서 찾히는 것이 가이드에서 안 찾혔다.
//
// 칸을 가리지 않고 한 덩어리로 본다. 어느 칸에 있는지 기억하고 찾는
// 사람은 없다.

// 큰 뜻 없이 대소문자를 맞춘다.
//
// 한글에는 대소문자가 없지만 이 자료에는 영문 약어가 잔뜩이다 —
// WMS · ERP · GA4 · SKU · 3PL · PG · KC · QA · UAT · IA · SLA · RACI · EP.
// 'wms' 라고 친 사람에게 "없습니다"를 보여주면 그 사람은 항목이 없다고
// 믿는다. 대문자로 다시 쳐 볼 이유가 없다.
export function matchesQuery(fields, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  const hay = (fields ?? [])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

// 항목 하나에서 찾을 칸들.
//
// 가이드와 런칭 항목이 같은 모양이라 함수를 나누지 않는다.
export function searchFields(item) {
  return [
    item?.code,
    item?.title,
    item?.note,
    item?.deliverable,
    item?.owner_role,
    item?.support_role,
    item?.category,
    item?.workstream,
    // 쉬운 설명도 찾는다. 처음 하는 사람이 아는 말은 여기 있을 수 있다 —
    // "허가"로 찾으면 '통신판매업 신고'가 나와야 한다.
    item?.plain_text,
  ];
}

export function matchesItem(item, query) {
  return matchesQuery(searchFields(item), query);
}
