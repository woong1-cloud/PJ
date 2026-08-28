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
// 목록은 늘 종결까지 받아 오고, 세는 일은 화면에서 나눈다.
//
// 대부분의 칩은 사용자의 '종결 숨김' 설정을 그대로 따라야 한다 — 안 그러면
// '담당자 없음 28' 을 눌렀는데 31건이 나온다. 그런데 보류 칩만은 따르지
// 않는다(그 칩이 종결 포함을 스스로 켠다). 한 번 받아 두 기준으로 세면
// 요청은 그대로이고 두 규칙을 다 지킬 수 있다.
export function useQuickFilterCounts({ brandId, identity, includeDone, reloadToken }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;

    const params = buildRequirementsQuery({ brandId, includeDone: true });
    fetch(`/api/requirements?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        // '오늘'은 보는 사람 기준이다. 목록 화면의 지연 표시와 같은 값을 써야
        // 칩 숫자와 화면의 빨간 줄 개수가 어긋나지 않는다.
        const today = toLocalDateString(new Date());
        setCounts(quickFilterCounts(identity, data.requirements ?? [], today, includeDone));
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
