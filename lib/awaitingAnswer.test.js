import { describe, expect, it } from 'vitest';
import { awaitingAnswer, hasAnswered } from './awaitingAnswer';

const ASKED = '2026-09-01T00:00:00Z';
const req = (over = {}) => ({ requester: 'r1', awaiting_answer_since: ASKED, ...over });

describe('hasAnswered', () => {
  it('물어본 뒤 요청자가 말하면 답이 온 것이다', () => {
    expect(
      hasAnswered({
        requirement: req(),
        comments: [{ author: 'r1', created_at: '2026-09-02T00:00:00Z' }],
      })
    ).toBe(true);
  });

  it('물어보기 전의 요청자 코멘트는 답이 아니다', () => {
    // 물어본 이유가 그 말이 모자랐기 때문이다. 그것으로 풀면 물어보자마자
    // 다시 열린다.
    expect(
      hasAnswered({
        requirement: req(),
        comments: [{ author: 'r1', created_at: '2026-08-30T00:00:00Z' }],
      })
    ).toBe(false);
  });

  it('실무자가 말한 것은 답이 아니다', () => {
    expect(
      hasAnswered({
        requirement: req(),
        comments: [{ author: 'it1', created_at: '2026-09-02T00:00:00Z' }],
      })
    ).toBe(false);
  });

  it('embed 된 author 객체도 읽는다', () => {
    // 목록 API 는 문자열로, 조회 결과는 { id, name } 으로 온다. 한쪽만 알면
    // 답이 왔는데 조용히 안 풀린다.
    expect(
      hasAnswered({
        requirement: req(),
        comments: [{ author: { id: 'r1', name: '박천주' }, created_at: '2026-09-02T00:00:00Z' }],
      })
    ).toBe(true);
  });

  it('요청자가 embed 로 와도 읽는다', () => {
    expect(
      hasAnswered({
        requirement: req({ requester: { id: 'r1', name: '박천주' } }),
        comments: [{ author: 'r1', created_at: '2026-09-02T00:00:00Z' }],
      })
    ).toBe(true);
  });

  it('물어본 적이 없으면 언제나 거짓', () => {
    expect(
      hasAnswered({
        requirement: req({ awaiting_answer_since: null }),
        comments: [{ author: 'r1', created_at: '2026-09-02T00:00:00Z' }],
      })
    ).toBe(false);
  });

  it('읽을 수 없는 시각이면 거짓 — 물어보자마자 풀리면 안 된다', () => {
    expect(
      hasAnswered({
        requirement: req({ awaiting_answer_since: '깨진값' }),
        comments: [{ author: 'r1', created_at: '2026-09-02T00:00:00Z' }],
      })
    ).toBe(false);
  });

  it('요청자가 없는 건은 거짓', () => {
    expect(hasAnswered({ requirement: req({ requester: null }), comments: [] })).toBe(false);
  });

  it('코멘트가 없어도 죽지 않는다', () => {
    expect(hasAnswered({ requirement: req() })).toBe(false);
    expect(hasAnswered({ requirement: req(), comments: null })).toBe(false);
    expect(hasAnswered()).toBe(false);
  });

  it('여러 코멘트 중 하나만 맞아도 참', () => {
    expect(
      hasAnswered({
        requirement: req(),
        comments: [
          { author: 'it1', created_at: '2026-09-02T00:00:00Z' },
          { author: 'r1', created_at: '2026-09-03T00:00:00Z' },
        ],
      })
    ).toBe(true);
  });
});

describe('awaitingAnswer', () => {
  it('며칠째 기다리는지 준다', () => {
    expect(awaitingAnswer({ requirement: req(), now: '2026-09-04T00:00:00Z' })).toEqual({
      since: ASKED,
      days: 3,
    });
  });

  it('물어본 적이 없으면 null', () => {
    expect(awaitingAnswer({ requirement: req({ awaiting_answer_since: null }) })).toBe(null);
    expect(awaitingAnswer({})).toBe(null);
    expect(awaitingAnswer()).toBe(null);
  });

  it('now 가 없으면 날짜만 준다 — 그래도 확인 대기인 사실은 맞다', () => {
    expect(awaitingAnswer({ requirement: req() })).toEqual({ since: ASKED, days: null });
  });
});
