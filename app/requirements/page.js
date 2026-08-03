'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useIdentity } from '@/components/IdentityProvider';
import { RequirementViewToggle } from '@/components/RequirementViewToggle';
import { canProcess } from '@/lib/tiers';
import { sortRequirements, DEFAULT_SORT_DIR } from '@/lib/sortRequirements';
import { toLocalDateString } from '@/lib/overdue';
import { buildRequirementsQuery } from '@/lib/requirementFilters';
import { RequirementList } from '@/components/RequirementList';
import { RequirementFormDialog } from '@/components/RequirementFormDialog';
import { FilterBar } from '@/components/FilterBar';
import { MergeDialog } from '@/components/MergeDialog';
import {
  useRequirementFilters,
  useRequirementFilterOptions,
} from '@/components/useRequirementFilters';

// useSearchParams 를 쓰는 부분은 Suspense 경계 안에 있어야 한다. 없으면
// 프로덕션 빌드가 "Missing Suspense boundary with useSearchParams" 로 실패한다
// (개발 서버는 on-demand 렌더라 그냥 통과해서 눈치채기 어렵다).
// 페이지 전체를 동적 렌더로 돌리는 대신 경계만 둔다.
export default function RequirementsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">불러오는 중...</p>}>
      <RequirementsView />
    </Suspense>
  );
}

function RequirementsView() {
  const { identity } = useIdentity();
  const processAllowed = canProcess(identity);
  const [mergeSource, setMergeSource] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState({ key: 'request_date', dir: 'desc' });
  // 오늘 날짜는 렌더마다 새로 만들면 불필요한 재계산이 생기므로 한 번만 잡는다.
  // UTC가 아니라 지역 시간을 쓴다 — 이유는 toLocalDateString 주석 참조.
  const [today] = useState(() => toLocalDateString(new Date()));
  // 직접 setLoading(true/false)를 effect 안에서 호출하지 않고, "이 조회 조건에 대한
  // 응답을 이미 받았는지"를 key 비교로 파생시킨다(react-hooks/set-state-in-effect 회피).
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');

  // 필터는 URL 이 들고 있다. 보드로 갔다 돌아와도 그대로 남고, 주소를 그대로
  // 공유하면 상대도 같은 화면을 본다.
  const {
    filters,
    query,
    appliedQuery,
    includeDone,
    setFilters,
    setQuery,
    setIncludeDone,
    resetFilters,
    mine,
    setMine,
    missing,
  } = useRequirementFilters();
  const { teamMembers, categories, projects } = useRequirementFilterOptions(identity.brandId);

  const apiQuery = buildRequirementsQuery({
    brandId: identity.brandId,
    filters,
    query: appliedQuery,
    includeDone,
    mine,
    memberId: identity.memberId,
    missing,
  });
  const currentKey = `${reloadToken}|${apiQuery}`;
  const loading = loadedKey !== currentKey;

  function refreshRequirements() {
    setReloadToken((t) => t + 1);
  }

  const sortedRequirements = useMemo(
    () => sortRequirements(requirements, sort.key, sort.dir),
    [requirements, sort],
  );

  function handleSort(key) {
    // 같은 컬럼을 다시 누르면 방향만 뒤집고, 새 컬럼이면 그 컬럼에 맞는
    // 기본 방향으로 시작한다(우선순위는 '상'부터, 요청일은 최신부터).
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_SORT_DIR[key] ?? 'desc' },
    );
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/requirements?${apiQuery}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '요구사항을 불러오지 못했습니다.');
        setRequirements(d.requirements ?? []);
        setError('');
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(currentKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery, reloadToken]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">요구사항 목록</h1>
        <div className="flex items-center gap-2">
          {processAllowed && <RequirementViewToggle current="list" />}
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
          >
            + 새 요구사항
          </button>
        </div>
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
        includeDone={includeDone}
        onIncludeDoneChange={setIncludeDone}
        mine={mine}
        onMineChange={setMine}
      />

      {/* missing 은 필터바에 칸이 없다(대시보드 '손볼 것' 링크로만 들어온다).
          표시가 없으면 사용자는 목록이 왜 이것뿐인지 알 수 없어 화면이 고장난
          줄 안다. '필터 초기화'도 이 값을 지우지 않으므로 빠져나갈 길을 준다. */}
      {missing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="flex-1 break-keep">
            {missing === 'assignee' ? '담당자가 없는 건' : '예상 배포일이 없는 건'}만 보고
            있습니다.
          </span>
          <Link href="/requirements" className="whitespace-nowrap underline">
            전체 보기
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중...</p>
      ) : (
        <RequirementList
          requirements={sortedRequirements}
          sort={sort}
          onSort={handleSort}
          today={today}
          onMerge={processAllowed ? setMergeSource : undefined}
        />
      )}
      {/* 보드와 같은 다이얼로그를 그대로 쓴다. 병합 규칙이 두 곳에 갈리면
          한쪽만 고쳐진다. */}
      {mergeSource && (
        <MergeDialog
          source={mergeSource}
          onClose={() => setMergeSource(null)}
          onMerged={() => {
            setMergeSource(null);
            refreshRequirements();
          }}
        />
      )}
      <RequirementFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        projects={projects}
        identity={identity}
        onCreated={refreshRequirements}
      />
    </div>
  );
}
