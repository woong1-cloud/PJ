'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { requirementsToCsv, csvFileName } from '@/lib/csv';
import { useIdentity } from '@/components/IdentityProvider';
import { RequirementViewToggle } from '@/components/RequirementViewToggle';
import { canProcess } from '@/lib/tiers';
import { sortRequirements, DEFAULT_SORT_DIR } from '@/lib/sortRequirements';
import { toLocalDateString } from '@/lib/overdue';
import { buildRequirementsQuery, hasActiveFilters } from '@/lib/requirementFilters';
import { RequirementList } from '@/components/RequirementList';
import { RequirementFormDialog } from '@/components/RequirementFormDialog';
import { FilterBar } from '@/components/FilterBar';
import { MergeDialog } from '@/components/MergeDialog';
import { NewRequirementFab } from '@/components/NewRequirementFab';
import { useFilterMemory } from '@/components/useFilterMemory';
import { QuickFilterChips } from '@/components/QuickFilterChips';
import { useQuickFilterCounts } from '@/components/useQuickFilterCounts';
import { activeChipKey, chipParams, quickFilterChips } from '@/lib/quickFilters';
import {
  useRequirementFilters,
  useRequirementFilterOptions,
} from '@/components/useRequirementFilters';

// 대시보드 '손볼 것' 링크가 넣는 missing 값의 사람 말. 예전에는 삼항으로
// 두 갈래만 갈라서 missing=redmine 이 '예상 배포일이 없는 건'으로 잘못 표시됐다.
const MISSING_LABELS = {
  assignee: '담당자가 없는 건',
  expectedDate: '예상 배포일이 없는 건',
  redmine: '레드마인에 연결되지 않은 건',
};

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
  // CSV 는 본문을 받으러 한 번 더 다녀오므로 버튼이 응답해야 한다.
  const [csvBusy, setCsvBusy] = useState(false);
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
    overdue,
    searchKey,
  } = useRequirementFilters();
  const { teamMembers, categories, projects } = useRequirementFilterOptions(identity.brandId);

  // 마지막으로 보던 조건을 되살린다. 주소에 조건이 있으면(공유 링크·대시보드
  // 링크) 되살리지 않는다 — 링크가 항상 이긴다.
  const { restored, dismissRestored } = useFilterMemory({
    brandId: identity.brandId,
    searchKey,
    filters,
    mine,
    includeDone,
    sort,
    setFilters,
    setSort,
  });

  const apiQuery = buildRequirementsQuery({
    brandId: identity.brandId,
    filters,
    query: appliedQuery,
    includeDone,
    mine,
    memberId: identity.memberId,
    missing,
    overdue,
  });
  const currentKey = `${reloadToken}|${apiQuery}`;
  const loading = loadedKey !== currentKey;

  // 빠른 필터 칩. 등급에 따라 칩 구성이 다르다(lib/quickFilters.js).
  //
  // 켜진 칩은 주소에서 되읽는다. 칩 상태를 따로 들고 있으면 뒤로가기나 공유
  // 링크로 들어왔을 때 화면과 주소가 어긋난다.
  //
  // missing 은 filters 밖에 따로 오므로(대시보드 링크 전용 파라미터) 여기서
  // 합쳐 넘긴다 — activeChipKey 는 한 덩어리로 본다.
  const chips = quickFilterChips(identity);
  const activeKey = activeChipKey(identity, { filters: { ...filters, missing }, mine, overdue });
  const chipCounts = useQuickFilterCounts({
    brandId: identity.brandId,
    identity,
    includeDone,
    reloadToken,
  });

  function pickChip(key) {
    dismissRestored();
    setFilters(chipParams(identity, key, activeKey));
  }

  // 요청자에게는 '내 요청' 칩이 이미 같은 일을 한다. 같은 스위치를 두 군데 두면
  // 한쪽을 눌렀을 때 다른 쪽이 따라 움직여 어느 것이 진짜인지 헷갈린다.
  // 기획자 이상은 칩이 담당자 기준이라 이 체크박스가 여전히 쓸모가 있어 남긴다.
  const handleMineChange = processAllowed
    ? (v) => {
        dismissRestored();
        setMine(v);
      }
    : undefined;

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

  // 목록에서 값을 바로 바꾼다.
  //
  // 담당자 없는 6건을 채우려고 6번 들어갔다 나오는 것이 지금 가장 자주 하는
  // 일이면서 가장 느리다. 여기서 바꾸면 한 번에 끝난다.
  //
  // 담당자와 유형은 서로 다른 라우트를 쓴다 — 담당자는 알림을 보내야 해서
  // 전용 라우트가 있고(PATCH .../assignee), 유형은 내용 수정이다.
  //
  // 낙관적 갱신을 하지 않는다. 셀렉트는 고른 값이 바로 화면에 남아 있어서
  // 사용자가 이미 반영된 것으로 본다. 실패하면 배너가 뜨고 다시 불러오므로
  // 값이 원래대로 돌아간다 — 그때 무엇이 안 됐는지가 분명하다.
  async function patchRequirement(id, patch) {
    setError('');
    const url =
      'assignee' in patch
        ? `/api/requirements/${id}/assignee`
        : `/api/requirements/${id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: identity.brandId, ...patch }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '변경에 실패했습니다.');
    }
    setReloadToken((t) => t + 1);
  }

  // CSV 는 본문(As-Is·To-Be·비고)까지 담는다. 제목만으로는 "우리가 뭘
  // 요청했는지"를 알 수 없어서, 정리해 공유하는 문서로 쓸 수가 없다.
  //
  // 그런데 본문을 목록 조회에 늘 실으면 CSV 를 안 누르는 대부분의 화면
  // 로딩까지 무거워진다. 그래서 누를 때 detail=true 로 한 번 더 받는다.
  //
  // 같은 apiQuery 에 detail 만 덧붙이므로 필터·정렬 조건은 화면과 동일하다.
  // 정렬은 서버가 아니라 화면이 하므로 여기서 다시 적용한다.
  async function downloadCsv() {
    setCsvBusy(true);
    setError('');
    let rows = sortedRequirements;
    try {
      const res = await fetch(`/api/requirements?${apiQuery}&detail=true`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '내보내기에 실패했습니다.');
      rows = sortRequirements(d.requirements ?? [], sort.key, sort.dir);
    } catch (e) {
      // 본문을 못 받아도 화면에 있는 것으로 내려준다 — 빈손으로 돌려보내는
      // 것보다 낫다. 그 경우 본문 칸만 비어 있다.
      setError(`${e.message} 본문 없이 내려받습니다.`);
    } finally {
      setCsvBusy(false);
    }

    const csv = requirementsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // 브랜드 이름은 넣지 않는다. identity 에 없어서 얻으려면 요청이 하나 더
    // 필요한데, 파일명 하나를 위해 왕복을 추가할 이유가 없다. 브랜드를 바꿔
    // 가며 두 번 받으면 브라우저가 (1) 을 붙인다. csvFileName 은 브랜드를
    // 받도록 열어 뒀으니, 나중에 브랜드를 이미 들고 있는 화면이 생기면 넘긴다.
    a.download = csvFileName(null, today);
    a.click();
    // 안 풀어주면 페이지가 살아 있는 동안 blob 이 메모리에 남는다.
    URL.revokeObjectURL(url);
  }

  return (
    // pb-20 은 플로팅 등록 버튼이 마지막 카드를 가리지 않게 하는 자리다.
    <div className="flex flex-col gap-4 pb-20 md:pb-0">
      {/* 헤더 줄은 모바일에서 통째로 없앤다.
          '+ 새 요구사항'은 플로팅 버튼으로 갔으니 중복이고, CSV 는 폰에서
          받아도 열 데가 없다. 목록/보드 토글은 보드가 폰에서 못 쓰는 화면이라
          갈 길을 만들 이유가 없다. 제목은 상단바에 '모아 · 브랜드명'이 있고
          요청자에게 화면이 사실상 하나라 자명하다.
          그렇게 세로 40px 를 벌면 첫 화면에 카드가 한 장 더 들어온다. */}
      <div className="hidden items-center justify-between md:flex">
        <h1 className="text-lg font-semibold text-slate-900">요구사항 목록</h1>
        <div className="flex items-center gap-2">
          {processAllowed && <RequirementViewToggle current="list" />}
          {/* 지금 화면에 보이는 것을 그대로 내려받는다. 서버에 다시 물으면
              필터가 어긋날 수 있고, 사용자는 "화면과 다른 파일"을 받는다. */}
          <button
            type="button"
            onClick={downloadCsv}
            disabled={csvBusy || sortedRequirements.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            {csvBusy ? '준비 중...' : 'CSV'}
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
          >
            + 새 요구사항
          </button>
        </div>
      </div>

      {/* 셀렉트보다 위에 둔다. 대부분의 사람이 원하는 건 "지금 내가 볼 덩어리"
          하나이고, 그건 셀렉트 일곱 개를 조합해서 만드는 값이 아니다. */}
      <QuickFilterChips
        chips={chips}
        counts={chipCounts}
        activeKey={activeKey}
        onPick={pickChip}
      />

      {/* 필터를 건드리는 모든 입구에서 '지난번 조건' 안내를 내린다. 그대로 두면
          초기화 뒤에 새로 건 필터에까지 그 문구가 붙어 거짓말이 된다. */}
      <FilterBar
        teamMembers={teamMembers}
        categories={categories}
        projects={projects}
        value={filters}
        onChange={(patch) => {
          dismissRestored();
          setFilters(patch);
        }}
        query={query}
        onQueryChange={setQuery}
        onReset={() => {
          dismissRestored();
          resetFilters();
        }}
        includeDone={includeDone}
        onIncludeDoneChange={(v) => {
          dismissRestored();
          setIncludeDone(v);
        }}
        mine={processAllowed ? mine : false}
        onMineChange={handleMineChange}
      />

      {/* 되살렸을 때만 뜬다.
          칩만으로도 무엇이 걸렸는지는 보이지만, "내가 방금 건 것"과 "저장돼
          있던 것"은 다르다. 어제 걸어 둔 필터를 잊은 채 오늘 들어와 "요구사항이
          세 건뿐이네?" 하는 것을 막는 게 이 한 줄이다.
          필터가 없어지면(초기화·전체 보기) 조건이 거짓이 되어 저절로 사라진다. */}
      {restored && hasActiveFilters({ filters, query, mine, overdue }) && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="flex-1 break-keep">지난번에 보던 조건으로 열었습니다.</span>
          <button
            type="button"
            onClick={resetFilters}
            className="shrink-0 whitespace-nowrap underline hover:text-slate-900"
          >
            전체 보기
          </button>
        </div>
      )}

      {/* missing 은 필터바에 칸이 없다(대시보드 '손볼 것' 링크로만 들어온다).
          표시가 없으면 사용자는 목록이 왜 이것뿐인지 알 수 없어 화면이 고장난
          줄 안다.

          칩이 켜져 있으면 내리다. '담당자 없음' 칩이 바로 위에서 같은 말을
          하고 있는데 아래에 경고 띠까지 두면 같은 사실을 두 번 말하는 셈이다.
          칩이 없는 등급(요청자)에게는 그대로 뜬다. */}
      {missing && !activeKey && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="flex-1 break-keep">
            {MISSING_LABELS[missing] ?? '일부 항목이 빈 건'}만 보고 있습니다.
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
          teamMembers={teamMembers}
          onPatch={processAllowed ? patchRequirement : undefined}
          // missing 도 조건이다. 대시보드 '손볼 것'에서 넘어와 0건이면 그건
          // 아직 아무것도 없는 게 아니라 그 조건에 걸리는 게 없는 것이다.
          filtered={hasActiveFilters({ filters, query, mine, overdue }) || Boolean(missing)}
          onCreate={() => setDialogOpen(true)}
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
      {/* 모바일에서만 뜬다(md:hidden). 헤더의 '+ 새 요구사항'을 대신한다. */}
      <NewRequirementFab onClick={() => setDialogOpen(true)} />
    </div>
  );
}
