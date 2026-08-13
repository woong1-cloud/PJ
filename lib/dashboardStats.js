// 레드마인 인계 누락 판정은 lib/redmineLink.js 가 갖고 있다. 이 파일은 집계만
// 하고, "언제 링크가 있어야 하는가"라는 규칙은 한 곳에만 둔다.
import { unlinkedHandoffs } from './redmineLink';
import {
  BOARD_STATUSES,
  CLOSED_STATUSES,
  DONE_STATUS,
  MERGED_STATUS,
  REVIEW_PENDING_STATUS,
} from './statuses';

// 평균 처리 기간을 표시하기 시작하는 완료 건수.
//
// 1~2건의 평균은 평균이라 부를 수 없다. 그런데 '—' 만 띄우면 사용자는 고장난
// 줄 알고, 아예 숨기면 그런 지표가 있는 줄도 모른다. 그래서 상수로 꺼내 두고
// 화면이 "완료 3건부터 표시됩니다" 라고 말하게 한다.
export const MIN_COMPLETED_FOR_AVG = 3;

// '손볼 것' 각 항목의 판정식.
//
// 함수로 꺼내 둔 이유는 이걸 읽는 곳이 둘이기 때문이다 — 대시보드(개수)와
// 주간 요약 메일(개수 + 상위 몇 건의 제목). 두 곳에 조건을 복제하면 언젠가
// 한쪽만 고쳐지고, 그때 메일은 25건이라 하고 화면은 24건이라 한다. 그 어긋남은
// 사용자가 먼저 발견하고, 발견한 순간 둘 다 못 믿게 된다.
//
// unlinkedHandoff 만 여기 없다. "언제 레드마인 링크가 있어야 하는가"는
// lib/redmineLink.js 가 갖고 있고, 규칙을 옮겨 오면 그 파일과 갈린다.
export const ACTION_PREDICATES = {
  unassignedReview: (r) => r.status === REVIEW_PENDING_STATUS && !r.assignee,
  // 종결된 건에 예상일이 없는 것은 문제가 아니다 — 이미 끝났다.
  noExpectedDate: (r) => !CLOSED_STATUSES.includes(r.status) && !r.expected_release_date,
};



function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dateOnly(isoTimestamp) {
  return isoTimestamp.slice(0, 10);
}

function daysBetween(dateStr, isoTimestamp) {
  const start = new Date(`${dateStr}T00:00:00Z`);
  const end = new Date(`${dateOnly(isoTimestamp)}T00:00:00Z`);
  return (end - start) / (1000 * 60 * 60 * 24);
}

export function computeDashboardStats({ requirements, brands, periodDays, today }) {
  const cutoff = periodDays == null ? null : addDays(today, -periodDays);

  const byBrand = brands.map((brand) => {
    const brandReqs = requirements.filter((r) => r.brand_id === brand.id);

    const openCount = brandReqs.filter((r) => r.status !== DONE_STATUS && r.status !== MERGED_STATUS).length;

    const newInPeriod = brandReqs.filter((r) => cutoff === null || r.request_date >= cutoff).length;

    const completedReqs = brandReqs.filter(
      (r) => r.status === DONE_STATUS && (cutoff === null || dateOnly(r.completed_at) >= cutoff)
    );
    const completedInPeriod = completedReqs.length;

    const avgCompletionDays =
      completedInPeriod === 0
        ? null
        : completedReqs.reduce((sum, r) => sum + daysBetween(r.request_date, r.completed_at), 0) /
          completedInPeriod;

    return {
      brandId: brand.id,
      brandName: brand.name,
      openCount,
      newInPeriod,
      completedInPeriod,
      avgCompletionDays,
    };
  });

  const overall = {
    brandCount: brands.length,
    openCount: byBrand.reduce((sum, b) => sum + b.openCount, 0),
    completedInPeriod: byBrand.reduce((sum, b) => sum + b.completedInPeriod, 0),
  };

  return { overall, byBrand };
}

// 대시보드 최상단 "손볼 것".
//
// 집계가 아니라 할 일이다. 지금 대시보드는 몇 건인지는 보여주지만 눌러서 갈
// 곳이 없다. 여기 있는 줄은 전부 관리자가 오늘 처리할 수 있는 것이어야 한다.
//
// 0인 항목은 목록에서 뺀다. "담당자 없는 검토대기 0건" 같은 줄이 쌓이면
// 정작 손볼 것이 생겼을 때 눈에 안 들어온다. 셋 다 0이면 빈 배열이 되고,
// 화면이 "지금 손볼 것이 없습니다" 를 보여준다.
//
// requirements: [{ brand_id, status, assignee, expected_release_date }]
// brands: [{ id, name }]  — 활성 브랜드만
// roles: [{ brand_id }]   — user_brand_roles 행
export function computeActionItems({ requirements, brands, roles } = {}) {
  const reqs = requirements ?? [];
  const brandList = brands ?? [];
  const roleList = roles ?? [];

  // 판정식은 ACTION_PREDICATES 가 갖고 있다. 주간 요약 메일이 같은 것을 읽는다.
  const unassignedReview = reqs.filter(ACTION_PREDICATES.unassignedReview).length;
  const noExpectedDate = reqs.filter(ACTION_PREDICATES.noExpectedDate).length;

  // 팀원이 한 명도 배치되지 않은 브랜드. 이 브랜드는 아무도 로그인할 수 없어서
  // 가입 알림조차 오지 않는다 — 여기서 말해주지 않으면 영원히 모른다.
  const brandsWithMembers = new Set(roleList.map((r) => r.brand_id));
  const emptyBrands = brandList.filter((b) => !brandsWithMembers.has(b.id));

  const items = [
    {
      key: 'unassignedReview',
      count: unassignedReview,
      label: '담당자 없는 검토대기',
      href: '/requirements?status=검토대기&missing=assignee',
      severity: 'warning',
    },
    {
      key: 'noExpectedDate',
      count: noExpectedDate,
      label: '예상일 없는 진행 건',
      href: '/requirements?missing=expectedDate',
      severity: 'warning',
    },
    {
      // 층을 나눈 대가로 생긴 실패 지점. MOA 에는 개발중으로 남아 있는데
      // 레드마인에 티켓이 없으면 브랜드는 기다리고 실제로는 아무 일도
      // 일어나지 않는다. danger 인 이유가 이것이다 — 다른 둘은 불편이지만
      // 이건 요청이 조용히 증발한 상태다.
      key: 'unlinkedHandoff',
      count: unlinkedHandoffs(reqs).length,
      label: '레드마인에 안 넘어간 진행 건',
      href: '/requirements?missing=redmine',
      severity: 'danger',
    },
    {
      key: 'emptyBrand',
      count: emptyBrands.length,
      names: emptyBrands.map((b) => b.name),
      label: '팀원 없는 브랜드',
      href: '/admin/brands',
      severity: 'danger',
    },
  ];

  return items.filter((i) => i.count > 0);
}

// 브랜드별 도입 단계.
//
// 세 단계로 나누는 이유는 처방이 다르기 때문이다. '배치만 됨'은 계정이 있는데
// 안 쓰는 것이라 독려가 필요하고, '시작 안 함'은 아무도 들어올 수 없는 것이라
// 계정 발급이 필요하다. 둘을 "요구사항 0건" 으로 묶으면 무엇을 해야 할지
// 알 수 없다.
//
// 사용 중인 브랜드를 위로 올린다. 아래로 갈수록 손이 필요한 순서다.
export function computeAdoption({ brands, requirements, roles } = {}) {
  const reqs = requirements ?? [];
  const roleList = roles ?? [];

  const rows = (brands ?? []).map((brand) => {
    const requirementCount = reqs.filter((r) => r.brand_id === brand.id).length;
    const memberCount = roleList.filter((r) => r.brand_id === brand.id).length;
    const level = requirementCount > 0 ? 'active' : memberCount > 0 ? 'assigned' : 'empty';
    return { brandId: brand.id, brandName: brand.name, requirementCount, memberCount, level };
  });

  const order = { active: 0, assigned: 1, empty: 2 };
  return rows.sort(
    (a, b) => order[a.level] - order[b.level] || b.requirementCount - a.requirementCount
  );
}

// 상태별 건수. 흐름 막대에 쓴다.
//
// 종결 상태(반려·취소·중복)는 뺀다 — 흐름이 아니라 흐름에서 빠져나간 것이다.
// 완료는 남긴다. 끝까지 도는지가 이 그림의 요점이라 마지막 칸이 있어야 한다.
//
// isPeak 은 "지금 병목이 어디인가" 다. 건수가 가장 많은 칸 하나에만 붙는다.
// 전부 0이면 아무 칸도 병목이 아니다 — 0을 강조하면 그림이 거짓말을 한다.
export function computeStatusFlow(requirements) {
  const reqs = requirements ?? [];
  const counts = BOARD_STATUSES.map((status) => ({
    status,
    count: reqs.filter((r) => r.status === status).length,
  }));

  const max = Math.max(...counts.map((c) => c.count), 0);
  return counts.map((c) => ({ ...c, isPeak: max > 0 && c.count === max }));
}
