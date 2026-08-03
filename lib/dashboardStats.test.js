import { describe, expect, it } from 'vitest';
import {
  MIN_COMPLETED_FOR_AVG,
  computeActionItems,
  computeAdoption,
  computeDashboardStats,
  computeStatusFlow,
} from './dashboardStats';

const BRANDS = [
  { id: 'b1', name: '스파오' },
  { id: 'b2', name: '뉴발란스' },
];

describe('computeDashboardStats', () => {
  it('브랜드/요구사항이 없으면 빈 결과를 반환한다', () => {
    const result = computeDashboardStats({ requirements: [], brands: [], periodDays: 7, today: '2026-07-24' });
    expect(result).toEqual({
      overall: { brandCount: 0, openCount: 0, completedInPeriod: 0 },
      byBrand: [],
    });
  });

  it('브랜드는 있지만 요구사항이 없으면 전부 0/null이다', () => {
    const result = computeDashboardStats({ requirements: [], brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    expect(result.byBrand).toEqual([
      { brandId: 'b1', brandName: '스파오', openCount: 0, newInPeriod: 0, completedInPeriod: 0, avgCompletionDays: null },
      { brandId: 'b2', brandName: '뉴발란스', openCount: 0, newInPeriod: 0, completedInPeriod: 0, avgCompletionDays: null },
    ]);
  });

  it('미해결은 완료/중복을 제외하고 기간과 무관하게 집계한다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '작성중', request_date: '2020-01-01', completed_at: null },
      { id: '2', brand_id: 'b1', status: '개발중', request_date: '2020-01-01', completed_at: null },
      { id: '3', brand_id: 'b1', status: '완료', request_date: '2020-01-01', completed_at: '2020-01-05T00:00:00Z' },
      { id: '4', brand_id: 'b1', status: '중복', request_date: '2020-01-01', completed_at: null },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    const spao = result.byBrand.find((b) => b.brandId === 'b1');
    expect(spao.openCount).toBe(2);
  });

  it('신규는 request_date가 기준일(오늘-periodDays) 이후인 건만 센다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '작성중', request_date: '2026-07-20', completed_at: null },
      { id: '2', brand_id: 'b1', status: '작성중', request_date: '2026-07-01', completed_at: null },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    const spao = result.byBrand.find((b) => b.brandId === 'b1');
    expect(spao.newInPeriod).toBe(1);
  });

  it('완료는 completed_at 날짜가 기준일 이후인 건만 센다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '완료', request_date: '2026-07-01', completed_at: '2026-07-20T03:00:00Z' },
      { id: '2', brand_id: 'b1', status: '완료', request_date: '2026-07-01', completed_at: '2026-07-01T03:00:00Z' },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    const spao = result.byBrand.find((b) => b.brandId === 'b1');
    expect(spao.completedInPeriod).toBe(1);
  });

  it('평균 소요일을 올바르게 계산한다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '완료', request_date: '2026-07-18', completed_at: '2026-07-20T00:00:00Z' },
      { id: '2', brand_id: 'b1', status: '완료', request_date: '2026-07-16', completed_at: '2026-07-20T00:00:00Z' },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    const spao = result.byBrand.find((b) => b.brandId === 'b1');
    expect(spao.avgCompletionDays).toBe(3);
  });

  it('기간 내 완료가 0건이면 평균 소요일은 null이다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '작성중', request_date: '2026-07-20', completed_at: null },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    const spao = result.byBrand.find((b) => b.brandId === 'b1');
    expect(spao.avgCompletionDays).toBeNull();
  });

  it('periodDays가 null(전체)이면 날짜와 무관하게 전부 포함한다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '완료', request_date: '2020-01-01', completed_at: '2020-01-05T00:00:00Z' },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: null, today: '2026-07-24' });
    const spao = result.byBrand.find((b) => b.brandId === 'b1');
    expect(spao.newInPeriod).toBe(1);
    expect(spao.completedInPeriod).toBe(1);
  });

  it('overall 합계는 byBrand 합의 합과 같다', () => {
    const requirements = [
      { id: '1', brand_id: 'b1', status: '작성중', request_date: '2026-07-20', completed_at: null },
      { id: '2', brand_id: 'b2', status: '개발중', request_date: '2026-07-20', completed_at: null },
      { id: '3', brand_id: 'b1', status: '완료', request_date: '2026-07-18', completed_at: '2026-07-20T00:00:00Z' },
    ];
    const result = computeDashboardStats({ requirements, brands: BRANDS, periodDays: 7, today: '2026-07-24' });
    expect(result.overall).toEqual({ brandCount: 2, openCount: 2, completedInPeriod: 1 });
  });
});

describe('computeActionItems', () => {
  const BR = [
    { id: 'b1', name: '스파오' },
    { id: 'b2', name: '뉴발란스' },
  ];

  it('담당자 없는 검토대기만 센다 — 다른 상태는 빠진다', () => {
    const reqs = [
      { brand_id: 'b1', status: '검토대기', assignee: null, expected_release_date: '2026-08-10' },
      { brand_id: 'b1', status: '검토대기', assignee: 'm1', expected_release_date: '2026-08-10' },
      { brand_id: 'b1', status: '개발중', assignee: null, expected_release_date: '2026-08-10' },
    ];
    const items = computeActionItems({ requirements: reqs, brands: BR, roles: [{ brand_id: 'b1' }, { brand_id: 'b2' }] });
    expect(items.find((i) => i.key === 'unassignedReview').count).toBe(1);
  });

  it('예상일 없는 진행 건은 종결 상태를 빼고 센다', () => {
    const reqs = [
      { brand_id: 'b1', status: '검토대기', assignee: 'm1', expected_release_date: null },
      { brand_id: 'b1', status: '완료', assignee: 'm1', expected_release_date: null },
      { brand_id: 'b1', status: '반려', assignee: 'm1', expected_release_date: null },
      { brand_id: 'b1', status: '중복', assignee: 'm1', expected_release_date: null },
    ];
    const items = computeActionItems({ requirements: reqs, brands: BR, roles: [{ brand_id: 'b1' }, { brand_id: 'b2' }] });
    expect(items.find((i) => i.key === 'noExpectedDate').count).toBe(1);
  });

  it('팀원이 배치되지 않은 브랜드를 이름과 함께 알려준다', () => {
    const items = computeActionItems({ requirements: [], brands: BR, roles: [{ brand_id: 'b1' }] });
    const row = items.find((i) => i.key === 'emptyBrand');
    expect(row.count).toBe(1);
    expect(row.names).toEqual(['뉴발란스']);
  });

  it('0인 항목은 목록에서 빠진다', () => {
    const reqs = [{ brand_id: 'b1', status: '검토대기', assignee: 'm1', expected_release_date: '2026-08-10' }];
    const items = computeActionItems({ requirements: reqs, brands: BR, roles: [{ brand_id: 'b1' }, { brand_id: 'b2' }] });
    expect(items).toEqual([]);
  });

  it('입력이 비어 있어도 터지지 않는다', () => {
    expect(computeActionItems({})).toEqual([]);
    expect(computeActionItems()).toEqual([]);
  });
});

describe('computeAdoption', () => {
  const BR = [
    { id: 'b1', name: '스파오' },
    { id: 'b2', name: '미쏘' },
    { id: 'b3', name: '뉴발란스' },
  ];
  const reqs = [{ brand_id: 'b1' }, { brand_id: 'b1' }];
  const roles = [{ brand_id: 'b1' }, { brand_id: 'b1' }, { brand_id: 'b2' }];

  it('세 단계로 나눈다 — 처방이 다르기 때문이다', () => {
    const rows = computeAdoption({ brands: BR, requirements: reqs, roles });
    expect(rows.map((r) => [r.brandName, r.level])).toEqual([
      ['스파오', 'active'],
      ['미쏘', 'assigned'],
      ['뉴발란스', 'empty'],
    ]);
  });

  it('건수와 인원을 함께 돌려준다', () => {
    const rows = computeAdoption({ brands: BR, requirements: reqs, roles });
    expect(rows[0]).toMatchObject({ requirementCount: 2, memberCount: 2 });
    expect(rows[2]).toMatchObject({ requirementCount: 0, memberCount: 0 });
  });

  it('사용 중인 브랜드가 먼저 온다', () => {
    const rows = computeAdoption({ brands: [BR[2], BR[1], BR[0]], requirements: reqs, roles });
    expect(rows[0].brandName).toBe('스파오');
    expect(rows[2].brandName).toBe('뉴발란스');
  });

  it('입력이 비어 있어도 터지지 않는다', () => {
    expect(computeAdoption({})).toEqual([]);
    expect(computeAdoption()).toEqual([]);
  });
});

describe('computeStatusFlow', () => {
  it('보드 상태 순서를 유지하고 종결 상태는 뺀다', () => {
    const reqs = [
      { status: '검토대기' },
      { status: '검토대기' },
      { status: '작성중' },
      { status: '반려' },
      { status: '중복' },
      { status: '취소' },
    ];
    const flow = computeStatusFlow(reqs);
    expect(flow.map((f) => f.status)).toEqual([
      '작성중',
      '검토대기',
      '검토중',
      '개발중',
      'QA중',
      '승인대기',
      '완료',
    ]);
    expect(flow.find((f) => f.status === '검토대기').count).toBe(2);
  });

  it('가장 많은 칸을 표시한다 — 그게 병목이다', () => {
    const flow = computeStatusFlow([{ status: '검토대기' }, { status: '검토대기' }, { status: '작성중' }]);
    expect(flow.find((f) => f.status === '검토대기').isPeak).toBe(true);
    expect(flow.find((f) => f.status === '작성중').isPeak).toBe(false);
  });

  it('전부 0이면 어느 칸도 병목이 아니다', () => {
    const flow = computeStatusFlow([]);
    expect(flow.every((f) => f.count === 0)).toBe(true);
    expect(flow.some((f) => f.isPeak)).toBe(false);
  });

  it('입력이 없어도 터지지 않는다', () => {
    expect(computeStatusFlow().length).toBe(7);
  });
});

describe('MIN_COMPLETED_FOR_AVG', () => {
  it('1~2건의 평균은 평균이 아니다', () => {
    expect(MIN_COMPLETED_FOR_AVG).toBe(3);
  });
});

describe('computeActionItems — 레드마인 인계', () => {
  const BR = [{ id: 'b1', name: '스파오' }];
  const ROLES = [{ brand_id: 'b1' }];
  const base = { brand_id: 'b1', assignee: 'm1', expected_release_date: '2026-08-10' };

  it('개발중인데 레드마인 주소가 없으면 센다', () => {
    const reqs = [
      { ...base, status: '개발중', redmine_url: null },
      { ...base, status: 'QA중', redmine_url: null },
      { ...base, status: '개발중', redmine_url: 'https://r/1' },
    ];
    const items = computeActionItems({ requirements: reqs, brands: BR, roles: ROLES });
    expect(items.find((i) => i.key === 'unlinkedHandoff').count).toBe(2);
  });

  it('검토중은 세지 않는다 — 반려로 끝날 수 있다', () => {
    const reqs = [{ ...base, status: '검토중', redmine_url: null }];
    const items = computeActionItems({ requirements: reqs, brands: BR, roles: ROLES });
    expect(items.find((i) => i.key === 'unlinkedHandoff')).toBeUndefined();
  });

  it('danger 로 표시한다 — 요청이 조용히 증발한 상태다', () => {
    const reqs = [{ ...base, status: '개발중', redmine_url: null }];
    const items = computeActionItems({ requirements: reqs, brands: BR, roles: ROLES });
    expect(items.find((i) => i.key === 'unlinkedHandoff').severity).toBe('danger');
  });
});
