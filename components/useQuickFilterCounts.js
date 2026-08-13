'use client';

import { useEffect, useState } from 'react';
import { buildRequirementsQuery } from '@/lib/requirementFilters';
import { quickFilterCounts } from '@/lib/quickFilters';
import { toLocalDateString } from '@/lib/overdue';

// 칩에 붙일 개수.
//
// 목록 API 를 필터 없이 한 번 더 불러 화면에서 센다. 서버에 개수 전용 라우트를
// 두지 않은 이유는 비공개·작성중 가시성 규칙을 두 곳에 복제하게 되기 때문이다 —
// 목록 API 를 그대로 쓰면 그 규칙이 공짜로 따라온다.
//
// includeDone 을 그대로 넘긴다. 사용자가 '종결 숨김'을 꺼 둔 상태라면 칩 숫자도
// 같은 기준이어야 한다. 안 그러면 '담당자 없음 28' 을 눌렀는데 31건이 나온다.
export function useQuickFilterCounts({ brandId, identity, includeDone, reloadToken }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;

    const params = buildRequirementsQuery({ brandId, includeDone });
    fetch(`/api/requirements?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        // '오늘'은 보는 사람 기준이다. 목록 화면의 지연 표시와 같은 값을 써야
        // 칩 숫자와 화면의 빨간 줄 개수가 어긋나지 않는다.
        const today = toLocalDateString(new Date());
        setCounts(quickFilterCounts(identity, data.requirements ?? [], today));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // identity 는 객체라 매 렌더 새로 오지만 memberId·tier 만 쓴다. 그 둘이
    // 바뀌는 경우(브랜드 전환)에는 전체 새로고침이 일어나므로 여기 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, includeDone, reloadToken]);

  return counts;
}
