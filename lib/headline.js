import {
  CLOSED_STATUSES,
  DONE_STATUS,
  HOLD_STATUS,
  MERGED_STATUS,
  REJECTED_STATUS,
} from './statuses';
import { STATUS_META } from './statusMeta';
import { isStalled } from './stalled';
import { canProcess } from './tiers';
import { canApprove } from './approval';
import { canSubmitForReview } from './submitRequirement';
import { isOverdue } from './overdue';

const MS_PER_DAY = 86400000;

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 머리 줄이 말할 것을 정한다.
//
// 화면을 등급별로 나누지 않기 위해 있는 함수다. 같은 자리에서 문구와 행동만
// 갈리므로, 그 판정을 한곳에 모아 두면 손볼 곳이 하나다. 요청자 화면과 실무자
// 화면을 따로 만들면 한쪽만 고쳐지는 날이 온다.
//
// requirement: { status, assignee, requester, is_confidential,
//                expected_release_date, created_at, completed_at }
// stalledDays: lib/stalled.js 의 값. 종결 건은 null 이다.
// viewer: { memberId, tier, isGlobalAdmin }
// today: 'YYYY-MM-DD' — 지연 판정용
//
// 반환: { tone, elapsed, assigneeText, action, badges }
export function headline({ requirement, stalledDays = null, viewer, today } = {}) {
  if (!requirement) {
    return { tone: 'flat', elapsed: null, assigneeText: null, action: null, badges: [] };
  }

  const status = requirement.status;
  const assigneeId = idOf(requirement.assignee);
  const requesterId = idOf(requirement.requester);
  const closed = CLOSED_STATUSES.includes(status);
  // 보류는 종결 목록에 있지만 끝난 것이 아니다. 목록의 행(lib/listRow.js)과
  // 같은 규칙으로 가른다 — 두 화면이 같은 건을 다르게 말하면 안 된다.
  const hold = status === HOLD_STATUS;

  return {
    tone: resolveTone({ status, closed, hold, stalledDays }),
    elapsed: resolveElapsed({ requirement, status, closed, hold, stalledDays }),
    assigneeText: resolveAssigneeText({ requirement, status, assigneeId, viewer }),
    action: resolveAction({ status, assigneeId, requesterId, viewer }),
    badges: resolveBadges({ requirement, status, today }),
  };
}

// 종결을 먼저 본다. 완료 건에 정체 일수가 붙어 오면(부르는 쪽 실수) 붉게
// 칠해질 텐데, 끝난 일에 경고를 다는 것이 가장 나쁜 오답이다.
function resolveTone({ status, closed, hold, stalledDays }) {
  if (status === DONE_STATUS) return 'done';
  if (status === REJECTED_STATUS) return 'stall';
  // 보류는 60일을 넘겨야 튄다. 그 전에는 조용하다 — 미루기로 한 것을 매일
  // 붉게 칠하면 보류한 뜻이 없다.
  if (hold) return isStalled({ status, stalledDays }) ? 'stall' : 'flat';
  if (closed || status === '작성중') return 'flat';
  if (isStalled({ status, stalledDays })) return 'stall';
  if (status === '검토대기' || status === '승인대기') return 'wait';
  return 'go';
}

// 완료 건은 "며칠 지났나"가 아니라 "며칠 걸렸나"를 말한다. 끝난 일에 경과를
// 붙이면 시간이 갈수록 숫자가 커져서 나쁜 소식처럼 읽힌다.
function resolveElapsed({ requirement, status, closed, hold, stalledDays }) {
  if (status === DONE_STATUS) {
    const from = Date.parse(requirement.created_at ?? '');
    const to = Date.parse(requirement.completed_at ?? '');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return `${Math.floor((to - from) / MS_PER_DAY)}일 걸림`;
  }
  // 보류는 얼마나 오래 미뤄져 있는지가 상태 이름보다 중요하다.
  if (hold) return isStalled({ status, stalledDays }) ? `${stalledDays}일째 멈춤` : null;
  if (closed || stalledDays === null) return null;
  if (isStalled({ status, stalledDays })) return `${stalledDays}일째 멈춤`;
  if (stalledDays === 0) return '오늘 접수';
  return `${stalledDays}일째`;
}

// 예전에는 승인대기에서 담당자 본인에게 "다른 사람의 승인을 기다립니다"를
// 보여줬다. 그때는 담당자가 승인할 수 없어서 버튼이 안 보였고, 이유를
// 말해줄 문구가 필요했다.
//
// 이제 담당자도 승인할 수 있으므로(lib/approval.js) 그 문구는 거짓말이다 —
// 기다릴 필요 없이 자기가 누르면 된다.
function resolveAssigneeText({ requirement, status, assigneeId, viewer }) {
  if (assigneeId) return `담당 ${requirement.assignee?.name ?? ''}`.trim();
  if (canProcess(viewer)) return '담당자 없음';
  return '담당자를 기다리고 있습니다';
}

function resolveAction({ status, assigneeId, requesterId, viewer }) {
  // 병합된 건은 서버가 상태 변경을 막는다.
  if (status === MERGED_STATUS) return null;
  const primary = STATUS_META[status]?.primary ?? null;
  if (!primary) return null;

  // 승인은 4차도 한다. 담당자 본인도 한다 — 점검은 주간회의의 '확인할
  // 완료'로 자리를 옮겼다(lib/approval.js 의 긴 주석 참고).
  if (primary.via === 'approve') {
    const verdict = canApprove({
      requirement: { status, assignee: assigneeId },
      actor: { memberId: viewer?.memberId, isGlobalAdmin: viewer?.isGlobalAdmin === true },
    });
    return verdict.allowed ? { kind: 'primary' } : null;
  }

  // 검토 요청은 본인의 작성중 건만(3차 이상은 언제나).
  if (primary.via === 'submit') {
    return canSubmitForReview({ status, requester: requesterId }, viewer)
      ? { kind: 'primary' }
      : null;
  }

  if (canProcess(viewer)) return { kind: 'primary' };

  // 4차에게 남는 길은 자기 요청을 거두는 것 하나다. 종결된 건에는 그것도 없다.
  if (!CLOSED_STATUSES.includes(status) && requesterId && requesterId === viewer?.memberId) {
    return { kind: 'cancel' };
  }
  return null;
}

// 상태와 다른 축이라 알약으로 따로 붙는다. isOverdue 가 종결 건을 걸러 내므로
// 여기서 또 걸지 않는다.
function resolveBadges({ requirement, status, today }) {
  const badges = [];
  if (requirement.is_confidential) badges.push('비공개');
  if (isOverdue(requirement.expected_release_date, status, today)) {
    badges.push(`⚠ 예상일 ${requirement.expected_release_date} 지남`);
  }
  return badges;
}
