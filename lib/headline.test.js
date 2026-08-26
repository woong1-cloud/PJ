import { describe, expect, it } from 'vitest';
import { headline } from './headline';

const TODAY = '2026-08-26';
const it3 = { tier: '3차', memberId: 'staff' };
const requester = { tier: '4차', memberId: 'owner' };

const req = (over = {}) => ({
  status: '검토대기',
  assignee: null,
  requester: { id: 'owner' },
  is_confidential: false,
  expected_release_date: null,
  created_at: '2026-08-24T00:00:00Z',
  completed_at: null,
  ...over,
});

describe('headline — 경과', () => {
  it('정체는 며칠째 멈췄는지 말한다', () => {
    const got = headline({ requirement: req(), stalledDays: 20, viewer: it3, today: TODAY });
    expect(got.elapsed).toBe('20일째 멈춤');
    expect(got.tone).toBe('stall');
  });

  it('오늘 들어온 건', () => {
    const got = headline({ requirement: req(), stalledDays: 0, viewer: it3, today: TODAY });
    expect(got.elapsed).toBe('오늘 접수');
  });

  it('며칠 안 된 건', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.elapsed).toBe('3일째');
    expect(got.tone).toBe('wait');
  });

  it('완료는 경과가 아니라 소요를 말한다', () => {
    const got = headline({
      requirement: req({
        status: '완료',
        created_at: '2026-08-18T00:00:00Z',
        completed_at: '2026-08-26T00:00:00Z',
      }),
      stalledDays: null,
      viewer: it3,
      today: TODAY,
    });
    expect(got.elapsed).toBe('8일 걸림');
    expect(got.tone).toBe('done');
  });

  it('완료일이 없으면 소요를 말하지 않는다', () => {
    const got = headline({
      requirement: req({ status: '완료', completed_at: null }),
      stalledDays: null,
      viewer: it3,
      today: TODAY,
    });
    expect(got.elapsed).toBeNull();
  });
});

describe('headline — 담당', () => {
  it('담당자가 있으면 이름을 말한다', () => {
    const got = headline({
      requirement: req({ assignee: { id: 'other', name: '장재혁' } }),
      stalledDays: 3,
      viewer: it3,
      today: TODAY,
    });
    expect(got.assigneeText).toBe('담당 장재혁');
  });

  it('실무자에게는 담당자 없음', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.assigneeText).toBe('담당자 없음');
  });

  it('요청자에게는 기다리는 중이라고 말한다', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: requester, today: TODAY });
    expect(got.assigneeText).toBe('담당자를 기다리고 있습니다');
  });

  it('승인대기에서 담당자 본인이면 다른 사람을 기다린다고 말한다', () => {
    const got = headline({
      requirement: req({ status: '승인대기', assignee: { id: 'staff', name: '장재혁' } }),
      stalledDays: 3,
      viewer: it3,
      today: TODAY,
    });
    expect(got.assigneeText).toBe('다른 사람의 승인을 기다립니다');
    expect(got.action).toBeNull();
  });
});

describe('headline — 행동', () => {
  it('실무자는 주 버튼을 본다', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.action).toEqual({ kind: 'primary' });
  });

  it('요청자는 자기 건을 거둘 수 있다', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: requester, today: TODAY });
    expect(got.action).toEqual({ kind: 'cancel' });
  });

  it('남의 건은 거둘 수 없다', () => {
    const got = headline({
      requirement: req({ requester: { id: 'someone-else' } }),
      stalledDays: 3,
      viewer: requester,
      today: TODAY,
    });
    expect(got.action).toBeNull();
  });

  it('작성중이면 요청자가 검토 요청을 본다', () => {
    const got = headline({
      requirement: req({ status: '작성중' }),
      stalledDays: 1,
      viewer: requester,
      today: TODAY,
    });
    expect(got.action).toEqual({ kind: 'primary' });
  });

  it('승인대기면 요청자도 승인 버튼을 본다', () => {
    const got = headline({
      requirement: req({ status: '승인대기', assignee: { id: 'staff', name: '장재혁' } }),
      stalledDays: 2,
      viewer: requester,
      today: TODAY,
    });
    expect(got.action).toEqual({ kind: 'primary' });
  });

  it('병합된 건에는 행동이 없다', () => {
    const got = headline({
      requirement: req({ status: '중복' }),
      stalledDays: null,
      viewer: it3,
      today: TODAY,
    });
    expect(got.action).toBeNull();
  });

  it('종결 건은 요청자가 거둘 수 없다', () => {
    const got = headline({
      requirement: req({ status: '반려' }),
      stalledDays: null,
      viewer: requester,
      today: TODAY,
    });
    expect(got.action).toBeNull();
  });
});

describe('headline — 알약', () => {
  it('기밀', () => {
    const got = headline({
      requirement: req({ is_confidential: true }),
      stalledDays: 3,
      viewer: it3,
      today: TODAY,
    });
    expect(got.badges).toContain('비공개');
  });

  it('예상일이 지나면 지연', () => {
    const got = headline({
      requirement: req({ status: '개발중', expected_release_date: '2026-08-20' }),
      stalledDays: 3,
      viewer: it3,
      today: TODAY,
    });
    expect(got.badges).toContain('⚠ 예상일 2026-08-20 지남');
  });

  it('종결 건은 예상일이 지나도 지연이 아니다', () => {
    const got = headline({
      requirement: req({
        status: '완료',
        expected_release_date: '2026-08-20',
        completed_at: '2026-08-26T00:00:00Z',
      }),
      stalledDays: null,
      viewer: it3,
      today: TODAY,
    });
    expect(got.badges).toEqual([]);
  });

  it('알약이 없으면 빈 배열', () => {
    const got = headline({ requirement: req(), stalledDays: 3, viewer: it3, today: TODAY });
    expect(got.badges).toEqual([]);
  });
});

describe('headline — 빈 입력', () => {
  it('요구사항이 없으면 죽지 않는다', () => {
    const got = headline({ requirement: null, viewer: it3, today: TODAY });
    expect(got.action).toBeNull();
    expect(got.badges).toEqual([]);
  });
});
