import { splitRoles } from './launchMembers';
import { mentionableFromMembers } from './launchMentionable';
import { BLOCKED_STATUS } from './launchTask';

// 한 번에 몇 명까지.
//
// Gmail 한도 때문이 아니다 — 역할당 3~5명이라 회당 3~5통이고 한도의 몇 %다.
// 사람 때문이다. 역할을 잘못 골라 30명에게 나가면 그 뒤로 아무도 안 읽는다.
// weeklyDigest.js 가 같은 이유로 개별 리마인더를 안 만든다.
export const MAX_RECIPIENTS = 20;

// 같은 역할로 또 보내기 전에 알려 주는 창.
const RECENT_HOURS = 24;

// 미리 고를 역할.
//
// 막힘의 상대는 거의 늘 결정권이다. 매번 고르게 하면 같은 것을 반복한다.
// 결정권이 비어 있으면 주관으로 떨어진다 — 빈 화면을 주지 않는다.
export function defaultRoles(task) {
  if (!task) return [];
  if (task.status === BLOCKED_STATUS) {
    const decision = splitRoles(task.decision_org);
    if (decision.length > 0) return decision;
  }
  return splitRoles(task.owner_role);
}

// 고른 역할의 참여자.
//
// mentionableFromMembers 를 다시 쓴다 — 조인해서 온 member 객체에서 id·이름을
// 꺼내고, 비활성을 빼고, 한 사람이 두 역할이어도 한 번만 주는 일을 이미 한다.
// 여기서 새로 쓰면 그 판정이 두 곳으로 갈라진다.
export function recipientsForRoles(members = [], roles = []) {
  const wanted = new Set((roles ?? []).filter(Boolean));
  if (wanted.size === 0) return [];
  return mentionableFromMembers(
    (members ?? []).filter((m) => wanted.has(m?.role_name)),
  );
}

// 상한을 넘었나. 0 은 넘은 것이 아니다 — "고른 사람이 없다"는 부르는 쪽이 본다.
export function tooMany(count) {
  return Number(count) > MAX_RECIPIENTS;
}

// 최근에 같은 역할로 나간 요청이 있나. 겹치는 역할만 돌려준다.
//
// 막지 않는다. 정말 다시 보내야 할 때가 있다 — 판단은 사람이 한다.
// 여기서는 "어제 이미 보냈습니다"를 말할 재료만 준다.
export function recentlyAsked(comments = [], roles = [], now = new Date()) {
  const wanted = new Set((roles ?? []).filter(Boolean));
  if (wanted.size === 0) return [];
  const since = now.getTime() - RECENT_HOURS * 60 * 60 * 1000;
  const hit = new Set();
  for (const c of comments ?? []) {
    const list = c?.request_roles;
    if (!Array.isArray(list) || list.length === 0) continue;
    const at = new Date(c.created_at ?? 0).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    for (const r of list) if (wanted.has(r)) hit.add(r);
  }
  return [...hit];
}
