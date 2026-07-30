'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { canProcess } from '@/lib/tiers';
import { buildRequirementsQuery } from '@/lib/requirementFilters';
import { KanbanBoard } from '@/components/KanbanBoard';
import { MergeDialog } from '@/components/MergeDialog';
import { FilterBar } from '@/components/FilterBar';
import { RequirementViewToggle } from '@/components/RequirementViewToggle';
import {
  useRequirementFilters,
  useRequirementFilterOptions,
} from '@/components/useRequirementFilters';

// useSearchParams 는 Suspense 경계 안에서 써야 한다 — 목록 페이지의 같은 주석 참조.
export default function BoardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">불러오는 중...</p>}>
      <BoardView />
    </Suspense>
  );
}

function BoardView() {
  const { identity } = useIdentity();
  const router = useRouter();
  const processAllowed = canProcess(identity);

  const [reqs, setReqs] = useState([]);
  const [error, setError] = useState('');
  const [mergeSource, setMergeSource] = useState(null);

  // 목록과 같은 URL 파라미터를 읽는다. 목록에서 필터를 걸고 보드로 넘어오면
  // 그대로 이어진다.
  const { filters, query, appliedQuery, setFilters, setQuery, resetFilters } =
    useRequirementFilters();
  const { teamMembers, categories, projects } = useRequirementFilterOptions(identity.brandId);

  useEffect(() => {
    if (!processAllowed) router.replace('/requirements');
  }, [processAllowed, router]);

  // forceIncludeDone 이 반드시 필요하다. 목록 API는 종결 건(완료·반려·취소·중복)을
  // 기본으로 숨기는데, 보드에는 '완료' 컬럼이 있다. 빼먹으면 그 컬럼이 통째로
  // 비어 보인다. URL 의 includeDone 값은 여기서 일부러 무시한다 — 보드는 항상
  // 종결 건을 받아야 하고, 그래서 '종결 숨김' 체크박스도 보드에서는 감춘다.
  const apiQuery = buildRequirementsQuery({
    brandId: identity.brandId,
    filters,
    query: appliedQuery,
    forceIncludeDone: true,
  });

  const load = useCallback(() => {
    fetch(`/api/requirements?${apiQuery}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '불러오지 못했습니다.');
        setReqs(d.requirements ?? []);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [apiQuery]);

  useEffect(() => {
    if (!processAllowed) return;
    load();
  }, [processAllowed, load]);

  async function handleStatusChange(card, newStatus) {
    const prevStatus = card.status;
    setReqs((prev) => prev.map((r) => (r.id === card.id ? { ...r, status: newStatus } : r)));

    const res = await fetch(`/api/requirements/${card.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: card.brand_id ?? identity.brandId, status: newStatus }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '상태 변경 실패');
      setReqs((prev) => prev.map((r) => (r.id === card.id ? { ...r, status: prevStatus } : r)));
    }
  }

  if (!processAllowed) {
    return <p className="text-sm text-slate-500">권한이 없습니다. 목록으로 이동합니다...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">요구사항 보드</h1>
        <RequirementViewToggle current="board" />
      </div>

      <FilterBar
        teamMembers={teamMembers}
        categories={categories}
        projects={projects}
        value={filters}
        onChange={setFilters}
        query={query}
        onQueryChange={setQuery}
        onReset={resetFilters}
        showIncludeDone={false}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <KanbanBoard requirements={reqs} onStatusChange={handleStatusChange} onMerge={setMergeSource} />
      {mergeSource && (
        <MergeDialog
          source={mergeSource}
          onClose={() => setMergeSource(null)}
          onMerged={() => {
            setMergeSource(null);
            load();
          }}
        />
      )}
    </div>
  );
}
