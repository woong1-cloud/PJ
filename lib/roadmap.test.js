import { describe, it, expect } from 'vitest';
import { buildRoadmap, monthTicks, projectSpan, roadmapWindow, spanGeometry } from './roadmap';

// 로드맵의 위험은 "그럴듯한데 틀린 그림"이다. 막대가 한 달 밀려 있어도
// 화면은 아무 불평 없이 예쁘게 그려진다. 그래서 눈으로 확인할 수 없는
// 자리 계산을 전부 여기서 못 박는다.

describe('projectSpan — 날짜가 반쯤 채워진 프로젝트', () => {
  it('둘 다 있으면 기간이다', () => {
    expect(projectSpan({ start_date: '2026-07-01', target_date: '2026-08-31' })).toEqual({
      kind: 'range',
      start: '2026-07-01',
      end: '2026-08-31',
    });
  });

  // 실무에서 흔한 상태다 — 목표일만 먼저 잡히고 착수일은 나중에 정해진다.
  // 이때 막대를 '오늘부터 목표일까지'로 임의 연장하면, 아무도 정하지 않은
  // 착수일을 시스템이 정해 준 것처럼 보인다. 점 하나로만 찍는다.
  it('목표일만 있으면 마일스톤 한 점이다', () => {
    expect(projectSpan({ target_date: '2026-08-31' })).toEqual({
      kind: 'milestone',
      start: '2026-08-31',
      end: '2026-08-31',
    });
  });

  it('시작일만 있어도 마일스톤 한 점이다', () => {
    expect(projectSpan({ start_date: '2026-07-01' })).toEqual({
      kind: 'milestone',
      start: '2026-07-01',
      end: '2026-07-01',
    });
  });

  it('날짜가 없으면 그릴 수 없다', () => {
    expect(projectSpan({})).toBeNull();
    expect(projectSpan({ start_date: null, target_date: null })).toBeNull();
    expect(projectSpan(null)).toBeNull();
  });

  // DB CHECK 로 막았지만 기존 데이터나 직접 호출로 들어올 수 있다.
  // 막대 폭이 음수가 되면 CSS 가 조용히 0 으로 만들어 보이지 않는다.
  it('목표일이 시작일보다 앞서면 순서를 바로잡는다', () => {
    expect(projectSpan({ start_date: '2026-08-31', target_date: '2026-07-01' })).toEqual({
      kind: 'range',
      start: '2026-07-01',
      end: '2026-08-31',
    });
  });
});

describe('roadmapWindow — 가로축 범위', () => {
  it('모든 날짜를 담되 월 경계로 맞춘다', () => {
    expect(roadmapWindow(['2026-07-15', '2026-09-03'], '2026-07-20')).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    });
  });

  // 오늘이 안 보이는 로드맵은 "지금 어디쯤인지"를 답하지 못한다.
  it('오늘이 범위 밖이면 오늘까지 넓힌다', () => {
    expect(roadmapWindow(['2026-09-01', '2026-09-30'], '2026-07-20').start).toBe('2026-07-01');
  });

  // 한 프로젝트가 2주짜리면 창이 한 달이 되고, 막대가 화면을 꽉 채워
  // 기간처럼 안 보인다. 최소 3개월은 확보한다.
  it('너무 좁으면 최소 3개월로 넓힌다', () => {
    expect(roadmapWindow(['2026-07-10', '2026-07-20'], '2026-07-15')).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    });
  });

  it('날짜가 없으면 오늘을 포함한 3개월을 준다', () => {
    expect(roadmapWindow([], '2026-07-20')).toEqual({ start: '2026-07-01', end: '2026-09-30' });
  });

  it('연도를 넘어가도 12월 다음은 1월이다', () => {
    expect(roadmapWindow(['2026-12-10', '2027-01-05'], '2026-12-01')).toEqual({
      start: '2026-12-01',
      end: '2027-02-28',
    });
  });
});

describe('monthTicks — 월 구분선', () => {
  const win = { start: '2026-07-01', end: '2026-09-30' };

  it('창 안의 모든 월을 폭에 비례해 나눈다', () => {
    const ticks = monthTicks(win);
    expect(ticks.map((t) => t.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(ticks[0].leftPct).toBe(0);
    // 7월 31일 / 전체 92일
    expect(ticks[0].widthPct).toBeCloseTo((31 / 92) * 100, 6);
    // 마지막 눈금의 오른쪽 끝은 정확히 100% 여야 한다. 어긋나면 축과 막대가
    // 미세하게 안 맞고, 그 오차는 창이 길어질수록 커진다.
    const last = ticks[ticks.length - 1];
    expect(last.leftPct + last.widthPct).toBeCloseTo(100, 6);
  });

  // 연도는 1월과 첫 눈금에만 붙인다. 모든 눈금에 붙이면 축이 글자로 꽉 차고,
  // 아무 데도 안 붙이면 12월 다음 1월이 같은 해처럼 읽힌다.
  it('1월과 첫 눈금에 연도를 붙인다', () => {
    expect(monthTicks(win).map((t) => t.label)).toEqual(['2026년 7월', '8월', '9월']);
    expect(monthTicks({ start: '2026-12-01', end: '2027-01-31' }).map((t) => t.label)).toEqual([
      '2026년 12월',
      '2027년 1월',
    ]);
  });
});

describe('spanGeometry — 막대 자리', () => {
  const win = { start: '2026-07-01', end: '2026-09-30' }; // 92일

  it('창 전체를 덮는 기간은 0~100%다', () => {
    const g = spanGeometry({ start: '2026-07-01', end: '2026-09-30' }, win);
    expect(g.leftPct).toBe(0);
    expect(g.widthPct).toBeCloseTo(100, 6);
  });

  // 하루짜리 기간의 폭은 0 이 아니라 1/92 이다. 끝일을 포함하지 않으면
  // 하루 일정이 화면에서 사라진다.
  it('하루짜리도 하루만큼의 폭이 있다', () => {
    const g = spanGeometry({ start: '2026-07-01', end: '2026-07-01' }, win);
    expect(g.widthPct).toBeCloseTo((1 / 92) * 100, 6);
  });

  it('8월 1일은 31/92 지점에서 시작한다', () => {
    const g = spanGeometry({ start: '2026-08-01', end: '2026-08-31' }, win);
    expect(g.leftPct).toBeCloseTo((31 / 92) * 100, 6);
    expect(g.widthPct).toBeCloseTo((31 / 92) * 100, 6);
  });

  // 창은 보통 모든 날짜를 덮지만, 요구사항 날짜만 바뀌는 경우 등으로
  // 밖으로 삐져나갈 수 있다. 잘라내되 잘렸다는 사실은 남긴다.
  it('창을 벗어나면 잘라내고 표시를 남긴다', () => {
    const g = spanGeometry({ start: '2026-05-01', end: '2026-11-30' }, win);
    expect(g.leftPct).toBe(0);
    expect(g.widthPct).toBeCloseTo(100, 6);
    expect(g.clippedStart).toBe(true);
    expect(g.clippedEnd).toBe(true);
  });

  it('창 안에 완전히 들어오면 잘린 곳이 없다', () => {
    const g = spanGeometry({ start: '2026-08-01', end: '2026-08-10' }, win);
    expect(g.clippedStart).toBe(false);
    expect(g.clippedEnd).toBe(false);
  });

  it('창과 전혀 겹치지 않으면 그릴 것이 없다', () => {
    expect(spanGeometry({ start: '2027-01-01', end: '2027-01-31' }, win)).toBeNull();
    expect(spanGeometry(null, win)).toBeNull();
  });
});

describe('buildRoadmap', () => {
  const projects = [
    { id: 'p1', name: '공홈 빠른배송', start_date: '2026-07-01', target_date: '2026-08-31' },
    { id: 'p2', name: '목표만 있는 건', start_date: null, target_date: '2026-09-15' },
    { id: 'p3', name: '기간 미정', start_date: null, target_date: null },
  ];
  const requirements = [
    { id: 'r1', title: '배송 문구', project_id: 'p1', status: '개발중', expected_release_date: '2026-08-01' },
    { id: 'r2', title: '지연된 건', project_id: 'p1', status: '개발중', expected_release_date: '2026-07-05' },
    { id: 'r3', title: '날짜 없음', project_id: 'p1', status: '검토대기', expected_release_date: null },
    { id: 'r4', title: '완료된 건', project_id: 'p1', status: '완료', expected_release_date: '2026-07-10' },
    { id: 'r5', title: '남의 건', project_id: 'p9', status: '개발중', expected_release_date: '2026-08-02' },
  ];

  const result = buildRoadmap({ projects, requirements, todayIso: '2026-07-20' });

  it('날짜가 있는 프로젝트만 차트에 올린다', () => {
    expect(result.rows.map((r) => r.id)).toEqual(['p1', 'p2']);
  });

  // 기간 미정 프로젝트를 그냥 빼면 "왜 안 보이지"가 된다. 따로 돌려준다.
  it('기간 미정 프로젝트는 사라지지 않고 따로 나온다', () => {
    expect(result.undated.map((p) => p.id)).toEqual(['p3']);
  });

  it('창은 프로젝트와 요구사항 날짜를 모두 담는다', () => {
    expect(result.window).toEqual({ start: '2026-07-01', end: '2026-09-30' });
  });

  it('막대는 자기 프로젝트의 요구사항만 점으로 찍는다', () => {
    const p1 = result.rows.find((r) => r.id === 'p1');
    expect(p1.markers.map((m) => m.id)).toEqual(['r2', 'r4', 'r1']);
  });

  it('배포예상일이 없는 요구사항은 찍을 자리가 없다', () => {
    const p1 = result.rows.find((r) => r.id === 'p1');
    expect(p1.markers.some((m) => m.id === 'r3')).toBe(false);
  });

  // 지연 판정은 목록 화면과 같은 함수(isOverdue)를 쓴다. 두 화면이 다른
  // 규칙으로 빨간색을 칠하면 어느 쪽을 믿어야 하는지 알 수 없다.
  it('지연된 건은 지연으로, 완료된 건은 지연이 아니다', () => {
    const p1 = result.rows.find((r) => r.id === 'p1');
    expect(p1.markers.find((m) => m.id === 'r2').overdue).toBe(true);
    expect(p1.markers.find((m) => m.id === 'r4').overdue).toBe(false);
  });

  it('오늘 자리를 알려준다', () => {
    expect(result.todayPct).toBeCloseTo((19 / 92) * 100, 6);
  });

  it('빈 입력에도 그릴 수 있는 창을 준다', () => {
    const empty = buildRoadmap({ projects: [], requirements: [], todayIso: '2026-07-20' });
    expect(empty.rows).toEqual([]);
    expect(empty.undated).toEqual([]);
    expect(empty.window).toEqual({ start: '2026-07-01', end: '2026-09-30' });
  });

  it('인자가 없어도 터지지 않는다', () => {
    expect(() => buildRoadmap({ todayIso: '2026-07-20' })).not.toThrow();
  });
});
