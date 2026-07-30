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
  },
  검토대기: {
    // 목록에서 유일하게 튀는 색. "지금 IT가 손대야 할 것"이 한눈에 보여야 한다.
    style: 'bg-amber-50 text-amber-700',
    meaning: '제출 완료, IT가 아직 보지 않음',
    next: 'IT — 검토 시작',
  },
  검토중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: 'IT가 검토하고 정책을 정하는 중',
    next: 'IT — 개발 착수',
  },
  개발중: {
    style: 'bg-indigo-50 text-indigo-700',
    meaning: '개발이 진행 중',
    next: 'IT — 완료 처리',
  },
  완료: {
    style: 'bg-emerald-50 text-emerald-700',
    meaning: '배포까지 끝남',
    next: '—',
  },
  반려: {
    // 색이 있어야 한다 — 거절당한 건은 요청자가 알아채야 한다.
    style: 'bg-rose-50 text-rose-700',
    meaning: 'IT가 진행하지 않기로 결정함',
    next: '— (사유 확인 후 재요청 가능)',
  },
  취소: {
    // 스스로 거둔 것이라 조용해도 된다.
    style: 'bg-slate-100 text-slate-500',
    meaning: '요청한 브랜드가 철회함',
    next: '—',
  },
  중복: {
    style: 'bg-slate-100 text-slate-400 line-through',
    meaning: '다른 요구사항에 병합됨',
    next: '—',
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
