'use client';

import { useEffect, useState } from 'react';

// 도움말 목차.
//
// 데스크톱은 왼쪽에 붙어 따라오고, 모바일은 제목 아래 가로 스크롤 한 줄이다.
// 세 섹션일 때는 없어도 되지만, 여섯 개가 되는 순간 목차 없는 도움말은
// 스크롤로 찾는 문서가 된다 — 그때 만들면 이미 늦다.
//
// 지금 보고 있는 섹션을 표시한다. 긴 문서에서 "내가 어디쯤인지" 가 없으면
// 목차는 링크 묶음일 뿐이다.
export function HelpToc({ sections }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    const targets = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // 여러 섹션이 동시에 걸쳐 있으면 가장 위를 현재로 본다. 마지막 것을
        // 쓰면 스크롤을 조금만 내려도 아래 섹션이 켜져서 표시가 앞서 나간다.
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        );
        setActive(topMost.target.id);
      },
      // 화면 위쪽 10%~30% 구간에 들어온 것만 '보고 있는 것'으로 친다. 전체를
      // 기준으로 하면 짧은 섹션이 화면에 걸치기만 해도 켜진다.
      { rootMargin: '-10% 0px -70% 0px' }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="도움말 목차" className="lg:sticky lg:top-4 lg:w-52 lg:shrink-0">
      {/* 모바일: 가로 한 줄. 세로를 쓰지 않는다. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active === s.id
                ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {s.title}
          </a>
        ))}
      </div>

      {/* 데스크톱: 왼쪽 세로 목록. 요약까지 보여 준다 — 자리가 있고, 제목만으로는
          '권한 등급' 이 무엇을 알려주는 칸인지 짐작이 안 된다. */}
      <ul className="hidden flex-col gap-0.5 lg:flex">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`block rounded-md border-l-2 py-1.5 pl-3 transition-colors ${
                active === s.id
                  ? 'border-indigo-500 bg-indigo-50/60'
                  : 'border-transparent hover:bg-slate-100'
              }`}
            >
              <span
                className={`block text-sm ${
                  active === s.id ? 'font-medium text-indigo-700' : 'text-slate-700'
                }`}
              >
                {s.title}
              </span>
              <span className="mt-0.5 block text-xs break-keep text-slate-400">{s.summary}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
