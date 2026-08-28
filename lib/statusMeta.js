import { REQUIREMENT_STATUSES } from './statuses';

// 상태에 딸린 모든 표현(색, 뜻, 다음 행동)의 단일 출처.
//
// 색 맵을 컴포넌트 안에 두면 키를 틀려도 `?? 기본값` 폴백 때문에 예외가 나지
// 않고 뱃지만 조용히 회색이 된다. 데이터로 꺼내 두면 아래 테스트가 누락을
// 잡아준다. 상태를 추가하거나 이름을 바꾸면 여기도 함께 고쳐야 한다.
export const STATUS_META = {
  작성중: {
    // 제출 전이라 가장 흐리게 — 테두리만 있는 모양.
    // bg-transparent 가 반드시 있어야 한다. Badge 기본 클래스에 bg-primary(거의
    // 검정)가 들어 있어서, 배경을 명시하지 않으면 검은 배경에 회색 글씨가 된다.
    style: 'border border-slate-300 bg-transparent text-slate-500',
    meaning: '브랜드가 초안을 쓰는 중, 아직 제출하지 않음',
    next: '브랜드 — 제출',
    // 요청자가 누르는 유일한 제출 수단이다. 3차 이상도 같은 버튼을 쓴다.
    primary: { label: '검토 요청', to: '검토대기', via: 'submit' },
  },
  검토대기: {
    // 목록에서 유일하게 튀는 색. "지금 IT가 손대야 할 것"이 한눈에 보여야 한다.
    style: 'bg-amber-50 text-amber-700',
    meaning: '제출 완료, IT가 아직 보지 않음',
    next: 'IT — 검토 시작',
    // 착수 창이 담당자·예상일·유형을 함께 받는다. 이 앱에서 담당 지정은
    // 독립된 행동이 아니라 착수의 일부다.
    primary: { label: '검토 시작', to: '검토중', via: 'start' },
  },
  검토중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: 'IT가 검토하고 정책을 정하는 중',
    next: 'IT — 개발 착수',
    primary: { label: '개발 시작', to: '개발중', via: 'direct' },
  },
  개발중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 진행 중',
    next: 'IT — QA 시작',
    primary: { label: 'QA 시작', to: 'QA중', via: 'direct' },
  },
  QA중: {
    // 개발중과 같은 계열. 아직 IT가 들고 있는 구간이라는 뜻이다.
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 끝나고 테스트가 진행 중',
    next: 'IT — 승인 요청',
    primary: { label: '승인 요청', to: '승인대기', via: 'direct' },
  },
  승인대기: {
    // 검토대기와 같은 앰버다. 둘 다 "상대가 손대야 넘어간다"는 뜻이고,
    // 목록에서 튀지 않으면 그대로 쌓인다 — 이 상태의 실패 모드가 정확히
    // 그것이다. QA까지 다 해놓고 아무도 승인을 안 눌러 완료가 안 되는 것.
    style: 'bg-amber-50 text-amber-700',
    meaning: 'QA까지 끝남, 브랜드·본부의 최종 확인을 기다리는 중',
    next: '브랜드·본부 — 승인',
    // to 가 없다. 완료는 POST /approve 로만 도달하고 그 라우트가 상태를 정한다.
    primary: { label: '승인하고 완료', to: null, via: 'approve' },
  },
  완료: {
    style: 'bg-emerald-50 text-emerald-700',
    meaning: '배포까지 끝남',
    next: '—',
    // 종결 건에는 다음 걸음이 없다. 되돌릴 길만 남는다.
    primary: { label: '재개', to: null, via: 'resume' },
  },
  보류: {
    // 테두리만 있는 모양이다. 작성중과 같은 문법으로, "흐름 안에 없다"는 뜻을
    // 색이 아니라 형태로 말한다.
    //
    // 앰버를 쓰지 않는다. 이 앱에서 앰버는 "누가 눌러야 다음으로 간다"는 뜻이고
    // (검토대기·승인대기), 보류는 정확히 그 반대 — 지금은 아무도 누르지
    // 않는다는 뜻이다. 아래 테스트가 그 규칙을 지킨다.
    //
    // 바이올렛은 다른 상태가 안 쓰는 색이다. 인디고(진행 중)와 계열이 가깝지만
    // 채우지 않고 테두리만 두르므로 목록에서 섞이지 않는다.
    //
    // bg-transparent 가 반드시 있어야 한다. Badge 기본 클래스의 bg-primary
    // (거의 검정)가 그대로 남아 검은 배경이 된다.
    style: 'border border-violet-300 bg-transparent text-violet-700',
    meaning: '지금은 진행할 수 없어 미뤄 둠 (하지 않기로 한 것이 아님)',
    next: '— (막힌 것이 풀리면 재개)',
    primary: { label: '재개', to: null, via: 'resume' },
  },
  반려: {
    // 색이 있어야 한다 — 거절당한 건은 요청자가 알아채야 한다.
    style: 'bg-rose-50 text-rose-700',
    meaning: 'IT가 진행하지 않기로 결정함',
    next: '— (사유 확인 후 재요청 가능)',
    primary: { label: '재개', to: null, via: 'resume' },
  },
  취소: {
    // 스스로 거둔 것이라 조용해도 된다.
    style: 'bg-slate-100 text-slate-500',
    meaning: '요청한 브랜드가 철회함',
    next: '—',
    primary: { label: '재개', to: null, via: 'resume' },
  },
  중복: {
    style: 'bg-slate-100 text-slate-400 line-through',
    meaning: '다른 요구사항에 병합됨',
    next: '—',
    // 서버가 병합된 건의 상태 변경을 막는다(status/route.js). 버튼을 주면
    // 눌렀을 때 400 이 난다.
    primary: null,
  },
};

export const DEFAULT_STATUS_STYLE = 'bg-slate-100 text-slate-600';

export function statusStyle(status) {
  return STATUS_META[status]?.style ?? DEFAULT_STATUS_STYLE;
}

// 가이드 화면이 렌더할 순서 있는 목록.
export const STATUS_GUIDE = REQUIREMENT_STATUSES.map((status) => ({
  status,
  ...STATUS_META[status],
}));
