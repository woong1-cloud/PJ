import { INITIAL_STATUS } from './statuses';
import { isStalled } from './stalled';

// 이번 회의에서 다룰 것인가.
//
// 이 함수가 있기 전에는 '이번 회의 안건'이 미종결 전부였다. 21건이 전부
// 안건이면 그건 안건이 아니라 목록이고, 이름이 약속하는 것과 화면이 주는
// 것이 달랐다.
//
// 안건은 **손이 필요한 것**이다. 셋 중 하나면 들어온다:
//   · 14일 넘게 아무도 안 건드림
//   · 담당자가 없음
//   · 이번에 새로 들어옴
//
// 겹치는 것이 많아 합집합이 그리 크지 않다 — 운영 숫자로 멈춤 3 · 담당없음 6 ·
// 신규 3 에서 9건 안팎이다. 한 시간 회의가 다룰 수 있는 크기다.
//
// 나머지(잘 굴러가는 건)는 '진행 중 전체'에서 본다. 안건에서 빠지는 것이지
// 화면에서 사라지는 것이 아니다.
// 기준일을 인자로 안 받는다. isStalled 가 상태를 보고 정하므로(보통 14일,
// 보류 60일) 여기서 또 받으면 두 곳이 갈릴 자리가 생긴다.
export function isAgendaItem({ item } = {}) {
  if (!item) return false;
  // 완료는 '확인할 완료'가 따로 맡는다.
  if (item.isDone) return false;
  // 공이 요청자에게 넘어간 건은 이 회의에서 할 수 있는 일이 없다.
  if (item.awaiting) return false;
  // 작성중은 브랜드가 아직 제출하지 않은 초안이다. 남이 안 낸 것을 회의에서
  // 다룰 이유가 없다 — '진행 중 전체'에는 남으므로 굳이 말할 일이 있으면
  // 거기서 보면 된다.
  if (item.status === INITIAL_STATUS) return false;

  if (!item.assignee) return true;
  if (item.isNew) return true;
  return isStalled({
    status: item.status,
    stalledDays: item.stalledDays,
    // 위에서 이미 걸렀다.
    awaitingAnswer: false,
  });
}

// 화면에 그대로 쓰는 한 줄. 칩 이름만으로는 무엇이 들어오는지 알 수 없다.
export function agendaRule(stallDays) {
  return `${stallDays}일 넘게 멈췄거나, 담당자가 없거나, 이번에 새로 들어온 건`;
}
