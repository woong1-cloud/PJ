// 시트에서 머리 행을 찾아 객체 배열로 바꾼다.
//
// 왜 필요한가: 시트마다 머리 행의 위치가 다르다. 워크스트림 시트(01~18)는
// 1행이 머리지만 24_R&R분배 는 1행이 제목이고 2행이 머리다.
//
// 1행을 머리로 가정하면 24_R&R분배 에서 역할이 0건이 된다(실제로 그랬다).
// 더 나쁜 것은 v11 에서 워크스트림 시트에 제목 줄이 하나 붙는 경우다 —
// 그때는 403건이 통째로 0이 되고, 화면에는 "가져올 것이 없습니다"만 뜬다.
//
// 그래서 화면은 모든 시트를 `header: 1`(배열 행)로 넘기고, 머리 행을 여기서
// 찾는다. 위치를 가정하지 않으므로 제목 줄이 몇 개 붙어도 견딘다.

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// required 를 모두 담은 첫 행의 번호. 못 찾으면 -1.
export function findHeaderRow(rows = [], required = []) {
  const need = required.map(text).filter(Boolean);
  if (need.length === 0) return -1;
  const list = rows ?? [];
  for (let i = 0; i < list.length; i += 1) {
    const cells = (list[i] ?? []).map(text);
    if (need.every((n) => cells.includes(n))) return i;
  }
  return -1;
}

// 배열 행 → 객체 행. 머리 행을 못 찾으면 빈 배열.
//
// 빈 배열을 주는 것이 맞다. 머리를 못 찾았다는 것은 이 시트의 모양을 모른다는
// 뜻이고, 그때 순서로 억지로 읽으면 열이 하나 밀린 채 403건이 들어간다.
export function toObjects({ rows = [], required = [] } = {}) {
  const at = findHeaderRow(rows, required);
  if (at < 0) return [];
  const header = (rows[at] ?? []).map(text);
  const out = [];
  for (let i = at + 1; i < rows.length; i += 1) {
    const cells = rows[i] ?? [];
    // 통째로 빈 행은 버린다. 시트 끝의 여백이 그대로 항목이 되면 안 된다.
    if (cells.every((c) => text(c) === '')) continue;
    const obj = {};
    header.forEach((name, col) => {
      if (name) obj[name] = cells[col] ?? null;
    });
    out.push(obj);
  }
  return out;
}
