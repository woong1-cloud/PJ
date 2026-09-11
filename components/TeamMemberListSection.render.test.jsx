import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { TeamMemberListSection } from './TeamMemberListSection';

// 표와 툴바를 실제로 한 번 그려 본다. 왜 이런 테스트가 있는지는
// TopBar.render.test.jsx 의 첫 주석에 적혀 있다 — 렌더에서만 터지는 실수는
// 빌드도 테스트도 린트도 못 잡는데, 이 화면은 로그인해야 보여서 빌드의
// 프리렌더도 여기까지 오지 않는다.
//
// 보는 것은 모양이 아니라 터지지 않는가이다.

// 서버 렌더는 붙어 있는 텍스트 노드 사이에 <!-- --> 를 끼운다. '외 1' 이
// 'and 외 <!-- -->1' 로 나오는 식이라, 사람이 읽는 문구로 검사하려면 걷어내야 한다.
const plain = (html) => html.replaceAll('<!-- -->', '');

const noop = () => {};

const handlers = {
  onSearch: noop,
  onFilter: noop,
  onBrand: noop,
  onCreate: noop,
  onAccount: noop,
  onToggleGlobalAdmin: noop,
  onToggleActive: noop,
  onEdit: noop,
  onSelect: noop,
};

const members = [
  {
    id: 'm1',
    name: '한지웅',
    email: 'woong@example.com',
    is_active: true,
    is_global_admin: true,
    hasAccount: true,
    organization: { name: '온라인BU' },
    jobRole: { name: '기획자' },
    brandRoles: [
      { brandId: 'b1', brandName: '스파오', tier: '2차' },
      { brandId: 'b2', brandName: '미쏘', tier: '4차' },
    ],
  },
  {
    id: 'm2',
    name: '김동현',
    email: null,
    is_active: false,
    is_global_admin: false,
    hasAccount: false,
    brandRoles: [],
  },
];

const base = {
  members,
  counts: { all: 2, active: 1, off: 1, admin: 1 },
  q: '',
  f: 'all',
  brand: '',
  brands: [{ id: 'b1', name: '스파오' }],
  currentBrandId: 'b1',
  ...handlers,
};

describe('TeamMemberListSection 이 그려진다', () => {
  it('사람이 있으면 표를 그린다', () => {
    const html = plain(renderToString(<TeamMemberListSection {...base} />));
    expect(html).toContain('한지웅');
    // 지금 보고 있는 브랜드가 대표로 올라오고, 나머지는 '외 N' 이 된다.
    expect(html).toContain('스파오');
    expect(html).toContain('외 1');
    // 배치가 없는 사람은 '—' 가 아니라 무슨 일인지 말해 주는 문구다.
    expect(html).toContain('배치 없음');
    // 칩 숫자는 전체 기준이라 재직중 1 · 비활성 1 이 함께 보인다.
    expect(html).toContain('비활성');
    expect(html).toContain('2명 보임');
  });

  it('좁혀서 아무도 없으면 그렇다고 말한다', () => {
    const html = plain(renderToString(<TeamMemberListSection {...base} members={[]} />));
    expect(html).toContain('찾는 조건에 맞는 직원이 없습니다.');
    expect(html).toContain('0명 보임');
  });

  // 실제로 오는 빈 칸들. 소속·직무가 없는 사람, brandRoles 가 아직 안 온
  // 응답, 브랜드 목록이 늦게 오는 첫 렌더가 그렇다.
  it('칸이 비어 있어도 안 터진다', () => {
    for (const patch of [
      { brands: undefined },
      { counts: undefined },
      { members: [{ id: 'x', name: '이름만', brandRoles: null }] },
      { members: [{ id: 'x', name: '이름만' }], currentBrandId: null },
      { brand: 'none', f: 'off' },
    ]) {
      expect(
        () => renderToString(<TeamMemberListSection {...base} {...patch} />),
        JSON.stringify(patch),
      ).not.toThrow();
    }
  });
});
