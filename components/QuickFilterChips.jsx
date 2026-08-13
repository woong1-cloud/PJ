'use client';

// 빠른 필터 칩 줄.
//
// 칩은 하나만 켜진다. 켜진 칩을 다시 누르면 전체로 돌아간다.
// 왜 라디오인지, 어떤 칩이 누구에게 가는지는 lib/quickFilters.js 참조.
//
// 0건인 칩은 흐리게 두되 없애지는 않는다. 사라지면 "어제 있던 칩이 왜 없지"가
// 되고, 무엇보다 '지연 0' 은 그 자체로 좋은 소식이라 보여줄 값어치가 있다.
export function QuickFilterChips({ chips, counts, activeKey, onPick }) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
      {chips.map((chip) => {
        const count = counts?.[chip.key];
        const active = activeKey === chip.key;
        const empty = count === 0;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onPick(chip.key)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-700'
                : empty
                  ? 'border-slate-200 bg-white text-slate-400'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {chip.label}
            {/* 개수는 아직 안 왔을 수 있다(첫 렌더). 그때는 숫자 자리를 비워
                둔다 — 0 을 먼저 보여주면 잠깐이지만 "없다"고 읽힌다. */}
            {typeof count === 'number' && (
              <span className={active ? 'text-indigo-500' : 'text-slate-400'}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
