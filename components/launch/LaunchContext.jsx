'use client';

import { useState } from 'react';

// 런칭의 전제.
//
// 00_개요 의 [제반사항] 7줄이다. 451건이 왜 그렇게 생겼는지의 답이 여기
// 있다 — 반년 뒤에 "왜 회원 연동을 안 했지"를 항목에서 찾을 수는 없다.
//
// 기본은 접혀 있다. 매일 볼 것은 아니지만 찾을 때 반드시 있어야 하는 것이다.
//
// 엑셀은 초안일 뿐이다 — 시트가 못 담은 것, 회의 중에 바뀐 것을 사람이
// 직접 고칠 자리가 있어야 한다. 그래서 읽기 전용이 아니라 onEdit 을 받는다.
//
// props: context [{label, value}], onEdit
export function LaunchContext({ context = [], onEdit }) {
  const [open, setOpen] = useState(false);
  const list = context ?? [];

  // 전제가 아직 없어도 처음 적을 자리는 있어야 한다 — 엑셀을 아직 안
  // 올렸거나 [제반사항] 이 비어 있던 런칭이 그렇다.
  if (list.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-slate-400 hover:text-indigo-600"
        >
          ＋ 전제 적기
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex w-full items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
          <span className="text-sm font-medium text-slate-800">전제</span>
          <span className="text-xs text-slate-400">{list.length}줄</span>
          {!open && (
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {list.map((c) => c.label).join(' · ')}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-xs text-slate-400 hover:text-indigo-600"
        >
          고치기
        </button>
      </div>

      {open && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
          {list.map((c, i) => (
            <div key={`${c.label}-${i}`} className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-slate-500">{c.label}</dt>
              <dd className="min-w-0 flex-1 text-[13px] text-slate-700">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
