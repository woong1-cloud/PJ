'use client';

import { useEffect, useState } from 'react';
import { checklistProgress } from '@/lib/checklist';

// 하위 작업 체크리스트.
//
// 조회는 누구나(4차 포함), 추가·완료 표시·삭제는 3차 이상이다. 서버가 같은
// 규칙으로 다시 판정하므로(requirement_checklist_items 라우트), 여기서는
// 화면을 정직하게 그리는 것만 신경 쓴다 — canManage=false 인 사람에게
// 입력칸을 안 보여주면 그만이지, 서버를 다시 믿을 필요는 없다.
//
// props: requirementId, brandId, canManage
export function ChecklistSection({ requirementId, brandId, canManage }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  function load() {
    if (!requirementId || !brandId) return;
    fetch(`/api/requirements/${requirementId}/checklist?brandId=${brandId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '체크리스트를 불러오지 못했습니다.');
        setItems(d.items ?? []);
        setError('');
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [requirementId, brandId]);

  async function addItem(event) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`/api/requirements/${requirementId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, title: newTitle }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '추가에 실패했습니다.');
      setNewTitle('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggle(item) {
    // 낙관적으로 먼저 바꾼다. 체크박스는 누르는 즉시 반응해야 하는 컨트롤이라,
    // 응답을 기다리는 동안 그대로면 두 번 눌렀다고 오해한다. 실패하면 되돌린다.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)));
    const res = await fetch(`/api/requirements/${requirementId}/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, isDone: !item.is_done }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '변경에 실패했습니다.');
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_done: item.is_done } : i)));
    }
  }

  async function remove(item) {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await fetch(
      `/api/requirements/${requirementId}/checklist/${item.id}?brandId=${brandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '삭제에 실패했습니다.');
      setItems(before);
    }
  }

  // 항목이 없고 관리 권한도 없으면(4차가 열었는데 아직 아무것도 없는 경우)
  // 섹션 자체를 감춘다. 빈 상자와 "아직 없습니다" 문구만 있는 건 이 사람
  // 눈에는 소음이다 — 어차피 추가도 못 하니까.
  if (items.length === 0 && !canManage) return null;

  const { done, total } = checklistProgress(items);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">하위 작업</h2>
        {total > 0 && (
          <span className="text-xs text-slate-400">
            {done}/{total} 완료
          </span>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">아직 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.is_done}
                onChange={canManage ? () => toggle(item) : undefined}
                disabled={!canManage}
                className="h-4 w-4 shrink-0 accent-indigo-600"
              />
              <span className={item.is_done ? 'flex-1 text-slate-400 line-through' : 'flex-1 text-slate-700'}>
                {item.title}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                  aria-label={`${item.title} 삭제`}
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={addItem} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="하위 작업 추가"
            maxLength={200}
            className="h-8 flex-1 rounded-lg border border-slate-300 px-3 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="h-8 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            추가
          </button>
        </form>
      )}
    </section>
  );
}
