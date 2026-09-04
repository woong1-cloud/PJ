import { isBlocked, isLate, isThisWeek, isDoneThisWeek } from './launchTask';

// 주간 진척의 다섯 칸.
//
// 세는 규칙은 새로 만들지 않는다 — 전부 launchTask.js 에서 가져온다.
// 보드가 쓰는 것과 같은 함수라야 보드와 이 화면의 숫자가 갈리지 않는다.
// 결정 대기만 launch_decisions 쪽 규칙(status === '대기')이라 launchTask 에
// 없다 — 그 하나만 여기서 정한다.
//
// 칸끼리 배타적이지 않다. 막혔으면서 기한도 지난 항목은 ②·③ 둘 다에
// 든다 — LaunchBoard 의 '막힘' 보기와 '지남' 보기가 이미 그렇게 겹친다
// (taskTone 은 화면 색 하나를 고를 때만 막힘을 지남보다 앞세운다).
//
// 순서가 그대로 요점이다: 결정 대기가 맨 위다. 막힌 것의 원인이 대부분
// 미결이고, 그 인과가 위에서 아래로 읽혀야 한다.
export function weeklyBuckets({ tasks = [], decisions = [], openDate, today } = {}) {
  return {
    pendingDecisions: (decisions ?? []).filter((d) => d?.status === '대기'),
    blocked: (tasks ?? []).filter(isBlocked),
    late: (tasks ?? []).filter((t) => isLate({ task: t, openDate, today })),
    thisWeek: (tasks ?? []).filter((t) => isThisWeek({ task: t, openDate, today })),
    doneThisWeek: (tasks ?? []).filter((t) => isDoneThisWeek({ task: t, today })),
  };
}
