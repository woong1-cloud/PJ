// 브랜드 도입 현황.
//
// 예전 화면은 브랜드마다 카드를 한 장씩 놓고 미완료·신규·완료·평균을 보여줬다.
// 브랜드 하나만 쓰고 나머지가 0인 지금은 그게 "0이 네 줄"로만 읽힌다.
//
// 여기서 답하는 질문은 하나다: 멀티브랜드 툴인데 몇 개 브랜드가 실제로 도는가.
//
// 단계를 셋으로 나누는 이유는 처방이 다르기 때문이다. '배치만 됨'은 계정이
// 있는데 안 쓰는 것이라 독려가 필요하고, '시작 안 함'은 아무도 들어올 수 없는
// 것이라 계정 발급이 필요하다.

const BAR = {
  active: { width: '100%', className: 'bg-emerald-500' },
  assigned: { width: '18%', className: 'bg-amber-400' },
  empty: { width: '0%', className: '' },
};

export function DashboardAdoption({ rows }) {
  const list = rows ?? [];
  if (list.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-medium text-slate-900">브랜드 도입</h2>
        <p className="mt-2 text-sm text-slate-500">등록된 브랜드가 없습니다.</p>
      </section>
    );
  }

  const activeCount = list.filter((r) => r.level === 'active').length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-medium text-slate-900">브랜드 도입</h2>
        <p className="text-sm text-slate-500">
          {list.length}개 중 {activeCount}개 사용 중
        </p>
      </div>

      <ul>
        {list.map((row) => {
          const bar = BAR[row.level];
          return (
            <li
              key={row.brandId}
              className="flex items-center gap-2.5 border-t border-slate-100 py-2"
            >
              <span className="w-20 shrink-0 truncate text-sm text-slate-700">
                {row.brandName}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                {bar.width !== '0%' && (
                  <span
                    className={`block h-full ${bar.className}`}
                    style={{ width: bar.width }}
                  />
                )}
              </span>
              {/* 시작조차 안 한 브랜드만 색으로 구분한다. 셋 다 색을 주면
                  어느 것이 급한지 알 수 없다. */}
              <span
                className={`w-24 shrink-0 text-right text-xs ${
                  row.level === 'empty' ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                {row.requirementCount}건 · {row.memberCount}명
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
