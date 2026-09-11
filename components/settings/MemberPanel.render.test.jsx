import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { MemberPanel } from './MemberPanel';

// 패널을 실제로 한 번 그려 본다.
//
// 왜 이 테스트가 있나: TopBar.render.test.jsx 와 같은 이유다. 2026-09-11 에
// 훅의 의존성 배열이 변수 선언보다 위에 있었고, 그 줄은 렌더 도중에 바로
// 평가되므로 화면이 죽었다. 빌드·테스트·린트 셋 다 못 잡았다.
//
// 이 패널도 같은 자리에 있다: /settings/members 는 로그인해야 보이는 화면이라
// 빌드의 프리렌더가 여기까지 안 온다. 그래서 한 번 세워 놓고 그려 본다.
//
// 보는 것은 모양이 아니라 **터지지 않는가**이다. 화면이 어떻게 생겼는지는
// 여전히 사람이 봐야 한다.

const noop = () => {};

const handlers = {
  onClose: noop,
  onEdit: noop,
  onAccount: noop,
  onAssignBrand: noop,
  onChangeTier: noop,
  onRemoveBrand: noop,
};

const member = {
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
};

describe('MemberPanel 이 그려진다', () => {
  it('갖출 것을 다 갖춘 사람으로 그려도 안 터진다', () => {
    const html = renderToString(<MemberPanel member={member} {...handlers} />);
    expect(html).toContain('한지웅');
    expect(html).toContain('스파오');
    // 등급은 저장값('2차')이 아니라 이름으로 나와야 한다. 숫자만 있으면 그
    // 사람이 무엇을 할 수 있는지 알 수 없다.
    expect(html).toContain('실무 관리자');
  });

  it('배치가 없어도 안 터진다', () => {
    const html = renderToString(
      <MemberPanel member={{ ...member, brandRoles: [] }} {...handlers} />,
    );
    expect(html).toContain('아직 배치된 브랜드가 없습니다.');
  });

  // 실제로 오는 빈 칸들. 소속·직무가 아직 없는 사람, 계정을 아직 안 받은
  // 사람, 그만둔 사람이 그렇다. 한 가지만 보면 다른 가지의 같은 실수를 놓친다.
  it('칸이 비어 있어도 안 터진다', () => {
    for (const patch of [
      {},
      { organization: null, jobRole: null },
      { email: null, hasAccount: false },
      { is_active: false, is_global_admin: false },
      { brandRoles: null },
      { brandRoles: [{ brandId: 'b3', brandName: '뉴발란스', tier: null }] },
    ]) {
      const subject = { ...member, ...patch };
      expect(
        () => renderToString(<MemberPanel member={subject} {...handlers} />),
        JSON.stringify(patch),
      ).not.toThrow();
    }
  });

  // 목록이 갱신되는 사이 member 가 잠깐 비는 경로가 생길 수 있다. 그때
  // 화면 전체가 죽는 것보다는 빈 패널이 낫다.
  it('사람이 비어 있어도 안 터진다', () => {
    expect(() => renderToString(<MemberPanel member={{}} {...handlers} />)).not.toThrow();
  });
});
