import { describe, expect, it } from 'vitest';
import { agendaRule, isAgendaItem } from './meetingAgenda';
import { STALL_DAYS } from './stalled';

const item = (over = {}) => ({
  status: '검토중',
  assignee: { id: 'a1', name: '장재혁' },
  stalledDays: 2,
  isNew: false,
  isDone: false,
  awaiting: null,
  ...over,
});

describe('isAgendaItem', () => {
  it('잘 굴러가는 건은 안건이 아니다', () => {
    // 이게 요점이다. 예전에는 미종결 전부가 안건이었다.
    expect(isAgendaItem({ item: item() })).toBe(false);
  });

  it('담당자가 없으면 안건이다', () => {
    expect(isAgendaItem({ item: item({ assignee: null }) })).toBe(true);
  });

  it('새로 들어왔으면 안건이다', () => {
    expect(isAgendaItem({ item: item({ isNew: true }) })).toBe(true);
  });

  it('14일 넘게 멈췄으면 안건이다', () => {
    expect(isAgendaItem({ item: item({ stalledDays: STALL_DAYS - 1 }) })).toBe(false);
    expect(isAgendaItem({ item: item({ stalledDays: STALL_DAYS }) })).toBe(true);
  });

  it('완료는 안건이 아니다 — 확인할 완료가 따로 맡는다', () => {
    expect(isAgendaItem({ item: item({ isDone: true, assignee: null }) })).toBe(false);
  });

  it('확인 대기는 안건이 아니다 — 이 회의에서 할 수 있는 일이 없다', () => {
    expect(
      isAgendaItem({ item: item({ awaiting: { days: 3 }, assignee: null, stalledDays: 40 }) })
    ).toBe(false);
  });

  it('작성중은 안건이 아니다 — 아직 제출도 안 한 초안이다', () => {
    expect(isAgendaItem({ item: item({ status: '작성중', assignee: null }) })).toBe(false);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(isAgendaItem({})).toBe(false);
    expect(isAgendaItem()).toBe(false);
  });
});

describe('agendaRule', () => {
  it('기준일이 문구에 들어간다 — 상수를 고치면 설명도 따라 바뀐다', () => {
    expect(agendaRule(STALL_DAYS)).toContain(String(STALL_DAYS));
  });
});
