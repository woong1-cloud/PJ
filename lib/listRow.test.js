import { describe, expect, it } from 'vitest';
import { listRow } from './listRow';

const req = (over = {}) => ({
  id: 'r1',
  title: '타임세일',
  status: '검토대기',
  channel: '자사몰',
  requirement_type: '개선',
  priority: '중',
  category: { id: 'c1', category_name: '프로모션' },
  assignee: null,
  requester: { id: 'p1', name: '박천주' },
  created_at: '2026-07-30T00:00:00Z',
  completed_at: null,
  ...over,
});

describe('listRow — 채널 뱃지', () => {
  it('자사몰은 그리지 않는다 — 47건 중 44건이라 뱃지가 소음이 된다', () => {
    expect(listRow({ requirement: req() }).channelBadge).toBeNull();
  });

  it('외부몰은 그린다', () => {
    expect(listRow({ requirement: req({ channel: '외부몰' }) }).channelBadge).toBe('외부몰');
  });

  it("DB 기본값 '공통'도 그린다 — 조용히 둘 채널은 자사몰 하나뿐이다", () => {
    expect(listRow({ requirement: req({ channel: '공통' }) }).channelBadge).toBe('공통');
  });

  it('채널이 비어 있으면 그리지 않는다', () => {
    expect(listRow({ requirement: req({ channel: null }) }).channelBadge).toBeNull();
  });
});

describe('listRow — 손이 필요한 줄', () => {
  it('정체 14일 이상이면 stall', () => {
    expect(listRow({ requirement: req(), stalledDays: 20 }).flag).toBe('stall');
  });

  it('담당자가 없고 미종결이면 unassigned', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).flag).toBe('unassigned');
  });

  it('정체와 담당 없음이 겹치면 stall 이 이긴다 — 더 급한 쪽이다', () => {
    expect(listRow({ requirement: req({ assignee: null }), stalledDays: 20 }).flag).toBe('stall');
  });

  it('담당자가 있고 정체가 아니면 표시가 없다', () => {
    const got = listRow({
      requirement: req({ assignee: { id: 'm1', name: '장재혁' } }),
      stalledDays: 3,
    });
    expect(got.flag).toBeNull();
  });

  it('종결 건은 표시가 없다 — 끝난 일에 경고를 달면 안 된다', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(listRow({ requirement: req({ status }), stalledDays: null }).flag, status).toBeNull();
    }
  });
});

describe('listRow — 경과', () => {
  it('정체는 며칠째 멈췄는지', () => {
    expect(listRow({ requirement: req(), stalledDays: 29 }).elapsed).toBe('29일째 멈춤');
  });

  it('오늘 들어온 건', () => {
    expect(listRow({ requirement: req(), stalledDays: 0 }).elapsed).toBe('오늘');
  });

  it('며칠 안 된 건', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).elapsed).toBe('3일째');
  });

  it('완료는 경과가 아니라 소요를 말한다', () => {
    const got = listRow({
      requirement: req({
        status: '완료',
        created_at: '2026-08-18T00:00:00Z',
        completed_at: '2026-08-26T00:00:00Z',
      }),
      stalledDays: null,
    });
    expect(got.elapsed).toBe('8일 걸림');
  });

  it('반려는 상태 이름을 말한다', () => {
    expect(listRow({ requirement: req({ status: '반려' }), stalledDays: null }).elapsed).toBe(
      '반려'
    );
  });
});

describe('listRow — 종결 사유', () => {
  it('사유 첫머리가 tail 에 들어간다', () => {
    const got = listRow({
      requirement: req({ status: '반려' }),
      closure: { reason: '위치정보 사업자 신고 선행 필요' },
    });
    expect(got.tail).toBe('위치정보 사업자 신고 선행 필요');
  });

  it('28자에서 자른다 — 행은 한 줄이라 넘치면 제목을 밀어낸다', () => {
    const got = listRow({
      requirement: req({ status: '반려' }),
      closure: { reason: '가'.repeat(50) },
    });
    expect(got.tail.length).toBe(29);
    expect(got.tail.endsWith('…')).toBe(true);
  });

  it('사유가 없으면 null', () => {
    expect(listRow({ requirement: req({ status: '반려' }) }).tail).toBeNull();
  });
});

describe('listRow — 메타와 담당자', () => {
  it('메타는 카테고리·유형·우선·요청자 순이다', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).meta).toEqual([
      '프로모션',
      '개선',
      '중',
      '박천주',
    ]);
  });

  it('빈 값은 메타에서 빠진다', () => {
    const got = listRow({
      requirement: req({ category: null, priority: null }),
      stalledDays: 3,
    });
    expect(got.meta).toEqual(['개선', '박천주']);
  });

  it('담당자가 있으면 이름과 머리글자', () => {
    const got = listRow({
      requirement: req({ assignee: { id: 'm1', name: '장재혁' } }),
      stalledDays: 3,
    });
    expect(got.assignee).toEqual({ name: '장재혁', initial: '장' });
  });

  it('담당자가 없으면 null', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).assignee).toBeNull();
  });
});

describe('listRow — 어조', () => {
  it('정체는 stall', () => {
    expect(listRow({ requirement: req(), stalledDays: 20 }).tone).toBe('stall');
  });

  it('검토대기는 wait', () => {
    expect(listRow({ requirement: req(), stalledDays: 3 }).tone).toBe('wait');
  });

  it('완료는 done', () => {
    expect(listRow({ requirement: req({ status: '완료' }), stalledDays: null }).tone).toBe('done');
  });
});

describe('listRow — 빈 입력', () => {
  it('요구사항이 없어도 죽지 않는다', () => {
    const got = listRow({ requirement: null });
    expect(got.flag).toBeNull();
    expect(got.meta).toEqual([]);
  });
});
