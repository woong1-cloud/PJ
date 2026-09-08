import { describe, expect, it } from 'vitest';
import { mentionableFromMembers } from './launchMentionable';

const row = (id, name, roleName, isActive = true) => ({
  member_id: id,
  role_name: roleName,
  member: { id, name, is_active: isActive },
});

describe('mentionableFromMembers', () => {
  it('참여자를 이름순으로 준다', () => {
    expect(mentionableFromMembers([row('b', '황경임', '재무팀'), row('a', '변기석', '물류팀')]))
      .toEqual([{ id: 'a', name: '변기석' }, { id: 'b', name: '황경임' }]);
  });

  it('한 사람이 두 역할이어도 한 번만 준다 — PK 가 셋이라 줄이 둘이다', () => {
    expect(mentionableFromMembers([row('a', '변기석', '재무팀'), row('a', '변기석', '법무팀')]))
      .toEqual([{ id: 'a', name: '변기석' }]);
  });

  it('비활성 팀원은 뺀다 — 부르면 알림만 쌓인다', () => {
    expect(mentionableFromMembers([row('a', '나간사람', '재무팀', false)])).toEqual([]);
  });

  it('이름이 없으면 뺀다 — 빈 이름은 @ 하나로 아무나 걸린다', () => {
    expect(mentionableFromMembers([row('a', '', '재무팀')])).toEqual([]);
    expect(mentionableFromMembers([{ member_id: 'a', role_name: '재무팀', member: null }])).toEqual([]);
  });

  it('빈 목록은 빈 목록', () => {
    expect(mentionableFromMembers([])).toEqual([]);
    expect(mentionableFromMembers()).toEqual([]);
  });
});
