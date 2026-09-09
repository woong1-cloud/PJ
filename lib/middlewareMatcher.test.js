import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 미들웨어 matcher 가 PWA 파일을 막지 않는지 지킨다.
//
// 이게 왜 테스트인가: 막혀도 **본인 브라우저에서는 멀쩡해 보인다.**
// 로그인한 뒤에는 쿠키가 붙어 통과하기 때문이다. 처음 들어온 사람의
// 로그인 화면에서만 매니페스트가 HTML 이 되고 sw.js 등록이 실패한다.
// 사람 눈으로 잡을 수 있는 종류가 아니다.
//
// 스펙: docs/superpowers/specs/2026-09-09-pwa-install-design.md §2

const SOURCE = readFileSync(join(process.cwd(), 'middleware.js'), 'utf8');

// middleware.js 를 import 하지 않고 글로 읽는다. 그 파일이 next/server 를
// 부르기 때문이고, launchRouteGuard.test.js 가 라우트 파일을 걸어 다니는
// 것과 같은 수법이다.
function matcherRegExp() {
  const found = SOURCE.match(/matcher:\s*\[\s*'([^']+)'/);
  if (!found) throw new Error('middleware.js 에서 matcher 를 못 찾았다');
  return new RegExp(`^${found[1]}$`);
}

describe('middleware matcher', () => {
  const re = matcherRegExp();

  it.each([
    '/manifest.json',
    '/sw.js',
    '/icons/icon-192.png',
    '/icons/icon-512-maskable.6be12ff0.png',
    // app/apple-icon.png 를 Next 가 내주는 주소. 해시가 붙는다.
    '/apple-icon.png',
  ])('PWA 파일 %s 은 미들웨어를 안 탄다', (path) => {
    expect(re.test(path)).toBe(false);
  });

  // 반대쪽도 본다. 제외를 넓게 잡아 앱 경로까지 새어 나가면 로그인 없이
  // 화면이 열린다 — 이 테스트가 없으면 그게 더 조용히 지나간다.
  it.each(['/', '/login', '/launch', '/launch/abc', '/requirements'])(
    '앱 경로 %s 은 미들웨어를 탄다',
    (path) => {
      expect(re.test(path)).toBe(true);
    },
  );
});
