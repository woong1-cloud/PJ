import { describe, it, expect } from 'vitest';
import { buildWeeklyDigest, digestSummaryLine, TOP_N } from './weeklyDigest';

const TODAY = '2026-08-17';

// 최소 필드만 채운 행. 각 테스트가 필요한 것만 덮어쓴다.
function req(over = {}) {
  return {
    id: over.id ?? 'r1',
    title: over.title ?? '제목',
    status: over.status ?? '검토대기',
    assignee: null,
    requester: null,
    request_date: '2026-08-01',
    expected_release_date: null,
    redmine_url: null,
    completed_at: null,
    ...over,
  };
}

describe('buildWeeklyDigest', () => {
  it('손볼 것이 없으면 hasContent 가 false — 메일을 안 보낸다', () => {
    // "이번 주 0건" 메일이 오기 시작하면 그때부터 이 메일은 노이즈다.
    const digest = buildWeeklyDigest({ requirements: [], memberId: 'me', today: TODAY });
    expect(digest.hasContent).toBe(false);
    expect(digest.sections).toEqual([]);
  });

  it('지난주 활동만 있고 손볼 것이 없으면 안 보낸다', () => {
    // 완료된 건은 어느 판정식에도 안 걸린다. 그럼 보고서일 뿐이고,
    // 그 숫자는 대시보드에 늘 있다.
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'a', status: '완료', request_date: '2026-08-12', completed_at: '2026-08-14T00:00:00Z' }),
      ],
      memberId: 'me',
      today: TODAY,
    });
    expect(digest.doneCount).toBe(1);
    expect(digest.hasContent).toBe(false);
  });

  it('담당자 없는 검토대기를 오래 기다린 순으로 편다', () => {
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'new', title: '최근', request_date: '2026-08-15' }),
        req({ id: 'old', title: '오래됨', request_date: '2026-07-01' }),
      ],
      today: TODAY,
    });
    const s = digest.sections.find((x) => x.key === 'unassignedReview');
    expect(s.count).toBe(2);
    expect(s.items.map((i) => i.id)).toEqual(['old', 'new']);
    expect(s.items[0].daysWaiting).toBe(47);
  });

  it(`상위 ${TOP_N}건만 펼치고 나머지는 more 로 접는다`, () => {
    const rows = Array.from({ length: TOP_N + 3 }, (_, i) =>
      req({ id: `r${i}`, request_date: `2026-08-0${(i % 9) + 1}` })
    );
    const digest = buildWeeklyDigest({ requirements: rows, today: TODAY });
    const s = digest.sections.find((x) => x.key === 'unassignedReview');
    expect(s.count).toBe(TOP_N + 3);
    expect(s.items).toHaveLength(TOP_N);
    expect(s.more).toBe(3);
  });

  it('요청일이 없는 건은 뒤로 보낸다 — 가장 급한 자리를 차지하면 안 된다', () => {
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'nodate', request_date: null }),
        req({ id: 'dated', request_date: '2026-08-02' }),
      ],
      today: TODAY,
    });
    const s = digest.sections.find((x) => x.key === 'unassignedReview');
    expect(s.items.map((i) => i.id)).toEqual(['dated', 'nodate']);
    expect(s.items[1].daysWaiting).toBeNull();
  });

  it('앞 섹션에 나온 건은 뒤 섹션에서 다시 펼치지 않는다', () => {
    // 실데이터에서 '담당자 없는 검토대기 24건'과 '예상일 없는 진행 건 26건'의
    // 상위 다섯 건이 글자 하나까지 같았다. 두 번째 섹션이 새 정보 없이
    // 같은 제목만 반복하면 읽는 사람은 그 섹션을 통째로 건너뛴다.
    const digest = buildWeeklyDigest({
      requirements: [
        // 담당자도 예상일도 없다 — 두 섹션 모두에 걸린다
        req({ id: 'both', title: '둘 다', request_date: '2026-07-01' }),
        // 담당자는 있고 예상일만 없다 — 두 번째 섹션에만 걸린다
        req({ id: 'only2', title: '예상일만', status: '개발중', assignee: 'x', request_date: '2026-07-02' }),
      ],
      today: TODAY,
    });
    const [first, second] = digest.sections;
    expect(first.items.map((i) => i.id)).toEqual(['both']);
    // 개수는 진짜 개수다 — 대시보드와 어긋나면 안 된다
    expect(second.count).toBe(2);
    expect(second.overlap).toBe(1);
    expect(second.items.map((i) => i.id)).toEqual(['only2']);
  });

  it('겹치는 건수만 셀 뿐 개수는 줄이지 않는다', () => {
    const digest = buildWeeklyDigest({
      requirements: [req({ id: 'both', request_date: '2026-07-01' })],
      today: TODAY,
    });
    const second = digest.sections.find((s) => s.key === 'noExpectedDate');
    expect(second.count).toBe(1);
    expect(second.overlap).toBe(1);
    expect(second.items).toEqual([]);
    expect(second.more).toBe(0);
  });

  it('0건인 섹션은 아예 빠진다', () => {
    const digest = buildWeeklyDigest({
      requirements: [req({ id: 'a', expected_release_date: '2026-09-01' })],
      today: TODAY,
    });
    expect(digest.sections.map((s) => s.key)).toEqual(['unassignedReview']);
  });

  it('내 담당 지연을 따로 담고 많이 넘긴 순으로 정렬한다', () => {
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'a', status: '개발중', assignee: 'me', expected_release_date: '2026-08-15' }),
        req({ id: 'b', status: '개발중', assignee: 'me', expected_release_date: '2026-08-01' }),
        req({ id: 'c', status: '개발중', assignee: 'other', expected_release_date: '2026-08-01' }),
      ],
      memberId: 'me',
      today: TODAY,
    });
    expect(digest.mine.map((m) => m.id)).toEqual(['b', 'a']);
    expect(digest.mine[0].daysOver).toBe(16);
  });

  it('종결된 내 담당 건은 지연이 아니다', () => {
    // 반려된 건을 독촉하는 메일이 되면 안 된다(isOverdue 와 같은 규칙).
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'a', status: '반려', assignee: 'me', expected_release_date: '2026-08-01' }),
      ],
      memberId: 'me',
      today: TODAY,
    });
    expect(digest.mine).toEqual([]);
  });

  it('assignee 가 조인 객체로 와도 내 것으로 잡는다', () => {
    // 목록 API 는 { id, name } 으로 주고 저장값은 uuid 문자열이다.
    const digest = buildWeeklyDigest({
      requirements: [
        req({
          id: 'a',
          status: '개발중',
          assignee: { id: 'me', name: '나' },
          expected_release_date: '2026-08-01',
        }),
      ],
      memberId: 'me',
      today: TODAY,
    });
    expect(digest.mine.map((m) => m.id)).toEqual(['a']);
  });

  it('memberId 가 없으면 개인화 없이 브랜드 전체만 담는다', () => {
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'a', status: '개발중', assignee: 'me', expected_release_date: '2026-08-01' }),
      ],
      today: TODAY,
    });
    expect(digest.mine).toEqual([]);
  });

  it('지난 7일 안의 신규·완료만 센다', () => {
    const digest = buildWeeklyDigest({
      requirements: [
        req({ id: 'in', request_date: '2026-08-11' }),
        req({ id: 'edge', request_date: '2026-08-10' }),
        req({ id: 'out', request_date: '2026-08-09' }),
      ],
      today: TODAY,
    });
    expect(digest.newCount).toBe(2);
  });

  it('빈 입력에 터지지 않는다', () => {
    expect(() => buildWeeklyDigest()).not.toThrow();
    expect(buildWeeklyDigest().hasContent).toBe(false);
    expect(buildWeeklyDigest({ requirements: null, today: TODAY }).sections).toEqual([]);
  });
});

describe('digestSummaryLine', () => {
  it('활동이 있으면 숫자를 적는다', () => {
    expect(digestSummaryLine({ newCount: 4, doneCount: 1 })).toBe(
      '지난 한 주 새 요구사항 4건, 완료 1건.'
    );
  });

  it('둘 다 0이면 그렇다고 말한다 — 숫자 0 두 개보다 읽힌다', () => {
    expect(digestSummaryLine({ newCount: 0, doneCount: 0 })).toBe(
      '지난 한 주 새 요구사항과 완료 건이 없었습니다.'
    );
    expect(digestSummaryLine()).toBe('지난 한 주 새 요구사항과 완료 건이 없었습니다.');
  });
});
