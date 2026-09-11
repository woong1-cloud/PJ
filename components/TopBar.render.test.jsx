import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// 상단바를 실제로 한 번 그려 본다.
//
// 왜 이 테스트가 있나: 2026-09-11 에 이 부품 하나 때문에 운영이 섰다.
// 훅의 의존성 배열에서 아직 선언 안 된 변수를 읽었고(`}, [menuOpen,
// globalAdmin]);` 이 `const globalAdmin` 보다 위에 있었다), 그 줄은 렌더
// 도중에 바로 평가되므로 그 자리에서 예외가 났다. 상단바는 모든 화면에
// 있어서 **로그인한 사람의 모든 페이지가 죽었다.**
//
// 그때 아무것도 못 잡았다:
//   · 빌드는 통과했다 — 서버에서 미리 그릴 때는 로그인 정보가 없어서
//     IdentityProvider 가 이 부품을 아예 안 그린다
//   · 테스트는 화면을 안 그린다
//   · lint 의 no-use-before-define 은 이 경우를 못 가른다. 파일 아래쪽
//     상수를 컴포넌트 안에서 쓰는 안전한 자리까지 같이 잡아서(37건) 못 켠다
//
// 그래서 **로그인한 사람 자리에 세워 놓고 한 번 그린다.** DOM 이 필요 없다 —
// react-dom/server 는 문자열만 만든다. vitest 의 environment: 'node' 그대로다.
//
// 이 테스트가 보는 것은 모양이 아니라 **터지지 않는가**이다. 화면이 어떻게
// 생겼는지는 여전히 사람이 봐야 한다.

vi.mock('next/navigation', () => ({
  usePathname: () => '/requirements',
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

const identity = {
  name: '한지웅',
  brandId: 'b1',
  tier: '1차',
  isGlobalAdmin: true,
  hasLaunch: true,
};

vi.mock('./IdentityProvider', () => ({
  useIdentity: () => ({ identity, logout: () => {} }),
  IdentityProvider: ({ children }) => children,
}));

// 서버 렌더에서는 effect 가 안 돌지만, 자식 부품이 모듈을 읽을 때 fetch 가
// 없으면 터지는 것을 막는다.
globalThis.fetch = globalThis.fetch ?? (() => Promise.resolve({ ok: false }));

const { TopBar } = await import('./TopBar');

describe('TopBar 가 그려진다', () => {
  it('전체 관리자로 그려도 안 터진다', () => {
    const html = renderToString(<TopBar />);
    expect(html).toContain('모아');
  });

  // 등급마다 다른 가지를 탄다. 한 가지만 보면 다른 가지의 같은 실수를 놓친다.
  it('등급이 달라도 안 터진다', async () => {
    for (const tier of ['4차', '3차', '2차', '1차']) {
      for (const globalAdmin of [true, false]) {
        vi.resetModules();
        vi.doMock('next/navigation', () => ({
          usePathname: () => '/requirements',
          useRouter: () => ({ push: () => {}, replace: () => {} }),
        }));
        vi.doMock('./IdentityProvider', () => ({
          useIdentity: () => ({
            identity: { ...identity, tier, isGlobalAdmin: globalAdmin },
            logout: () => {},
          }),
          IdentityProvider: ({ children }) => children,
        }));
        const mod = await import('./TopBar');
        expect(() => renderToString(<mod.TopBar />), `${tier} · 전체관리자 ${globalAdmin}`)
          .not.toThrow();
      }
    }
  });

  // identity 가 null 인 경우는 안 본다. IdentityProvider 가 그때는
  // 「불러오는 중...」만 그리고 자식을 아예 안 그리기 때문이다
  // (IdentityProvider.jsx:80). 처음에 그 경우를 테스트했다가 이 계약을 알았다.
  //
  // 대신 **칸이 빈 정보**는 실제로 온다. 소속이나 직무가 아직 없는 사람,
  // 등급을 못 받은 사람이 그렇다.
  it('정보가 비어 있어도 안 터진다', async () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({
      usePathname: () => '/requirements',
      useRouter: () => ({ push: () => {}, replace: () => {} }),
    }));
    vi.doMock('./IdentityProvider', () => ({
      useIdentity: () => ({ identity: {}, logout: () => {} }),
      IdentityProvider: ({ children }) => children,
    }));
    const mod = await import('./TopBar');
    expect(() => renderToString(<mod.TopBar />)).not.toThrow();
  });
});
