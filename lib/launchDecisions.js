import { findHeaderRow, toObjects } from './sheetHeader';

// 00_개요 의 [먼저 결정할 것] → 476건 중 회의에서 실제로 다투는 14건.
//
// 나머지 항목은 이 결정의 결과다. RAID 로그의 D(Decisions) 다 —
// "A dependency is not a note. It blocks specific tasks." 미결 시 영향이
// 왜 지금 답해야 하는지를 말한다. 이미 사람이 써 두었다.

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// [제반사항] 뒤에 [먼저 결정할 것] 이 붙어 있고, 그 뒤에 설명이 이어진다 —
// 실제 값은 "[먼저 결정할 것] — 결정 전에는 후속 과업이 착수되지 않는 항목".
// 그래서 완전 일치가 아니라 startsWith 로 찾는다.
const START = '[먼저 결정할 것]';

const REQUIRED = ['시기', '결정 항목'];

// rows 는 배열 행이다(`header: 1`). parseContext 와 같은 모양으로 받는다.
export function parseDecisions(rows = []) {
  const list = rows ?? [];
  const startAt = list.findIndex((r) => (r ?? []).some((c) => text(c).startsWith(START)));
  if (startAt < 0) return [];

  // 다음 [ 로 시작하는 행에서 자른다. 안 자르면 뒤에 오는 블록(예:
  // [먼저 결정할 것] 다음에 오는 다른 표)이 결정으로 딸려 들어온다.
  let endAt = list.length;
  for (let i = startAt + 1; i < list.length; i += 1) {
    const first = text((list[i] ?? [])[0]);
    if (first.startsWith('[')) {
      endAt = i;
      break;
    }
  }
  const block = list.slice(startAt, endAt);

  // 머리 행이 블록 제목 바로 다음 줄이라고 가정하지 않는다 — 사이에 빈 줄이
  // 끼는 시트를 실제로 봤다(sheetHeader.js 와 같은 이유).
  const headerAt = findHeaderRow(block, REQUIRED);
  if (headerAt < 0) return [];

  // toObjects 는 머리 행에 이름이 없는 열(다섯째 열의 비고 같은 것)을
  // 저절로 버린다 — 억지로 담지 않는 것이 여기서 지키는 것 하나다.
  const rowsFromHeader = block.slice(headerAt);
  const objects = toObjects({ rows: rowsFromHeader, required: REQUIRED });

  const out = [];
  let seq = 0;
  for (const obj of objects) {
    const title = text(obj['결정 항목']);
    // 결정 항목이 비면 버린다. 시기·영향만 있고 항목이 없는 줄은 항목이 아니다.
    if (!title) continue;
    seq += 1;
    out.push({
      seq,
      // when_text 는 날짜로 바꾸지 않는다. '9월 중' 이 그 정도로만 정해져
      // 있다는 뜻이고, 날짜로 바꾸면 없는 정확도를 만들고 그 날짜가 지나면
      // 화면이 붉어진다 — 있지도 않은 약속을 어겼다고.
      when_text: text(obj['시기']) || null,
      title,
      impact: text(obj['미결 시 영향']) || null,
      owner_text: text(obj['결정 주체']) || null,
    });
  }
  return out;
}
