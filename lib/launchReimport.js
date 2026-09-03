import { DONE_STATUS, NA_STATUS, TODO_STATUS } from './launchTask';

// 재가져오기 계획.
//
// 같은 파일을 열 번 올려도 안전해야 한다. 그러지 않으면 아무도 두 번 안
// 올리고, 그러면 양식을 만든 의미가 없다.
//
// 규칙 하나가 나머지를 정한다: 계획은 엑셀이 원본, 진행은 모아가 원본.
// 재가져오기가 지난주 회의에서 찍은 상태를 지우면 그 순간 못 쓰는 기능이
// 된다.

// 가져오기가 뺀 것의 사유. 사람이 쓴 사유와 가르는 표식이다.
//
// 컬럼을 따로 두지 않는 이유: 사유가 어차피 필수다. 필수인 값 하나로
// 구분되면 컬럼을 더 두는 것은 같은 사실을 두 벌 갖는 것이다.
export const IMPORT_EXCLUDED_REASON = '양식에서 빠짐';

// 서버는 사유 뒤에 직전 상태를 붙여 저장한다 —
//   '양식에서 빠짐 (직전 상태: 하는 중)'
//
// 되살릴 때 '할 것' 으로만 돌아가면 "하는 중이었는데"가 사라진다. 컬럼을
// 하나 더 두는 대신 사유 문자열에 담는다. 사유는 어차피 사람이 읽는 것이고,
// 거기 적혀 있는 것이 가장 정직하다.
const PREV = /\(직전 상태:\s*([^)]+)\)/;

function importExcluded(row) {
  return String(row?.excluded_reason ?? '').startsWith(IMPORT_EXCLUDED_REASON);
}

function previousStatus(row) {
  const m = String(row?.excluded_reason ?? '').match(PREV);
  return m ? m[1].trim() : TODO_STATUS;
}

// 엑셀이 원본인 열. 이 목록에 없는 것은 절대 안 덮는다.
const PLAN_COLUMNS = [
  'title', 'workstream', 'category', 'channel', 'decision_org', 'owner_org',
  'owner_role', 'support_role', 'depends_on', 'day_offset', 'deliverable',
  'note', 'is_critical', 'sort_order', 'plain_text',
];

function planPatch(item) {
  const patch = {};
  for (const key of PLAN_COLUMNS) {
    if (item[key] !== undefined) patch[key] = item[key];
  }
  return patch;
}

export function planReimport({ incoming = [], existing = [] } = {}) {
  const rows = incoming ?? [];
  const have = new Map((existing ?? []).map((e) => [e.code, e]));
  const seen = new Set(rows.map((i) => i.code));

  const create = [];
  const update = [];
  const restore = [];

  for (const item of rows) {
    const cur = have.get(item.code);

    if (!cur) {
      create.push({
        ...planPatch(item),
        code: item.code,
        source: 'import',
        status: item.not_applicable ? NA_STATUS : TODO_STATUS,
        excluded_reason: item.not_applicable ? item.excluded_reason : null,
      });
      continue;
    }

    // 계획 열은 언제나 갱신한다. 해당없음인 항목도 마찬가지다 — 되살아날
    // 때 옛 제목으로 돌아오면 안 된다.
    update.push({ id: cur.id, code: cur.code, patch: planPatch(item) });

    // 가져오기가 뺐던 것이 다시 나타났다. 사람이 뺀 것은 안 건드린다 —
    // 사람의 판단이 파일보다 세다.
    //
    // startsWith 인 것이 요점이다. 서버가 직전 상태를 뒤에 붙여 저장하므로
    // 완전 일치로 검사하면 되살리기가 조용히 안 된다.
    if (cur.status === NA_STATUS && importExcluded(cur)) {
      restore.push({ id: cur.id, code: cur.code, status: previousStatus(cur) });
    }
  }

  const exclude = [];
  const untouched = [];

  for (const cur of existing ?? []) {
    if (seen.has(cur.code)) continue;

    // 이미 한 일을 없던 일로 만들 수 없다.
    if (cur.status === DONE_STATUS) {
      untouched.push({ id: cur.id, code: cur.code, why: 'done' });
      continue;
    }
    if (cur.status === NA_STATUS) {
      untouched.push({ id: cur.id, code: cur.code, why: 'already' });
      continue;
    }
    // 시트 밖에서 난 일이라 시트에 없는 게 당연하다.
    if (cur.source === 'manual') {
      untouched.push({ id: cur.id, code: cur.code, why: 'manual' });
      continue;
    }

    exclude.push({
      id: cur.id,
      code: cur.code,
      // 뺄 때의 상태를 사유에 함께 적는다. 되살릴 때 '할 것' 으로만
      // 돌아가면 "하는 중이었는데" 가 사라진다.
      excluded_reason: IMPORT_EXCLUDED_REASON,
      previous_status: cur.status,
    });
  }

  return { create, update, exclude, restore, untouched };
}
