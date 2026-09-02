'use client';

import { useMemo, useState } from 'react';

// 런칭 가이드 — 브랜드와 무관한 지식.
//
// 오픈일도 D-N 도 진척률도 없다. 브랜드가 없으니 있을 수가 없다.
//
// 이 화면은 훑는 목록이 아니라 찾아 들어가는 문서다. 403건이라 검색이
// 없으면 못 쓴다.
//
// props: guide, items, roles
export function GuideView({ guide, items = [], roles = [] }) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState(() => new Set());
  const [showRoles, setShowRoles] = useState(false);

  const hits = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    // 코드·제목·비고·산출물·역할을 한 덩어리로 본다. 어느 칸에 있는지
    // 기억하고 찾는 사람은 없다.
    return items.filter((i) =>
      [i.code, i.title, i.note, i.deliverable, i.owner_role, i.support_role, i.category]
        .filter(Boolean)
        .join(' ')
        .includes(q),
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of hits) {
      if (!map.has(item.workstream)) map.set(item.workstream, []);
      map.get(item.workstream).push(item);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [hits]);

  function toggle(ws) {
    setClosed((prev) => {
      const next = new Set(prev);
      next.has(ws) ? next.delete(ws) : next.add(ws);
      return next;
    });
  }

  const criticalCount = items.filter((i) => i.is_critical).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="항목·산출물·역할로 찾기 (예: 상표, 네이버, 법무)"
            className="h-9 w-full max-w-sm rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <p className="text-xs text-slate-500">
          {query.trim() ? (
            <>
              <span className="tabular-nums">{hits.length}</span>건 찾음 · 전체{' '}
              <span className="tabular-nums">{items.length}</span>
            </>
          ) : (
            <>
              항목 <span className="tabular-nums">{items.length}</span> · 워크스트림{' '}
              <span className="tabular-nums">{groups.length}</span> · ★{' '}
              <span className="tabular-nums">{criticalCount}</span>
            </>
          )}
        </p>
      </div>

      {roles.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowRoles((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className={`text-[10px] text-slate-400 ${showRoles ? 'rotate-90' : ''}`}>▶</span>
            <span className="text-sm font-medium text-slate-900">역할 사전</span>
            <span className="text-xs text-slate-400">
              {roles.length}종 — 누가 무엇을 맡는지
            </span>
          </button>
          {showRoles && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {roles.map((role) => (
                <li key={role.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                  <span className="shrink-0 sm:w-32">
                    <span className="text-sm font-medium text-slate-900">{role.name}</span>
                    {role.org && <span className="ml-1.5 text-xs text-slate-400">{role.org}</span>}
                  </span>
                  <span className="flex-1 text-sm break-keep text-slate-600">
                    {role.scope_text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {groups.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
          {items.length === 0
            ? '아직 항목이 없습니다. 엑셀에서 가져오세요.'
            : '찾는 항목이 없습니다.'}
        </p>
      )}

      {groups.map(([workstream, list]) => {
        const open = query.trim() ? true : !closed.has(workstream);
        return (
          <section key={workstream} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggle(workstream)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className={`text-[10px] text-slate-400 ${open ? 'rotate-90' : ''}`}>▶</span>
              <span className="text-sm font-medium text-slate-900">{workstream}</span>
              <span className="ml-auto text-xs tabular-nums text-slate-400">
                {list.length}개 항목
              </span>
            </button>

            {open && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {list.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <p className="flex flex-wrap items-baseline gap-1.5 text-sm text-slate-900">
                      {item.is_critical && (
                        <span className="rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">
                          ★
                        </span>
                      )}
                      <span className="text-[11px] tabular-nums text-slate-400">{item.code}</span>
                      <span className="min-w-0 break-keep">{item.title}</span>
                    </p>

                    {/* 비고가 '왜 이것이 필요한가'다. 시트에 이미 다 적혀
                        있어서 그대로 쓴다. */}
                    {item.note && (
                      <p className="mt-1 max-w-[72ch] text-[13px] break-keep text-slate-600">
                        {item.note}
                      </p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-400">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-600">
                        권장 D{item.day_offset}
                      </span>
                      {item.owner_role && (
                        <span>
                          {item.owner_role}
                          {item.support_role ? ` · 지원 ${item.support_role}` : ''}
                        </span>
                      )}
                      {item.decision_org && <span>· 결정 {item.decision_org}</span>}
                      {item.channel && item.channel !== '공통' && <span>· {item.channel}</span>}
                      {item.deliverable && <span>· {item.deliverable}</span>}
                      {item.depends_on?.length > 0 && (
                        <span className="tabular-nums">· 선행 {item.depends_on.join(', ')}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {guide?.source_version && (
        <p className="text-xs text-slate-400">
          출처 {guide.source_version}
          {guide.updated_at ? ` · ${String(guide.updated_at).slice(0, 10)} 가져옴` : ''}
        </p>
      )}
    </div>
  );
}
