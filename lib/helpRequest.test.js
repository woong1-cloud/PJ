import { describe, expect, it } from 'vitest';
import {
  MAX_RECIPIENTS,
  defaultRoles,
  recentlyAsked,
  recipientsForRoles,
  tooMany,
} from './helpRequest';

const member = (id, name, roleName, isActive = true) => ({
  member_id: id,
  role_name: roleName,
  member: { id, name, is_active: isActive },
});

describe('defaultRoles', () => {
  it('막힘이면 결정권 — 막힌 것의 상대는 거의 늘 결정권이다', () => {
    expect(defaultRoles({ status: '막힘', decision_org: 'CAIO실', owner_role: '물류팀' }))
      .toEqual(['CAIO실']);
  });

  it('막힘이 아니면 주관', () => {
    expect(defaultRoles({ status: '할 것', decision_org: 'CAIO실', owner_role: '물류팀' }))
      .toEqual(['물류팀']);
  });

  it('막힘인데 결정권이 비어 있으면 주관으로 떨어진다 — 빈 화면을 주지 않는다', () => {
    expect(defaultRoles({ status: '막힘', decision_org: '', owner_role: '물류팀' }))
      .toEqual(['물류팀']);
  });

  it('쉼표로 둘 든 값을 나눈다 — support_role 에 실제로 그런 값이 있다', () => {
    expect(defaultRoles({ status: '할 것', owner_role: '재무팀 , 법무팀' }))
      .toEqual(['재무팀', '법무팀']);
  });

  it('아무 역할도 없으면 빈 목록', () => {
    expect(defaultRoles({ status: '할 것' })).toEqual([]);
    expect(defaultRoles()).toEqual([]);
  });
});

describe('recipientsForRoles', () => {
  const members = [
    member('a', '변기석', '물류팀'),
    member('b', '장재혁', 'CAIO실'),
    member('c', '황경임', '물류팀'),
  ];

  it('고른 역할의 사람만 준다', () => {
    expect(recipientsForRoles(members, ['물류팀']).map((m) => m.id).sort())
      .toEqual(['a', 'c']);
  });

  it('역할 둘이면 합친다', () => {
    expect(recipientsForRoles(members, ['물류팀', 'CAIO실']).length).toBe(3);
  });

  it('한 사람이 두 역할이어도 한 번만 — PK 가 셋이라 줄이 둘이다', () => {
    const both = [member('a', '변기석', '물류팀'), member('a', '변기석', 'CAIO실')];
    expect(recipientsForRoles(both, ['물류팀', 'CAIO실']).map((m) => m.id)).toEqual(['a']);
  });

  it('비활성 팀원은 뺀다 — 보내도 안 읽는다', () => {
    const gone = [member('z', '나간사람', '물류팀', false)];
    expect(recipientsForRoles(gone, ['물류팀'])).toEqual([]);
  });

  it('역할이 없거나 명단이 비면 빈 목록', () => {
    expect(recipientsForRoles(members, [])).toEqual([]);
    expect(recipientsForRoles([], ['물류팀'])).toEqual([]);
    expect(recipientsForRoles()).toEqual([]);
  });
});

describe('tooMany', () => {
  it('20명까지는 보낸다', () => {
    expect(tooMany(MAX_RECIPIENTS)).toBe(false);
  });

  it('넘으면 세운다 — 역할을 잘못 골라 30명이 되는 것을 막는다', () => {
    expect(tooMany(MAX_RECIPIENTS + 1)).toBe(true);
  });

  it('0 명도 못 보낸다는 뜻은 아니다 — 그건 부르는 쪽이 따로 본다', () => {
    expect(tooMany(0)).toBe(false);
  });
});

describe('recentlyAsked', () => {
  const now = new Date('2026-09-09T10:00:00Z');
  const at = (iso, roles) => ({ created_at: iso, request_roles: roles });

  it('24시간 안에 같은 역할로 나갔으면 찾는다', () => {
    expect(recentlyAsked([at('2026-09-08T18:00:00Z', ['CAIO실'])], ['CAIO실'], now))
      .toEqual(['CAIO실']);
  });

  it('24시간이 지났으면 아니다', () => {
    expect(recentlyAsked([at('2026-09-08T09:00:00Z', ['CAIO실'])], ['CAIO실'], now))
      .toEqual([]);
  });

  it('다른 역할로 나간 것은 아니다', () => {
    expect(recentlyAsked([at('2026-09-09T09:00:00Z', ['물류팀'])], ['CAIO실'], now))
      .toEqual([]);
  });

  it('평범한 댓글은 안 센다 — request_roles 가 비어 있다', () => {
    expect(recentlyAsked([at('2026-09-09T09:00:00Z', null)], ['CAIO실'], now)).toEqual([]);
  });

  it('겹치는 역할만 준다', () => {
    expect(recentlyAsked([at('2026-09-09T09:00:00Z', ['CAIO실', '물류팀'])],
      ['CAIO실', '재무팀'], now)).toEqual(['CAIO실']);
  });

  it('빈 입력에 안 터진다', () => {
    expect(recentlyAsked([], ['CAIO실'], now)).toEqual([]);
    expect(recentlyAsked()).toEqual([]);
  });
});
