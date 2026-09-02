import { toObjects } from './sheetHeader';

// 역할 사전 — 시트의 24_R&R분배 가 그대로 이것이다.
//
// 모아의 직무(기획자·온라인 MD·법무…)로 번역하지 않는다. 여기 역할은 직무와
// 소속의 합성이라 — 브랜드PM = 브랜드 소속 PM, 서비스기획 = 온라인본부 소속
// 기획 — 억지로 옮기면 시트를 만든 사람이 자기 문서를 못 알아본다.
//
// 사람 매핑은 런칭마다 따로 붙인다(launch_members.role_name). 같은 '물류'라도
// 브랜드마다 다른 사람일 수 있다.

const COL = { name: '역할', org: '소속', scope: '업무 범위' };

// 이 아래는 파생이다.
//
// 24_R&R분배 시트는 위쪽이 역할 사전이고 아래쪽이 '시트 × 역할 분포' 표다.
// 그 표는 모아가 다시 세므로 읽지 않는다 — 읽으면 같은 숫자를 두 벌 갖게
// 되고, 상태가 바뀌는 순간 둘이 갈린다.
const STOP = /시트\s*[×x]\s*역할/;

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// rows 는 배열 행이다(`header: 1`). 이 시트는 1행이 제목이고 2행이 머리라,
// 1행을 머리로 가정하면 역할이 0건이 된다 — 실제로 그랬다.
export function parseRoles(rows = []) {
  const out = [];
  const seen = new Set();
  for (const row of toObjects({ rows, required: [COL.name, COL.scope] })) {
    const name = text(row?.[COL.name]);
    // 분포 표를 만나면 멈춘다. 그 표의 머리 행에도 '역할' 열이 있어서,
    // 안 멈추면 시트 이름들이 역할로 들어온다.
    if (STOP.test(Object.values(row ?? {}).map(text).join(' '))) break;
    // 머리 행과 빈 행. '역할'이라는 값 자체가 머리다.
    if (!name || name === COL.name) continue;
    // 업무 범위가 없으면 사전이 아니다 — 분포 표의 잔재일 수 있다.
    const scopeText = text(row?.[COL.scope]);
    if (!scopeText) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    out.push({
      name,
      org: text(row?.[COL.org]) || null,
      scope_text: scopeText,
      // 건수는 읽지 않는다. 모아가 항목에서 다시 센다 — 시트의 숫자를
      // 저장하면 런칭이 진행되며 실제와 갈린다.
      sort_order: out.length,
    });
  }
  return out;
}
