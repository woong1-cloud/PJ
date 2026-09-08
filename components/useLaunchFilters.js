'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mergeLaunchParams, parseLaunchParams } from '@/lib/launchFilters';

// 타이핑마다 주소를 바꾸면 라우터가 계속 리렌더를 민다. 300ms 멈춘 뒤에만.
const SEARCH_DEBOUNCE_MS = 300;

// 런칭 보드의 화면 상태를 URL 에서 읽고 쓴다.
// useRequirementFilters 와 같은 모양이다. 왜 URL 인지는 lib/launchFilters.js 참조.
//
// 반환:
//   tab/view/group/role/assignee/ws/task/roleInUrl  주소에서 읽은 값
//   q          입력창에 그릴 값 — 주소가 아니라 로컬 상태다
//   setParams  { key: value } 를 주소에 얹는다
//   setQ       입력창 값만 바꾼다(디바운스 뒤 주소로 간다)
//   reset      전부 기본값으로
export function useLaunchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ReadonlyURLSearchParams 는 렌더마다 새 객체다. 문자열 하나로 눌러서
  // 그것만 비교 기준으로 삼는다 — 안 그러면 effect 가 매 렌더 돈다.
  const searchKey = searchParams.toString();

  const parsed = useMemo(
    () => parseLaunchParams(new URLSearchParams(searchKey)),
    [searchKey],
  );

  // 입력창은 즉시 반응해야 하므로 로컬 상태다.
  const [q, setQ] = useState(parsed.q);
  const [debouncedQ, setDebouncedQ] = useState(parsed.q);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // router.replace 는 비동기다. 호출한 직후 렌더에서도 useSearchParams 는 아직
  // 예전 쿼리스트링을 준다. 그 사이에 두 번째 쓰기가 일어나면 낡은 값을 기준으로
  // 병합해서 방금 쓴 변경이 되살아난다 — 요구사항 쪽에서 '필터 초기화'가
  // 실제로 이 때문에 깨졌다. 병합 기준은 "주소에 쓰기로 한 마지막 값"으로 잡는다.
  const pendingRef = useRef(null);

  // 주소가 우리가 쓴 값을 따라잡았을 때만 기준을 놓아준다. 변화마다 비우면
  // 연속으로 두 번 쓴 뒤 첫 번째만 반영된 시점에 두 번째를 잃는다.
  useEffect(() => {
    if (pendingRef.current === searchKey) pendingRef.current = null;
  }, [searchKey]);

  const setParams = useCallback(
    (patch) => {
      const base = pendingRef.current ?? searchKey;
      const next = mergeLaunchParams(base, patch);
      // 값이 그대로면 라우팅하지 않는다. 이 가드가 없으면 아래 q 동기화
      // effect 가 searchKey 변화마다 replace 를 다시 쏴 루프가 된다.
      if (next === base) return;
      pendingRef.current = next;
      // push 가 아니라 replace 다. 필터를 만질 때마다 히스토리가 쌓이면
      // 뒤로가기를 여러 번 눌러야 화면을 빠져나간다.
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchKey],
  );

  // 디바운스가 끝난 값만 주소로 옮긴다.
  useEffect(() => {
    setParams({ q: debouncedQ.trim() });
  }, [debouncedQ, setParams]);

  const reset = useCallback(() => {
    // 입력창·디바운스·주소를 한 번에 맞춘다. 입력창만 비우고 디바운스를
    // 기다리면 300ms 동안 지운 검색어로 걸러진 결과가 남는다.
    setQ('');
    setDebouncedQ('');
    // role 은 '' 로 보내 키를 지운다. task/ws 는 필터가 아니라 안 건드린다 —
    // '필터 초기화'가 열린 창을 닫으면 놀란다.
    //
    // tab 도 같은 이유로 안 건드린다. 필터를 지우려고 누른 단추가 보고 있던
    // 탭까지 바꾸면, 초기화가 아니라 화면을 잃은 것으로 읽힌다.
    setParams({ view: '', role: '', assignee: '', q: '', group: '' });
  }, [setParams]);

  // parsed.q 를 따로 안 내보낸다. 요구사항 쪽은 검색어가 서버 조회에 들어가서
  // "주소에 들어간 값"이 따로 필요했지만, 런칭은 471건을 브라우저에서 거르므로
  // 입력창 값을 그대로 쓰면 된다 — 안 쓰는 값을 내보내면 언젠가 잘못 쓰인다.
  return { ...parsed, q, setParams, setQ, reset };
}
