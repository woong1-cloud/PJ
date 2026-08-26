'use client';

import { useState } from 'react';

// 오른쪽 열의 한 덩어리. 제목 · 개수 · 내용 · 접히는 추가 폼.
//
// 카드(border + bg-white + p-4)를 쓰지 않는다. 본문에서 As-Is·To-Be 카드를
// 걷어내면서 문서 한 장으로 만들었는데, 오른쪽 열만 카드로 남으면 한 화면에
// 두 언어가 섞인다. 실제로 배포 후 그렇게 보였다.
//
// 추가 폼을 접는 이유: 하위 작업은 0건, 연결은 1건이다. 대부분의 화면에서
// 입력칸이 늘 펼쳐져 있으면 그만큼이 빈 자리가 된다.
//
// props: title, count, addLabel, children, form
export function SidebarBlock({ title, count, addLabel = '＋ 추가', children, form }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="border-t border-slate-200 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
          {title}
        </p>
        {count != null && <span className="text-[11px] text-slate-400">{count}</span>}
      </div>

      {children}

      {form && (
        <>
          {adding ? (
            <div className="mt-2">{form({ close: () => setAdding(false) })}</div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-1.5 text-xs text-indigo-600 hover:underline"
            >
              {addLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
