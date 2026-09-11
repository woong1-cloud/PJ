import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { DemoteAdminDialog, DemoteImpactSummary } from './DemoteAdminDialog';
import { demoteImpact } from '@/lib/globalAdminDemote';

// 해제 확인 창을 실제로 한 번 그려 본다.
//
// 왜 이 테스트가 있나: TopBar.render.test.jsx·MemberPanel.render.test.jsx 와
// 같은 이유다. 2026-09-11 에 훅의 의존성 배열이 변수 선언보다 위에 있었고
// (`}, [menuOpen, globalAdmin]);` 이 `const globalAdmin` 위), 그 줄은 렌더
// 도중에 바로 평가되므로 예외가 나서 운영이 섰다. 빌드도 테스트도 린트도 못
// 잡았다 — /settings/members 는 로그인해야 보이는 화면이라 빌드의 프리렌더가
// 여기까지 안 온다.
//
// 여기엔 한 가지가 더 있다: **DialogContent 는 포털 안이라 react-dom/server
// 로 그리면 빈 문자열이 나온다.** 그래서 두 갈래로 본다 —
//   · 창 전체(DemoteAdminDialog): 부품 몸통이 돌고 자식 JSX 가 만들어지는
//     동안 터지지 않는가. 글자는 못 본다
//   · 본문(DemoteImpactSummary): 실제로 무엇이 쓰였는가
//
// 모양이 어떤지는 여전히 사람이 봐야 한다.

const noop = () => {};

// 2026-09-11 운영 값이다.
const BRANDS = [
  { id: 'm', name: '미쏘', is_active: true },
  { id: 's', name: '스파오', is_active: true },
  { id: 'n', name: '신규 브랜드', is_active: true },
  { id: 'r', name: '로엠', is_active: false },
  { id: 'h', name: '후아유', is_active: false },
];

// 한지웅: 배치 4개인데 둘은 브랜드가 비활성이다 — 세 묶음이 다 찬다.
const member = {
  id: 'm1',
  name: '한지웅',
  is_global_admin: true,
  brandRoles: [
    { brandId: 'm', brandName: '미쏘', tier: '2차' },
    { brandId: 'r', brandName: '로엠', tier: '2차' },
    { brandId: 'h', brandName: '후아유', tier: '2차' },
    { brandId: 's', brandName: '스파오', tier: '2차' },
  ],
};

function summaryHtml(subject) {
  return renderToString(
    <DemoteImpactSummary
      name={subject?.name}
      impact={demoteImpact({ brandRoles: subject?.brandRoles, brands: BRANDS })}
    />,
  );
}

describe('DemoteAdminDialog 가 그려진다', () => {
  it('세 묶음이 다 찬 사람으로 그려도 안 터진다', () => {
    expect(() =>
      renderToString(
        <DemoteAdminDialog member={member} brands={BRANDS} onConfirm={noop} onClose={noop} />,
      ),
    ).not.toThrow();
  });

  it('세 묶음이 다 찰 때 이름과 등급이 쓰인다', () => {
    const html = summaryHtml(member);
    expect(html).toContain('들어갈 수 있는 곳');
    expect(html).toContain('미쏘');
    expect(html).toContain('스파오');
    // 등급은 저장값('2차')이 아니라 이름으로 나와야 한다.
    expect(html).toContain('실무 관리자');
    expect(html).toContain('들어갈 수 없게 되는 곳');
    expect(html).toContain('신규 브랜드');
    expect(html).toContain('배치가 있지만 못 들어감');
    expect(html).toContain('로엠');
    expect(html).toContain('후아유');
    // 남는 곳이 있으면 센 문구는 안 나온다.
    expect(html).not.toContain('어느 브랜드에도 못 들어가게 됩니다');
  });

  // 배치가 하나도 없으면 창이 더 세게 말해야 한다. 막지는 않는다.
  it('keep 이 비면 더 세게 말한다', () => {
    const subject = { ...member, brandRoles: [] };
    expect(() =>
      renderToString(
        <DemoteAdminDialog member={subject} brands={BRANDS} onConfirm={noop} onClose={noop} />,
      ),
    ).not.toThrow();

    const html = summaryHtml(subject);
    expect(html).toContain('한지웅 님은');
    expect(html).toContain('어느 브랜드에도 못 들어가게 됩니다');
    // 빈 묶음은 아예 안 그린다.
    expect(html).not.toContain('들어갈 수 있는 곳');
    expect(html).not.toContain('배치가 있지만 못 들어감');
  });

  // 목록 응답에 brandRoles 가 없는 사람이 실제로 온다. 그때 창이 죽으면
  // 화면 전체가 죽는다.
  it('brandRoles 가 null 이어도 안 터진다', () => {
    const subject = { ...member, brandRoles: null };
    expect(() =>
      renderToString(
        <DemoteAdminDialog member={subject} brands={BRANDS} onConfirm={noop} onClose={noop} />,
      ),
    ).not.toThrow();
    expect(summaryHtml(subject)).toContain('어느 브랜드에도 못 들어가게 됩니다');
  });

  // 브랜드 목록이 아직 안 왔거나, 사람이 잠깐 비는 경로.
  it('브랜드 목록이나 사람이 비어도 안 터진다', () => {
    for (const props of [
      { member, brands: undefined },
      { member: {}, brands: BRANDS },
      { member: null, brands: null },
      { member: { ...member, brandRoles: [{ brandId: 'zzz', brandName: '없어진', tier: null }] }, brands: BRANDS },
    ]) {
      expect(
        () => renderToString(<DemoteAdminDialog {...props} onConfirm={noop} onClose={noop} />),
        JSON.stringify(props.member),
      ).not.toThrow();
    }
  });
});
