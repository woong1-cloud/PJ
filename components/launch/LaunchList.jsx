'use client';

import Link from 'next/link';
import { dDay, dDayLabel } from '@/lib/launchDate';
import { todayInKst } from '@/lib/overdue';

// 런칭 목록.
//
// 한 줄이 답해야 하는 것은 둘이다 — 언제 여는가, 얼마나 됐는가.
// 지금은 한 건이겠지만 목록으로 두는 이유는 끝난 런칭이 여기 남기 때문이다.
// 가이드가 자라는 근거가 이 목록이다.
//
// props: launches, onOpenNew
export function LaunchList({ launches = [], onOpenNew }) {
  // 오늘은 한 번만 정해 모든 줄에 같은 것을 쓴다. 줄마다 새로 부르면
  // 자정을 넘기는 순간 목록 안에서 기준이 갈린다.
  const today = todayInKst();

  if (launches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-600">아직 런칭이 없습니다.</p>
        <p className="mt-1 text-xs text-slate-400">
          가이드에서 항목을 복사해 시작합니다. 브랜드명과 오픈일만 있으면 됩니다.
        </p>
        <button
          type="button"
          onClick={onOpenNew}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          ＋ 런칭 만들기
        </button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {launches.map((launch) => (
        <li key={launch.id}>
          <LaunchRow launch={launch} today={today} />
        </li>
      ))}
    </ul>
  );
}

function LaunchRow({ launch, today }) {
  const days = dDay(launch.open_date, today);
  const total = launch.taskCount ?? 0;
  const done = launch.doneCount ?? 0;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  // 오픈이 지났으면 D+ 가 뜬다. 그것을 남겨 둔다 — 오픈했는데 안 닫힌
  // 런칭이 목록에 몇 달씩 떠 있는 것을 보이게 하는 것이 목적이다.
  const closed = launch.status === '완료' || launch.status === '중단';

  return (
    <Link
      href={`/launch/${launch.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-semibold text-slate-900">{launch.name}</span>
          {launch.kind && <span className="text-xs text-slate-400">{launch.kind}</span>}
          {closed && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
              {launch.status}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
          오픈 {launch.open_date}
          {!closed && days !== null && (
            <span className={days < 0 ? 'ml-2 text-rose-600' : 'ml-2 text-slate-600'}>
              {dDayLabel(days)}
            </span>
          )}
        </p>
      </div>

      <div className="flex w-40 shrink-0 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${percent}%` }}
            aria-hidden
          />
        </div>
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500">
          {done}/{total}
        </span>
      </div>
    </Link>
  );
}
