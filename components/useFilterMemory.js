'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  filterMemoryToParams,
  hasRestorableFilters,
  packFilterMemory,
  readFilterMemory,
  urlHasFilters,
  writeFilterMemory,
} from '@/lib/filterMemory';

// 마지막으로 보던 조건을 기억했다가 다음에 들어올 때 되살린다.
//
// useRequirementFilters 안에 넣지 않은 이유: 그쪽은 주소 쓰기 타이밍이 까다로워
// (pendingSearchRef 주석 참조) 손댈수록 위험하고, 보드는 이 기억이 필요 없다.
// 목록만 이 훅을 붙인다.
//
// 되살리는 것이 위험한 기능이라는 점을 잊지 말 것. 어제 걸어 둔 필터를 잊은 채
// 오늘 들어오면 "요구사항이 세 건뿐이네?"가 된다. 그래서 이 훅은 반드시
// ActiveFilterChips 와 함께 쓴다 — 무엇이 걸렸는지 보이지 않으면 만들면 안 되는
// 기능이다.
export function useFilterMemory({
  brandId,
  searchKey,
  filters,
  mine,
  includeDone,
  sort,
  setFilters,
  setSort,
}) {
  // 되살릴 것을 첫 렌더에 딱 한 번 정한다. effect 안에서 setState 를 부르면
  // 렌더가 연쇄되는데, 여기서는 그럴 필요가 없다 — 마운트 시점에 이미 다 알 수
  // 있는 값이다.
  //
  // 이 시점에 brandId 가 있다는 보장은 IdentityProvider 가 준다. identity 를
  // 얻기 전에는 자식을 그리지 않는다.
  const [pending] = useState(() => {
    // 주소에 조건이 있으면 그쪽이 이긴다(공유받은 링크·대시보드 링크).
    // 저장값이 덮으면 두 사람이 서로 다른 화면을 보면서 같은 것을 본다고 믿는다.
    if (urlHasFilters(searchKey)) return null;
    return readFilterMemory(brandId);
  });
  const restorable = hasRestorableFilters(pending);

  // 안내 문구는 사용자가 필터를 건드리는 순간 내린다. 안 그러면 초기화 뒤에 새
  // 필터를 걸었을 때 "지난번에 보던 조건" 이라고 거짓말을 하게 된다.
  const [noticeOn, setNoticeOn] = useState(restorable);
  const dismissRestored = useCallback(() => setNoticeOn(false), []);

  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current || !pending) return;
    appliedRef.current = true;
    // 정렬은 조건이 없어도 되살린다. "예상일 순"을 매번 다시 누르는 것이 귀찮다.
    if (pending.sort) setSort?.(pending.sort);
    if (hasRestorableFilters(pending)) setFilters(filterMemoryToParams(pending));
  }, [pending, setFilters, setSort]);

  // 되살릴 필터가 있는데 아직 주소에 반영되지 않았으면 저장하지 않는다.
  // 여기서 저장하면 첫 렌더의 빈 상태가 기억을 덮어써 되살리기가 무의미해진다.
  const mountKeyRef = useRef(searchKey);
  useEffect(() => {
    if (!brandId) return;
    if (restorable && searchKey === mountKeyRef.current) return;
    writeFilterMemory(brandId, packFilterMemory({ filters, mine, includeDone, sort }));
  }, [brandId, searchKey, restorable, filters, mine, includeDone, sort]);

  // '필터 초기화'를 따로 다루지 않는다. 초기화가 주소를 비우면 위 저장 effect 가
  // 빈 기억을 덮어쓰므로 다음에 되살아나지 않는다 — 지운 필터가 되살아나는 것은
  // 사용자에게 고장으로 보인다.
  return { restored: noticeOn, dismissRestored };
}
