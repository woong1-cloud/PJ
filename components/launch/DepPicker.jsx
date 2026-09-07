'use client';

import { useState } from 'react';
import { byCode, depCandidates } from '@/lib/launchDeps';
import { dueDate } from '@/lib/launchDate';
import { isDone } from '@/lib/launchTask';

// 선행조건을 찾아서 고른다.
//
// 쉼표로 코드를 치던 칸을 대신한다. 501건에서 코드를 외워 치는 것은
// 애초에 무리라, 실제로 세 종류의 흠이 그렇게 쌓였다:
//
//   · 07-33 이 자기 자신을 선행으로 가짐 → 셋이 영영 '착수 가능' 밖
//   · 목록에 없는 코드 4건
//   · 방향이 거꾸로 걸린 것 7건
//
// 앞의 둘은 여기서 원천 봉쇄된다(고를 수 없는 것은 못 고른다). 셋째는
// 고르는 순간 뜨는 기한 경고가 잡는다.
//
// 찾는 규칙은 lib/launchSearch.js 하나다 — 보드·가이드와 같은 함수라
// 코드를 아는 사람이 '01-05' 라고 쳐도 그대로 찾힌다. 손으로 치던
// 방식을 잃지 않는 것이 요점이다.
//
// props: code(고치는 항목의 코드, 만들기면 없음), value(코드 배열),
//        tasks, openDate, onChange(코드 배열)
export function DepPicker({ id, code, value = [], tasks = [], openDate, onChange }) {
  const [query, setQuery] = useState('');
  const index = byCode(tasks);
  const { hits, total } = depCandidates({ code, tasks, chosen: value, query });

  function add(next) {
    if (value.includes(next)) return;
    onChange([...value, next]);
    // 하나 고르면 검색어를 비운다 — 둘째를 고를 때 첫째의 검색어가
    // 남아 있으면 "왜 아무것도 안 나오지"가 된다.
    setQuery('');
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-2">
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-slate-400">아직 없습니다 — 아래에서 찾아 고르세요</span>
        ) : (
          value.map((c) => {
            const found = index.get(c);
            return (
              <span
                key={c}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-2.5 pr-1 text-xs ${
                  found
                    ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                    : // 예전에 손으로 친 코드가 목록에 없을 수 있다. 조용히
                      // 지우지 않는다 — 지우면 사람이 모르는 사이에 연결이 사라진다.
                      'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <span className="shrink-0 tabular-nums opacity-70">{c}</span>
                <span className="min-w-0 truncate">
                  {found ? found.title : '이 런칭에 없는 코드'}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== c))}
                  aria-label={`선행 ${c} 빼기`}
                  className="shrink-0 px-0.5 leading-none opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            );
          })
        )}
      </div>

      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목이나 코드로 찾기 — 예: 통신판매, 01-05"
        aria-label="선행조건 찾기"
        className="h-8 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] focus:border-indigo-400 focus:outline-none"
      />

      <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-100">
        {hits.length === 0 ? (
          <p className="px-2.5 py-2.5 text-xs text-slate-400">
            {total === 0 && query ? '찾는 항목이 없습니다.' : '고를 수 있는 항목이 없습니다.'}
          </p>
        ) : (
          <>
            {hits.map((t) => (
              <button
                key={t.code}
                type="button"
                onClick={() => add(t.code)}
                className="flex w-full items-start gap-2 border-b border-slate-50 px-2.5 py-1.5 text-left last:border-b-0 hover:bg-indigo-50"
              >
                <span className="w-14 shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">
                  {t.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-slate-700">{t.title}</span>
                  <span className="block text-[11px] text-slate-400">
                    {t.owner_role}
                    {openDate && ` · ${dueDate(openDate, t.day_offset)}`}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                    isDone(t) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.status}
                </span>
              </button>
            ))}
            {total > hits.length && (
              <p className="bg-slate-50 px-2.5 py-1 text-[11px] text-slate-400">
                … 그 밖 {total - hits.length}건 — 더 좁혀 보세요
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
