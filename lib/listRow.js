import {
  CLOSED_STATUSES,
  DONE_STATUS,
  HOLD_STATUS,
  REJECTED_STATUS,
  INITIAL_STATUS,
} from './statuses';
import { isStalled } from './stalled';

const MS_PER_DAY = 86400000;

// 종결 사유를 행에 붙일 때의 길이 상한. 행은 한 줄이라 넘치면 제목을 밀어낸다.
const MAX_TAIL = 28;

// 뱃지를 그리지 않는 채널.
//
// channels.js 의 DEFAULT_CHANNEL 이 아니다 — 그건 '공통'이고 DB 기본값일 뿐
// 실제 데이터에 0건이다. 운영 47건 중 44건이 '자사몰'이라 그 뱃지를 마흔네 번
// 그리면 그것이 소음이 된다. 외부몰 셋만 붙으면 그 셋이 튄다.
//
// 지금 비율에 맞춘 판단이다. 외부몰이 늘면 둘 다 그리는 쪽으로 다시 봐야 한다 —
// 그때는 "안 그린 것이 자사몰"이라는 규칙을 아무도 기억하지 못한다.
const QUIET_CHANNEL = '자사몰';

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 행 하나가 보여줄 것을 정한다.
//
// 목록의 행과 보드의 카드가 이 하나를 함께 본다. 뷰가 셋이 되면서 같은 판정이
// 세 곳에 흩어지면, 다음 개선 때 세 번 고쳐야 하고 그중 한 곳은 반드시 빠진다.
//
// requirement: 목록 API 가 내려주는 행 하나
// stalledDays: 같은 API 가 실어 보낸 값. 종결 건은 null
// closure: lib/closureReason.js 결과 또는 null. 역시 API 가 실어 보낸다
//
// 반환: { tone, flag, channelBadge, elapsed, meta, tail, assignee }
export function listRow({ requirement, stalledDays = null, closure = null } = {}) {
  if (!requirement) {
    return {
      tone: 'flat',
      flag: null,
      channelBadge: null,
      elapsed: null,
      meta: [],
      tail: null,
      assignee: null,
    };
  }

  const status = requirement.status;
  const closed = CLOSED_STATUSES.includes(status);
  // 보류는 종결 목록에 있지만 끝난 것이 아니다. 아래 세 판정에서만 갈라
  // 준다 — 두 달이 지나도록 아무 진전이 없는 보류가 스스로 드러나게 하는
  // 장치가 목록의 이 붉은 줄뿐이다(회의에는 안 올린다).
  const hold = status === HOLD_STATUS;
  const assigneeId = idOf(requirement.assignee);
  // 기준이 상태마다 다르다(보류는 60일). 여기서 직접 비교하면 보류가 목록
  // 에서는 정체인데 상세에서는 아닌 화면이 된다.
  const stalled = isStalled({ status, stalledDays });
  const assigneeName = requirement.assignee?.name ?? '';

  return {
    tone: resolveTone({ status, closed, hold, stalled }),
    // 정체가 담당 없음을 이긴다. 둘 다 손이 필요하지만, 20일 멈춘 건이
    // 어제 들어온 미배정 건보다 급하다.
    //
    // 보류는 60일을 넘겼을 때만 깃발이 붙는다. 담당 없음은 안 붙인다 —
    // 미뤄 둔 건에 담당자가 없는 것은 당연하고, 그것까지 깃발로 세우면
    // 보류 칩이 통째로 붉어져서 진짜 오래된 것이 안 보인다.
    flag: hold ? (stalled ? 'stall' : null) : closed ? null : stalled ? 'stall' : assigneeId ? null : 'unassigned',
    channelBadge:
      requirement.channel && requirement.channel !== QUIET_CHANNEL ? requirement.channel : null,
    elapsed: resolveElapsed({ requirement, status, closed, hold, stalled, stalledDays }),
    meta: [
      requirement.category?.category_name,
      requirement.requirement_type,
      requirement.priority,
      requirement.requester?.name,
    ].filter(Boolean),
    tail: resolveTail(closure),
    assignee: assigneeId ? { name: assigneeName, initial: assigneeName.slice(0, 1) } : null,
  };
}

function resolveTone({ status, closed, hold, stalled }) {
  if (status === DONE_STATUS) return 'done';
  if (status === REJECTED_STATUS) return 'stall';
  // 보류는 60일을 넘겨야 튄다. 그 전에는 조용한 줄이다 — 미루기로 한 것을
  // 매일 붉게 칠하면 보류한 뜻이 없다.
  if (hold) return stalled ? 'stall' : 'flat';
  if (closed || status === INITIAL_STATUS) return 'flat';
  if (stalled) return 'stall';
  if (status === '검토대기' || status === '승인대기') return 'wait';
  return 'go';
}

// 상세의 머리 줄과 같은 규칙이다. 완료 건은 "며칠 지났나"가 아니라 "며칠
// 걸렸나"를 말한다 — 끝난 일에 경과를 붙이면 시간이 갈수록 숫자가 커져서
// 나쁜 소식처럼 읽힌다.
function resolveElapsed({ requirement, status, closed, hold, stalled, stalledDays }) {
  if (status === DONE_STATUS) {
    const from = Date.parse(requirement.created_at ?? '');
    const to = Date.parse(requirement.completed_at ?? '');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return `${Math.floor((to - from) / MS_PER_DAY)}일 걸림`;
  }
  // 보류는 얼마나 오래 미뤄져 있는지가 상태 이름보다 중요하다. 60일을
  // 넘기면 '62일째 멈춤', 그 전에는 그냥 '보류' 다.
  if (hold) return stalled ? `${stalledDays}일째 멈춤` : status;
  // 반려·취소·중복은 상태 이름 자체가 경과보다 많은 것을 말한다.
  if (closed) return status;
  if (stalledDays === null) return null;
  if (stalled) return `${stalledDays}일째 멈춤`;
  if (stalledDays === 0) return '오늘';
  return `${stalledDays}일째`;
}

function resolveTail(closure) {
  const reason = closure?.reason?.trim();
  if (!reason) return null;
  return reason.length <= MAX_TAIL ? reason : `${reason.slice(0, MAX_TAIL)}…`;
}
