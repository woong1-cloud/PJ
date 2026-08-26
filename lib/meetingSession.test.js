import { describe, expect, it } from 'vitest';
import { groupAssignmentsByRequester } from './meetingSession';

const reqs = [
  { id: 'a', title: '타임세일', requester: 'p1', expected_release_date: '2026-09-15' },
  { id: 'b', title: '사은품', requester: 'p1', expected_release_date: null },
  { id: 'c', title: '배너', requester: 'p2', expected_release_date: null },
  { id: 'd', title: '주인없음', requester: null, expected_release_date: null },
];

const log = (requirementId, newValue = '장재혁') => ({
  requirement_id: requirementId,
  new_value: newValue,
});

describe('groupAssignmentsByRequester', () => {
  it('요청자별로 묶는다', () => {
    const got = groupAssignmentsByRequester({
      assignmentLogs: [log('a'), log('b'), log('c')],
      requirements: reqs,
    });
    expect(got).toHaveLength(2);
    const p1 = got.find((g) => g.requesterId === 'p1');
    expect(p1.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('담당 이름과 예상일을 함께 담는다', () => {
    const [group] = groupAssignmentsByRequester({
      assignmentLogs: [log('a')],
      requirements: reqs,
    });
    expect(group.items[0]).toEqual({
      id: 'a',
      title: '타임세일',
      assigneeName: '장재혁',
      expectedDate: '2026-09-15',
    });
  });

  it('요청자가 없는 건은 뺀다', () => {
    expect(groupAssignmentsByRequester({ assignmentLogs: [log('d')], requirements: reqs })).toEqual(
      []
    );
  });

  it('담당자 해제(new_value 없음)는 세지 않는다', () => {
    expect(
      groupAssignmentsByRequester({ assignmentLogs: [log('a', null)], requirements: reqs })
    ).toEqual([]);
  });

  it('같은 건이 두 번 배정되면 마지막 담당자로 한 번만', () => {
    const [group] = groupAssignmentsByRequester({
      assignmentLogs: [log('a', '장재혁'), log('a', '안수아')],
      requirements: reqs,
    });
    expect(group.items).toHaveLength(1);
    expect(group.items[0].assigneeName).toBe('안수아');
  });

  it('배정 뒤에 해제하면 아무것도 안 나간다', () => {
    expect(
      groupAssignmentsByRequester({
        assignmentLogs: [log('a', '장재혁'), log('a', null)],
        requirements: reqs,
      })
    ).toEqual([]);
  });

  it('목록에 없는 요구사항 로그는 무시한다', () => {
    expect(
      groupAssignmentsByRequester({ assignmentLogs: [log('zzz')], requirements: reqs })
    ).toEqual([]);
  });

  it('요청자가 객체로 와도 묶는다', () => {
    const [group] = groupAssignmentsByRequester({
      assignmentLogs: [log('a')],
      requirements: [{ id: 'a', title: '타임세일', requester: { id: 'p1', name: '박천주' } }],
    });
    expect(group.requesterId).toBe('p1');
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(groupAssignmentsByRequester()).toEqual([]);
  });
});
