'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EMPTY_FILTERS, mergeFilterParams, parseFilterParams } from '@/lib/requirementFilters';

// 타이핑마다 조회하면 요청이 쏟아진다. 300ms 멈춘 뒤에만 반영한다.
const SEARCH_DEBOUNCE_MS = 300;

// 목록·보드가 공유하는 필터 상태 훅. 진짜 상태는 URL 쿼리스트링이고
// 이 훅은 그걸 읽고 쓰는 창구다(왜 URL 인지는 lib/requirementFilters.js 참조).
//
// 반환:
//   filters/includeDone   URL 에서 읽은 값 (조회 조건)
//   query                 입력창에 그릴 값 — URL 이 아니라 로컬 상태다
//   appliedQuery          실제 조회에 쓸 검색어 (= URL 의 q)
//   searchKey             현재 쿼리스트링. effect 의 deps 로 쓰라고 내보낸다
//   setFilters/setQuery/setIncludeDone/resetFilters
export function useRequirementFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ReadonlyURLSearchParams 는 렌더마다 새 객체다. 여기서 파생된 객체를
  // effect deps 에 그대로 넣으면 조회가 매 렌더 돈다. 문자열 하나로 눌러서
  // 그것만 비교 기준으로 삼는다.
  const searchKey = searchParams.toString();

  const {
    filters,
    query: appliedQuery,
    includeDone,
    mine,
    missing,
  } = useMemo(() => parseFilterParams(new URLSearchParams(searchKey)), [searchKey]);

  // 입력창은 즉시 반응해야 하므로 로컬 상태로 둔다. 키 입력마다 주소를 바꾸면
  // 히스토리가 더러워지고 라우터가 계속 리렌더를 밀어 넣는다.
  //
  // 주소를 바꿀 때 push 가 아니라 replace 를 쓰므로, 이 페이지가 살아 있는 동안
  // URL 의 q 가 우리 손을 거치지 않고 바뀌는 경로는 없다(뒤로가기는 이 화면을
  // 떠난다). 그래서 URL → 입력창 역방향 동기화는 두지 않는다. 목록 ↔ 보드
  // 전환은 라우트가 달라 새로 마운트되므로 아래 초기값으로 자연히 복원된다.
  const [query, setQuery] = useState(appliedQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(appliedQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // router.replace 는 비동기다. 호출한 직후의 렌더에서도 useSearchParams 는
  // 아직 예전 쿼리스트링을 준다. 그 짧은 사이에 두 번째 쓰기가 일어나면
  // 낡은 값을 기준으로 병합해서 방금 쓴 변경이 되살아난다.
  //
  // 실제로 '필터 초기화'가 이 때문에 깨졌다: 초기화가 주소를 비운 직후,
  // 디바운스 q 동기화 effect 가 아직 반영 안 된 예전 주소를 기준으로 q 만
  // 지우고 다시 써서 priority 가 되돌아왔다. 그래서 병합 기준은 현재 주소가
  // 아니라 "주소에 써 넣기로 한 마지막 값"으로 잡는다.
  const pendingSearchRef = useRef(null);

  // 주소가 우리가 쓴 값을 따라잡았으면 기준을 놓아준다. 이걸 안 하면 밖에서
  // 주소가 바뀌었을 때(직접 입력 등) 낡은 기준에 계속 매달린다.
  //
  // "따라잡았을 때만" 비운다는 게 중요하다. searchKey 가 바뀌기만 하면 비우면,
  // 연속으로 두 번 쓴 뒤 첫 번째 것만 반영된 시점에 기준이 풀려 두 번째 변경을
  // 잃는다.
  useEffect(() => {
    if (pendingSearchRef.current === searchKey) pendingSearchRef.current = null;
  }, [searchKey]);

  const replaceParams = useCallback(
    (patch) => {
      const base = pendingSearchRef.current ?? searchKey;
      const next = mergeFilterParams(base, patch);
      // 값이 그대로면 라우팅하지 않는다. 이 가드가 없으면 아래 q 동기화
      // effect 가 searchKey 변화마다 replace 를 다시 쏴 루프가 된다.
      if (next === base) return;
      pendingSearchRef.current = next;
      // push 가 아니라 replace 다. 필터를 만질 때마다 히스토리가 쌓이면
      // 뒤로가기를 여러 번 눌러야 화면을 빠져나갈 수 있게 된다.
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchKey],
  );

  // 디바운스가 끝난 값만 주소로 옮긴다.
  useEffect(() => {
    replaceParams({ q: debouncedQuery.trim() });
  }, [debouncedQuery, replaceParams]);

  const setFilters = useCallback((patch) => replaceParams(patch), [replaceParams]);

  const setIncludeDone = useCallback(
    (value) => replaceParams({ includeDone: value ? 'true' : '' }),
    [replaceParams],
  );

  const setMine = useCallback(
    (value) => replaceParams({ mine: value ? 'true' : '' }),
    [replaceParams],
  );

  const resetFilters = useCallback(() => {
    // 입력창·디바운스·주소를 한 번에 맞춘다. 입력창만 비우고 디바운스를
    // 기다리면 300ms 동안 지운 검색어로 걸러진 결과가 남는다.
    setQuery('');
    setDebouncedQuery('');
    // mine 도 함께 지운다. EMPTY_FILTERS 는 FILTER_KEYS 만 담으므로 mine 은
    // 여기서 직접 비워야 한다 — 빠뜨리면 '필터 초기화'를 눌러도 내 요청만
    // 켜진 채 남고, 사용자는 초기화가 안 먹는다고 본다.
    replaceParams({ ...EMPTY_FILTERS, q: '', mine: '' });
  }, [replaceParams]);

  return {
    filters,
    query,
    appliedQuery,
    includeDone,
    mine,
    // 대시보드 '손볼 것'에서 링크로만 들어온다. 필터바에는 칸이 없다.
    missing,
    searchKey,
    setFilters,
    setQuery,
    setIncludeDone,
    setMine,
    resetFilters,
  };
}

// 필터 드롭다운에 채울 목록. 목록·보드가 같은 선택지를 보여줘야 하므로
// 여기 한 곳에서 가져온다. (목록 페이지는 새 요구사항 다이얼로그에도
// categories/projects 를 그대로 넘긴다.)
export function useRequirementFilterOptions(brandId) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    const keep = (setter) => (value) => {
      if (!cancelled) setter(value);
    };

    fetch('/api/team-members')
      .then((res) => res.json())
      .then((d) => keep(setTeamMembers)(d.teamMembers ?? []))
      .catch(() => {});
    fetch(`/api/brand-categories?brandId=${brandId}`)
      .then((res) => res.json())
      .then((d) => keep(setCategories)(d.categories ?? []))
      .catch(() => {});
    Promise.all([
      fetch(`/api/projects?brandId=${brandId}`).then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ])
      .then(([mine, all]) => {
        const mineList = mine.projects ?? [];
        const mineIds = new Set(mineList.map((p) => p.id));
        const others = (all.projects ?? []).filter((p) => !mineIds.has(p.id));
        // 대부분 자기 브랜드에 전개된 프로젝트를 고르므로 그쪽을 위에 둔다.
        keep(setProjects)([...mineList, ...others]);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  return { teamMembers, categories, projects };
}
