import Link from 'next/link';

// 대시보드 최상단 "손볼 것".
//
// 이 화면의 나머지는 집계다 — 몇 건인지 보여주지만 눌러서 갈 곳이 없다.
// 여기 있는 줄은 전부 관리자가 오늘 처리할 수 있는 것이어야 하고, 눌렀을 때
// 그 조건으로 걸러진 화면이 나와야 한다.
//
// 0인 항목은 lib/dashboardStats.js 의 computeActionItems 가 이미 걸러낸다.
// 여기서는 빈 배열일 때 무엇을 보여줄지만 정한다.

const SEVERITY_STYLE = {
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
};

export function DashboardActionItems({ items }) {
  const rows = items ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-base font-medium text-slate-900">손볼 것</h2>

      {/* 빈 화면은 "괜찮은 건지 안 불러와진 건지" 알 수 없다. 없으면 없다고 말한다. */}
      {rows.length === 0 ? (
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-400">
          지금 손볼 것이 없습니다.
        </p>
      ) : (
        <ul>
          {rows.map((item) => (
            <li key={item.key} className="border-t border-slate-100">
              <Link
                href={item.href}
                className="flex items-center gap-3 py-2.5 hover:bg-slate-50"
              >
                <span
                  className={`min-w-9 rounded-md px-2.5 py-0.5 text-center text-sm font-medium ${
                    SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.warning
                  }`}
                >
                  {item.count}
                </span>
                <span className="flex-1 text-sm text-slate-700 break-keep">
                  {item.label}
                  {/* 브랜드 이름은 세 개까지만. 그 이상이면 목록이 아니라 벽이 된다. */}
                  {item.names?.length > 0 && (
                    <span className="text-slate-400">
                      {' — '}
                      {item.names.slice(0, 3).join(', ')}
                      {item.names.length > 3 && ` 외 ${item.names.length - 3}`}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap text-xs text-indigo-600">보기 →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
