'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { isGlobalAdmin } from '@/lib/tiers';
import { splitCategories } from '@/lib/categories';

// props: categories(sort_order 오름차순 정렬됨), identity, onChanged()
export function CategorySettings({ categories, identity, onChanged }) {
  const [newName, setNewName] = useState('');
  const [newIsCommon, setNewIsCommon] = useState(false);
  const [error, setError] = useState('');

  // 공통 카테고리(brand_id is null)는 모든 브랜드에 나타난다. 2차 관리자가
  // 지우면 다른 브랜드까지 영향을 받으므로 전체관리자만 만들고 고칠 수 있다.
  const globalAdmin = isGlobalAdmin(identity);
  const { own, common } = splitCategories(categories);

  async function addCategory(event) {
    event.preventDefault();
    if (!newName.trim()) return;
    setError('');
    const res = await fetch('/api/brand-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: identity.brandId,
        categoryName: newName,
        isCommon: globalAdmin && newIsCommon,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '추가 실패');
      return;
    }
    setNewName('');
    setNewIsCommon(false);
    onChanged();
  }

  async function removeCategory(id) {
    setError('');
    const res = await fetch(
      `/api/brand-categories/${id}?brandId=${identity.brandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '삭제 실패');
      return;
    }
    onChanged();
  }

  // 순서 바꾸기는 이웃끼리 sort_order 를 맞바꾼다. list 는 한 묶음(브랜드
  // 고유 또는 공통)만 담고 있어야 경계를 넘어가지 않는다.
  async function move(list, index, direction) {
    const other = list[index + direction];
    const current = list[index];
    if (!other) return;
    setError('');
    const [resA, resB] = await Promise.all([
      fetch(`/api/brand-categories/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: identity.brandId, sortOrder: other.sort_order }),
      }),
      fetch(`/api/brand-categories/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: identity.brandId, sortOrder: current.sort_order }),
      }),
    ]);
    if (!resA.ok || !resB.ok) {
      setError('순서 변경 실패');
    }
    onChanged();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-slate-700">카테고리</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <CategoryGroup list={own} editable onMove={move} onRemove={removeCategory} />

      {common.length > 0 && (
        <>
          <p className="mt-2 text-xs text-slate-500">
            공통 카테고리 — 모든 브랜드에서 함께 쓴다.
            {!globalAdmin && ' 전체 관리자만 고칠 수 있다.'}
          </p>
          <CategoryGroup
            list={common}
            editable={globalAdmin}
            onMove={move}
            onRemove={removeCategory}
          />
        </>
      )}

      <form onSubmit={addCategory} className="mt-2 flex flex-col gap-2">
        <div className="flex gap-2">
          <Input placeholder="새 카테고리" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
            추가
          </button>
        </div>
        {globalAdmin && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={newIsCommon}
              onChange={(e) => setNewIsCommon(e.target.checked)}
            />
            공통 카테고리로 만들기 (모든 브랜드에 나타난다)
          </label>
        )}
      </form>
    </section>
  );
}

// props: list(한 묶음), editable(순서·삭제 버튼을 보일지), onMove(list, i, dir), onRemove(id)
function CategoryGroup({ list, editable, onMove, onRemove }) {
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {list.map((c, i) => (
        <li
          key={c.id}
          className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5"
        >
          <span className="flex items-center gap-2">
            {c.category_name}
            {c.isCommon && (
              <Badge className="bg-slate-100 text-slate-500">공통</Badge>
            )}
          </span>
          {editable && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onMove(list, i, -1)}
                className="text-slate-500 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === list.length - 1}
                onClick={() => onMove(list, i, 1)}
                className="text-slate-500 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="text-rose-600 hover:underline"
              >
                삭제
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
