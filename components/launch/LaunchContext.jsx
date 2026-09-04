'use client';

// 런칭의 전제.
//
// 00_개요 의 [제반사항] 7줄이다. 451건이 왜 그렇게 생겼는지의 답이 여기
// 있다 — 반년 뒤에 "왜 회원 연동을 안 했지"를 항목에서 찾을 수는 없다.
//
// 예전에는 이 컴포넌트 하나가 접기/펴기 상자 전체였다. 이제는 제목 줄이
// 여섯 줄에서 세 줄로 줄며 전제도 제목 줄의 단추 하나로 옮겨야 해서, 단추
// (LaunchContextButton· 열림 여부는 부모가 쥔다)와 펼친 내용(LaunchContextPanel)
// 을 나눈다 — 부모가 열림 상태 하나로 둘을 같이 움직여야 하기 때문이다.
//
// 엑셀은 초안일 뿐이다 — 시트가 못 담은 것, 회의 중에 바뀐 것을 사람이
// 직접 고칠 자리가 있어야 한다. 그래서 고치기는 항상 onEdit 으로 연다.

// 제목 줄에 붙는 단추. 전제가 없으면 '+ 전제' 로 곧장 고치기 창을 연다 —
// 아직 아무것도 없는데 펼쳐봤자 빈 상자만 보인다.
export function LaunchContextButton({ context = [], open, onToggle, onAdd }) {
  const list = context ?? [];

  if (list.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
      >
        ＋ 전제
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
        open
          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      전제 <span className="tabular-nums">{list.length}</span>
    </button>
  );
}

// 펼친 내용. 제목 줄 바로 아래, 전제 단추가 열려 있을 때만 부모가 그린다.
//
// 2단 그리드로 짧게 — 한 줄씩 늘어놓으면(예전 모양) 7줄이 세로로 길어져
// 세 줄로 줄인 제목 영역의 뜻이 없어진다.
export function LaunchContextPanel({ context = [], onEdit }) {
  const list = context ?? [];
  if (list.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">전제</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-slate-400 hover:text-indigo-600"
        >
          고치기
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {list.map((c, i) => (
          <div key={`${c.label}-${i}`} className="flex gap-3">
            <dt className="w-24 shrink-0 text-xs text-slate-500">{c.label}</dt>
            <dd className="min-w-0 flex-1 text-[13px] text-slate-700">{c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
