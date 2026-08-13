import { describe, it, expect } from 'vitest';
import { activeJobRoles, displayJobRole } from './jobRoles';

describe('activeJobRoles', () => {
  const roles = [
    { id: '1', name: '기타', is_active: true, sort_order: 999 },
    { id: '2', name: '온라인 MD', is_active: true, sort_order: 10 },
    { id: '3', name: '없어진직무', is_active: false, sort_order: 20 },
    { id: '4', name: '마케팅', is_active: true, sort_order: 20 },
  ];

  it('sort_order 순으로 준다 — 기타는 늘 마지막이다', () => {
    expect(activeJobRoles(roles).map((r) => r.name)).toEqual(['온라인 MD', '마케팅', '기타']);
  });

  it('비활성은 뺀다 — 쓰지 않기로 한 직무를 새로 고르면 안 된다', () => {
    expect(activeJobRoles(roles).map((r) => r.name)).not.toContain('없어진직무');
  });

  it('sort_order 가 같으면 이름 순 — 순서가 매번 달라지면 안 된다', () => {
    const same = [
      { id: '1', name: '재무', is_active: true, sort_order: 0 },
      { id: '2', name: '법무', is_active: true, sort_order: 0 },
    ];
    expect(activeJobRoles(same).map((r) => r.name)).toEqual(['법무', '재무']);
  });

  it('is_active 가 없으면 활성으로 본다 — 공개 API 는 그 컬럼을 안 실을 수 있다', () => {
    expect(activeJobRoles([{ id: '1', name: '법무' }]).map((r) => r.name)).toEqual(['법무']);
  });

  it('빈 입력에 터지지 않는다', () => {
    expect(activeJobRoles()).toEqual([]);
    expect(activeJobRoles(null)).toEqual([]);
  });
});

describe('displayJobRole', () => {
  it('조인된 이름을 먼저 쓴다', () => {
    expect(displayJobRole({ jobRole: { name: '법무' }, job_role: '기타' })).toBe('법무');
  });

  it('이어 붙지 않은 행은 옛 값을 보여준다', () => {
    expect(displayJobRole({ jobRole: null, job_role: '온라인 MD' })).toBe('온라인 MD');
  });

  it('둘 다 없으면 대시', () => {
    expect(displayJobRole({})).toBe('—');
    expect(displayJobRole(null)).toBe('—');
  });
});
