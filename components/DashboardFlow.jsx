import { MIN_COMPLETED_FOR_AVG } from '@/lib/dashboardStats';

// 상태별 건수 막대 — "지금 어디에 있나".
//
// 가장 높은 칸이 병목이다. 지금은 검토대기가 그렇고, 브랜드가 늘고 건수가
// 쌓이면 이 그림이 매번 자동으로 병목을 가리킨다. 숫자 표로 만들면 그 사실을
// 사람이 읽어서 찾아내야 한다.
//
// 막대 최대 높이. 값이 0이어도 칸이 있다는 것은 보여야 해서 최소 3px 을 둔다.
const MAX_H = 56;
const MIN_H = 3;

export function DashboardFlow({ flow, completedCount }) {
  const bars = flow ?? [];
  const max = Math.max(...bars.map((b) => b.count), 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-medium text-slate-900">지금 어디에 있나</h2>

      <div className="flex h-20 items-end gap-1.5">
        {bars.map((bar) => (
          <div key={bar.status} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`text-xs ${
                bar.isPeak ? 'font-medium text-amber-700' : 'text-slate-400'
              }`}
            >
              {bar.count}
            </span>
            <span
              className={`w-full rounded-t ${bar.isPeak ? 'bg-amber-400' : 'bg-slate-200'}`}
              style={{ height: max > 0 ? Math.max((bar.count / max) * MAX_H, MIN_H) : MIN_H }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {bars.map((bar) => (
          <span
            key={bar.status}
            className={`flex-1 truncate text-center text-[11px] ${
              bar.isPeak ? 'text-amber-700' : 'text-slate-400'
            }`}
          >
            {bar.status}
          </span>
        ))}
      </div>

      {/* 완료가 적을 때 평균을 '—' 로 두면 사용자는 고장난 줄 안다. 아예 숨기면
          그런 지표가 있는 줄도 모른다. 언제 나타나는지 말해 주는 쪽으로 간다. */}
      {completedCount < MIN_COMPLETED_FOR_AVG && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
          평균 처리 기간은 완료 {MIN_COMPLETED_FOR_AVG}건부터 표시됩니다
          {completedCount > 0 && ` (지금 ${completedCount}건)`}.
        </p>
      )}
    </section>
  );
}
