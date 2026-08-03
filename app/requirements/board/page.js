'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { canProcess } from '@/lib/tiers';
import { buildRequirementsQuery } from '@/lib/requirementFilters';
import { DONE_STATUS, REVIEW_IN_PROGRESS_STATUS, REVIEW_PENDING_STATUS } from '@/lib/statuses';
import { KanbanBoard } from '@/components/KanbanBoard';
import { MergeDialog } from '@/components/MergeDialog';
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { StartReviewDialog } from '@/components/StartReviewDialog';
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
  // 완료로 드래그된 카드. 승인 창이 이 값을 보고 열린다.
  const [approvalTarget, setApprovalTarget] = useState(null);
  // 검토대기 → 검토중 으로 드래그된 카드. 착수 창이 이 값을 보고 열린다.
  const [startTarget, setStartTarget] = useState(null);

  // 목록과 같은 URL 파라미터를 읽는다. 목록에서 필터를 걸고 보드로 넘어오면
  // 그대로 이어진다.
  const { filters, query, appliedQuery, mine, setFilters, setQuery, setMine, resetFilters } =
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
    // 목록에서 '내 요청만'을 켜고 보드로 넘어오면 그대로 이어진다. 읽고도
    // 적용하지 않으면 URL 에는 켜져 있는데 화면은 전체를 보여준다.
    mine,
    memberId: identity.memberId,
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
    // 완료만 다르게 다룬다. 카드를 먼저 옮겨 놓고 창을 닫으면 되돌리는 순간이
    // 깜빡여서 승인이 된 건지 만 건지 헷갈린다. 이 전환만 "성공한 뒤에
    // 움직인다" — 낙관적 갱신을 하지 않는 유일한 경우다.
    if (newStatus === DONE_STATUS) {
      // 담당자 본인이면 창을 띄우지 않는다. 적게 한 다음 거절하는 것은 시간
      // 낭비다. 서버도 같은 판정을 다시 하므로 여기는 안내일 뿐이다.
      if (card.assignee?.id && card.assignee.id === identity.memberId) {
        setError(
          '담당자 본인은 승인할 수 없습니다. 브랜드 또는 본부의 다른 분께 확인을 요청해 주세요.'
        );
        return;
      }
      setError('');
      setApprovalTarget(card);
      return;
    }

    // 검토대기 → 검토중 은 IT가 그 건을 처음 손대는 순간이다. 담당자·예상일을
    // 여기서 받지 않으면 아무도 나중에 채우지 않는다(배포 후 8/8 이 비어 있었다).
    // 완료와 달리 낙관적 이동을 막지 않아도 되지만, 창을 먼저 띄우는 편이
    // "옮겼는데 창이 뜬다"보다 자연스럽다.
    if (card.status === REVIEW_PENDING_STATUS && newStatus === REVIEW_IN_PROGRESS_STATUS) {
      setError('');
      setStartTarget(card);
      return;
    }

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
        mine={mine}
        onMineChange={setMine}
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
      {approvalTarget && (
        <ApprovalDialog
          open
          onOpenChange={(v) => {
            if (!v) setApprovalTarget(null);
          }}
          requirement={approvalTarget}
          brandId={approvalTarget.brand_id ?? identity.brandId}
          onApproved={() => {
            setApprovalTarget(null);
            load();
          }}
        />
      )}
      {startTarget && (
        <StartReviewDialog
          open
          onOpenChange={(v) => {
            if (!v) setStartTarget(null);
          }}
          requirement={startTarget}
          brandId={startTarget.brand_id ?? identity.brandId}
          teamMembers={teamMembers}
          onStarted={() => {
            setStartTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
