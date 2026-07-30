import { isGlobalAdmin } from './tiers';

// 삭제를 확정하려면 이 단어를 그대로 입력해야 한다.
export const DELETE_CONFIRM_WORD = '삭제';

// 영구 삭제는 전체 관리자만 할 수 있다.
//
// 브랜드 관리자(2차)에게도 주고 싶은 유혹이 있지만, 이 동작은 되돌릴 수
// 없고 그 브랜드 사람들의 요청 기록까지 지운다. 반려·취소는 4차도 할 수
// 있으니 "이건 아니다"라고 표시할 방법은 이미 모두에게 있다. 여기서 여는
// 것은 "흔적도 남기지 않는다"뿐이고, 그건 좁게 가는 편이 맞다.
export function canDeleteRequirement(actor) {
  return isGlobalAdmin(actor ?? {});
}

// 확인 입력 검증. 앞뒤 공백은 봐준다 — 붙여넣기하면 흔히 딸려 온다.
export function isDeleteConfirmed(input) {
  return typeof input === 'string' && input.trim() === DELETE_CONFIRM_WORD;
}

// 지우기 전에 화면에 뭐가 함께 사라지는지 보여주기 위한 요약.
//
// 숫자 그 자체보다, 이 요구사항이 다른 요구사항과 얽혀 있는지가 중요하다.
// 병합 대상이었다면(mergedCount > 0) 지우는 순간 거기 병합됐던 건들은
// "중복인데 어디로 갔는지 모르는" 상태가 된다. 그 경우 화면에서 한 번 더
// 경고해야 해서 별도 플래그로 뺀다.
export function deletionSummary({ historyCount = 0, commentCount = 0, imageCount = 0, mergedCount = 0 } = {}) {
  return {
    historyCount,
    commentCount,
    imageCount,
    mergedCount,
    hasMergedSources: mergedCount > 0,
  };
}
