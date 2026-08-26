'use client';

import { BOARD_STATUSES } from '@/lib/statuses';

// 진행 스트립. 지난 구간은 소요일과 함께, 현재는 강조, 앞으로는 흐리게.
//
// durations 는 상세 API 가 내려주는 statusDurations 다(computeStatusDurations).
// 새로 계산하지 않는다 — 같은 값을 두 곳에서 만들면 언젠가 갈린다.
//
// 이 정보는 지금도 화면에 있다. 다만 세로 목록으로 페이지 한참 아래에 있어서
// "이 건이 어디서 얼마나 멎었나"를 보려면 스크롤을 내려야 했다.
//
// props:
//   durations — [{ status, days, ongoing }]. status 가 null 이면 구간 불명.
//   current — 지금 상태
export function StatusStrip({ durations = [], current }) {
  // 구간을 상태별 소요일로 접는다. 같은 상태를 여러 번 오간 건은 합쳐서
  // 보여준다 — 스트립은 흐름을 말하는 자리이지 이력을 말하는 자리가 아니다.
  // 이력은 아래 활동 피드가 시간순으로 그대로 보여준다.
  const spent = new Map();
  let unknown = 0;
  for (const d of durations ?? []) {
    if (!d?.status) {
      unknown += d?.days ?? 0;
      continue;
    }
    spent.set(d.status, (spent.get(d.status) ?? 0) + (d.days ?? 0));
  }

  // 보드 밖 상태(반려·취소·중복)는 스트립에 자리가 없다. 그 건은 흐름에서
  // 벗어난 것이고, 머리 줄이 이미 그렇게 말한다.
  const onBoard = BOARD_STATUSES.includes(current);

  return (
    <div className="flex items-center gap-1 overflow-x-auto text-xs">
      {BOARD_STATUSES.map((status, i) => {
        const days = spent.get(status);
        const isCurrent = onBoard && status === current;
        const isPast = days !== undefined && !isCurrent;
        return (
          <span key={status} className="flex shrink-0 items-center gap-1">
            {i > 0 && (
              <span className="text-slate-300" aria-hidden="true">
                ›
              </span>
            )}
            <span
              className={`rounded px-2 py-0.5 ${
                isCurrent
                  ? 'bg-amber-100 font-medium text-amber-700'
                  : isPast
                    ? 'bg-slate-100 text-slate-600'
                    : 'text-slate-400'
              }`}
            >
              {status}
              {days !== undefined && (
                <span className="ml-1">{days === 0 ? '오늘' : `${days}일`}</span>
              )}
            </span>
          </span>
        );
      })}
      {/* 구간 불명을 지우지 않는다. computeStatusDurations 가 status:null 을
          돌려주는 것은 "이 시간에 무슨 상태였는지 믿을 수 없다"는 뜻이고,
          화면이 임의로 메우면 그 정직함이 사라진다. */}
      {unknown > 0 && (
        <span className="ml-2 shrink-0 text-slate-400">구간 불명 {unknown}일</span>
      )}
    </div>
  );
}
