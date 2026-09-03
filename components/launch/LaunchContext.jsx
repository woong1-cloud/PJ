'use client';

import { useState } from 'react';

// 런칭의 전제.
//
// 00_개요 의 [제반사항] 7줄이다. 451건이 왜 그렇게 생겼는지의 답이 여기
// 있다 — 반년 뒤에 "왜 회원 연동을 안 했지"를 항목에서 찾을 수는 없다.
//
// 기본은 접혀 있다. 매일 볼 것은 아니지만 찾을 때 반드시 있어야 하는 것이다.
//
// props: context [{label, value}]
export function LaunchContext({ context = [] }) {
  const [open, setOpen] = useState(false);
  if (!context || context.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
        <span className="text-sm font-medium text-slate-800">전제</span>
        <span className="text-xs text-slate-400">{context.length}줄</span>
        {!open && (
          <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
            {context.map((c) => c.label).join(' · ')}
          </span>
        )}
      </button>

      {open && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
          {context.map((c) => (
            <div key={c.label} className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-slate-500">{c.label}</dt>
              <dd className="min-w-0 flex-1 text-[13px] text-slate-700">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
