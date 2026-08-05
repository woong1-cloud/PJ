'use client';

// 지금 걸려 있는 필터를 칩으로 보여주고, 하나씩 뗄 수 있게 한다.
//
// '필터 더보기 (2)' 와 모바일의 '필터 3' 배지는 몇 개인지만 알려준다. 담당자를
// 잘못 골라 놓고 접었다면 펼쳐서 셀렉트 넷을 훑어야 범인을 찾는다. 칩은 접힌
// 것까지 이름과 값으로 드러낸다.
//
// 걸린 것이 없으면 아무것도 그리지 않는다 — 평소 화면에 빈 줄을 남기지 않는다.
//
// 가로 스크롤인 이유: 모바일에서 칩이 넷 이상이면 줄바꿈이 일어나 세로를
// 두세 줄 먹는다. 목록이 주 화면인 앱에서 세로는 가장 비싼 자원이다.
export function ActiveFilterChips({ chips, onRemove }) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          aria-label={`${chip.label} 필터 해제`}
          className="flex shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="text-slate-400">{chip.label}</span>
          {/* valueLabel 이 없을 수 있다 — 담당자·카테고리·프로젝트는 값이
              uuid 라서 목록이 도착하기 전에는 읽을 이름이 없다. 그때는 이름만
              그린다. 무엇인지 몰라도 뗄 수는 있다. */}
          {chip.valueLabel && <span className="font-medium text-slate-700">{chip.valueLabel}</span>}
          <span aria-hidden="true" className="text-slate-400">
            ×
          </span>
        </button>
      ))}
    </div>
  );
}
