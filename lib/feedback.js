// 의견 보내기의 판정.
//
// 폼은 한 칸이다. 종류(오류/개선/문의)나 우선순위를 묻지 않는다 — 분류는 쓰는
// 사람보다 읽는 쪽이 잘하고, 칸이 늘수록 "이 버튼 좀 작아요" 같은 가벼운 말이
// 안 올라온다. 그래서 여기서 볼 것도 본문 하나뿐이다.

export const FEEDBACK_STATUSES = ['새로 옴', '확인함', '반영함'];

export const NEW_FEEDBACK_STATUS = '새로 옴';
export const ACKED_FEEDBACK_STATUS = '확인함';
export const RESOLVED_FEEDBACK_STATUS = '반영함';

// 한 행이 무한정 커지지 않게 막는다. 코멘트(4000)보다 짧게 잡는다 — 의견은
// 한두 문단이고, 그보다 긴 것은 요구사항으로 올릴 이야기다.
export const MAX_FEEDBACK_BODY = 2000;

// 저장 전 본문 정리. 문자열이 아니거나 공백뿐이면 빈 문자열이 되고, 부르는
// 쪽이 그것을 400 으로 돌린다.
export function normalizeFeedbackBody(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 상태를 바꿔도 되는가.
//
// '반영함' 은 메모 없이는 안 된다. 반려 사유를 필수로 받는 것과 같은 이유다 —
// 무엇이 어떻게 반영됐는지 없으면 낸 사람은 그냥 닫혔다고 읽는다. 그리고 그
// 한 줄이 그대로 낸 사람에게 가는 문장이라, 비어 있으면 보낼 것이 없다.
//
// '확인함' 은 메모를 안 받는다. "읽었고 지금은 안 함"이라 할 말이 없는 것이
// 정상이고, 여기서까지 한 줄을 요구하면 관리자가 상태를 안 바꾼다.
export function validateStatusChange({ status, note } = {}) {
  if (!FEEDBACK_STATUSES.includes(status)) {
    return { ok: false, error: '알 수 없는 상태입니다.' };
  }
  if (status === RESOLVED_FEEDBACK_STATUS && !normalizeFeedbackBody(note)) {
    return { ok: false, error: '무엇을 반영했는지 한 줄 적어 주세요. 그대로 전달됩니다.' };
  }
  return { ok: true };
}
