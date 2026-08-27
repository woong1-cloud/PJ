import { CLOSED_STATUSES, MERGED_STATUS, DONE_STATUS } from './statuses';

// 종결된 건이 왜 그렇게 끝났는지.
//
// 반려·취소는 사유, 완료는 승인 확인 내용이다. 셋 다 같은 자리에 들어간다 —
// change_logs.comment (close/route.js 와 approve/route.js 의 같은 주석 참고).
//
// 이 함수가 필요한 이유: 그 값이 저장은 되는데 화면 어디에도 보이지 않았다.
// 머리 줄은 '반려'만 말하고, 알림 문구에도 사유가 없고, 활동 피드는 기본 탭이
// '코멘트'라 상태 변경 이력이 한 번 더 눌러야 나온다. 세 곳이 모두 막혀 있어서
// IT 가 사유를 적어도 요청자에게는 "그냥 반려됐다"로만 보였다.
//
// requirement: { status }
// changeLogs: [{ field_name, new_value, comment, created_at, changer }]
//
// 반환: { status, label, reason, by, at } | null
export function closureReason({ requirement, changeLogs = [] } = {}) {
  const status = requirement?.status;
  if (!status || !CLOSED_STATUSES.includes(status)) return null;
  // 중복은 뺀다. 병합 배너가 이미 "어느 요청에 합쳐졌는지"를 말하고, 그쪽이
  // 사유보다 쓸모 있다 — 원본으로 가는 링크가 붙어 있다.
  if (status === MERGED_STATUS) return null;

  // 지금 상태로 바꾼 로그 중 가장 나중 것.
  //
  // 마지막을 고르는 이유: 반려했다가 재개하고 다시 반려하는 일이 있다. 그때
  // 첫 사유를 보여주면 이미 지난 이야기를 현재 상태의 설명으로 내미는 셈이다.
  //
  // 배열 순서를 믿지 않고 시각으로 고른다 — 부르는 쪽이 어떤 순서로 넘기는지에
  // 결과가 달라지면 안 된다.
  let best = null;
  let bestMs = -Infinity;
  for (const log of changeLogs ?? []) {
    if (log?.field_name !== 'status' || log.new_value !== status) continue;
    const ms = Date.parse(log.created_at ?? '');
    if (!Number.isFinite(ms) || ms <= bestMs) continue;
    best = log;
    bestMs = ms;
  }

  const reason = best?.comment?.trim();
  // 한 글자짜리는 배너로 띄우지 않는다.
  //
  // 승인 창이 확인 내용을 필수로 받는데, 실제 데이터에서 완료 17건 중 4건이
  // '.' 한 글자다. 형식을 채우려고 넣은 값이라, 그걸 배너 한 덩어리로 키우면
  // "승인 확인 내용: ." 이 된다. 기록은 활동 피드에 그대로 남는다.
  if (!reason || reason.length < 2) return null;

  return {
    status,
    label: status === DONE_STATUS ? '승인 확인 내용' : `${status} 사유`,
    reason,
    by: best.changer?.name ?? null,
    at: best.created_at ?? null,
  };
}
