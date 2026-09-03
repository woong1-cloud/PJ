// 00_개요 의 [제반사항] → 런칭의 전제.
//
// 451건이 왜 그렇게 생겼는지의 답이 이 7줄이다.
//
//   구축 방식 — 자체 구축 차세대 플랫폼 기반
//   개발 주체 — 내부 개발이 아닌 외주 개발
//   재고 — WMS(이허브) 확정. 운영 방식은 미결
//
// 반년 뒤에 "왜 회원 연동을 안 했지"를 여기서 읽는다. 항목 하나하나를
// 뒤져서는 못 찾는다.

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

const START = '[제반사항]';

// rows 는 배열 행이다(`header: 1`). 다른 파서와 같은 모양으로 받는다.
export function parseContext(rows = []) {
  const list = rows ?? [];
  const at = list.findIndex((r) => (r ?? []).some((c) => text(c).startsWith(START)));
  if (at < 0) return [];

  const out = [];
  for (let i = at + 1; i < list.length; i += 1) {
    const cells = (list[i] ?? []).map(text);
    const label = cells[0] ?? '';
    // 다음 블록에서 멈춘다. 안 멈추면 [먼저 결정할 것] 의 표가 전제로
    // 들어오고, 그러면 화면 맨 위에 '시기 / 결정 항목' 이 뜬다.
    if (label.startsWith('[')) break;
    const value = cells.slice(1).find(Boolean) ?? '';
    if (!label || !value) continue;
    out.push({ label, value });
  }
  return out;
}
