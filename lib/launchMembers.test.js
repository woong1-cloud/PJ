import { describe, expect, it } from 'vitest';
import {
  assigneeCandidates,
  hasAssignee,
  memberCandidates,
  memberRows,
  splitRoles,
} from './launchMembers';

const task = (over = {}) => ({
  code: '01-01',
  owner_role: '재무팀',
  support_role: '',
  status: '할 것',
  assignee: null,
  assignee_name: '',
  ...over,
});

const mem = (memberId, roleName, over = {}) => ({
  member_id: memberId,
  role_name: roleName,
  can_edit: true,
  member: { id: memberId, name: memberId },
  ...over,
});

describe('splitRoles', () => {
  it('쉼표로 둘이 든 값을 나눈다', () => {
    // support_role 에 '온라인BU 광고기획 , 브랜드PM' 같은 값이 실제로 있다.
    expect(splitRoles('온라인BU 광고기획 , 브랜드PM')).toEqual(['온라인BU 광고기획', '브랜드PM']);
  });

  it('빈 값은 빈 목록', () => {
    expect(splitRoles('')).toEqual([]);
    expect(splitRoles(null)).toEqual([]);
  });
});

describe('memberRows', () => {
  it('주관·지원을 따로 센다', () => {
    const rows = memberRows({
      tasks: [
        task({ owner_role: '재무팀', support_role: '법무팀' }),
        task({ owner_role: '법무팀', support_role: '재무팀' }),
        task({ owner_role: '재무팀' }),
      ],
    });
    expect(rows.find((r) => r.role === '재무팀')).toMatchObject({ ownerCount: 2, supportCount: 1 });
    expect(rows.find((r) => r.role === '법무팀')).toMatchObject({ ownerCount: 1, supportCount: 1 });
  });

  it('주관 건수 많은 순이다 — 숫자가 보이는 목록은 그 숫자로 정렬돼야 한다', () => {
    const rows = memberRows({
      tasks: [
        task({ owner_role: '법무팀' }),
        task({ owner_role: '재무팀' }),
        task({ owner_role: '재무팀' }),
      ],
    });
    expect(rows.map((r) => r.role)).toEqual(['재무팀', '법무팀']);
  });

  it('해당없음은 안 센다 — 안 할 일이 역할의 짐으로 잡히면 안 된다', () => {
    const rows = memberRows({
      tasks: [task({ owner_role: '재무팀' }), task({ owner_role: '재무팀', status: '해당없음' })],
    });
    expect(rows.find((r) => r.role === '재무팀').ownerCount).toBe(1);
  });

  it('사람이 없는 역할도 빈 줄로 남긴다 — 그 빈 줄이 이 화면을 보는 이유다', () => {
    const rows = memberRows({ tasks: [task({ owner_role: '물류팀' })], members: [] });
    expect(rows.find((r) => r.role === '물류팀').members).toEqual([]);
  });

  it('명단에는 있는데 항목에 없는 역할도 0건으로 남긴다 — 역할을 잘못 골랐다는 뜻', () => {
    const rows = memberRows({
      tasks: [task({ owner_role: '재무팀' })],
      members: [mem('a', '없는역할')],
    });
    const odd = rows.find((r) => r.role === '없는역할');
    expect(odd).toMatchObject({ ownerCount: 0, supportCount: 0 });
    expect(odd.members).toHaveLength(1);
  });

  it('담당자는 주관 쪽에서만 센다 — 지원까지 세면 합이 항목 수를 넘는다', () => {
    const rows = memberRows({
      tasks: [task({ owner_role: '재무팀', support_role: '법무팀', assignee_name: '황경임' })],
    });
    expect(rows.find((r) => r.role === '재무팀').assignedCount).toBe(1);
    expect(rows.find((r) => r.role === '법무팀').assignedCount).toBe(0);
  });

  it('참여자가 앞, 참관이 뒤다', () => {
    const rows = memberRows({
      tasks: [task({ owner_role: '재무팀' })],
      members: [mem('관찰', '재무팀', { can_edit: false }), mem('일꾼', '재무팀')],
    });
    expect(rows[0].members.map((m) => m.member_id)).toEqual(['일꾼', '관찰']);
  });
});

describe('hasAssignee', () => {
  it('계정이든 이름이든 붙었으면 참', () => {
    expect(hasAssignee(task({ assignee: 'uuid' }))).toBe(true);
    expect(hasAssignee(task({ assignee_name: '김지웅' }))).toBe(true);
  });

  it('공백만 있으면 거짓', () => {
    expect(hasAssignee(task({ assignee_name: '   ' }))).toBe(false);
    expect(hasAssignee(task())).toBe(false);
  });
});

describe('memberCandidates', () => {
  const people = [{ id: 'b', name: '정소희' }, { id: 'a', name: '황경임' }];

  it('이름순이다', () => {
    expect(memberCandidates({ people }).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('이미 그 역할로 들어온 사람은 뺀다', () => {
    const hits = memberCandidates({ people, members: [mem('a', '재무팀')], roleName: '재무팀' });
    expect(hits.map((p) => p.id)).toEqual(['b']);
  });

  it('다른 역할로 들어온 사람은 남긴다 — 한 사람이 두 역할을 가질 수 있다', () => {
    const hits = memberCandidates({ people, members: [mem('a', '법무팀')], roleName: '재무팀' });
    expect(hits.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
});

describe('assigneeCandidates', () => {
  const members = [mem('a', '재무팀'), mem('b', '재무팀'), mem('c', '법무팀')];

  it('그 항목의 주관 역할로 들어온 사람만 — 19명이 아니라 2명이 되게 한다', () => {
    const hits = assigneeCandidates({ task: task({ owner_role: '재무팀' }), members });
    expect(hits.map((m) => m.member_id)).toEqual(['a', 'b']);
  });

  it('참관은 뺀다 — 보기만 하는 사람에게 일을 맡길 수 없다', () => {
    const hits = assigneeCandidates({
      task: task({ owner_role: '재무팀' }),
      members: [...members, mem('d', '재무팀', { can_edit: false })],
    });
    expect(hits.map((m) => m.member_id)).not.toContain('d');
  });

  it('주관이 둘이면 둘 다에서 모으고 같은 사람을 두 번 안 준다', () => {
    const both = [mem('a', '재무팀'), mem('a', '법무팀')];
    const hits = assigneeCandidates({ task: task({ owner_role: '재무팀, 법무팀' }), members: both });
    expect(hits.map((m) => m.member_id)).toEqual(['a']);
  });

  it('주관이 없으면 빈 목록', () => {
    expect(assigneeCandidates({ task: task({ owner_role: '' }), members })).toEqual([]);
  });
});
