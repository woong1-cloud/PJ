import { describe, expect, it } from 'vitest';

// 옛 주소가 죽지 않게 지킨다.
//
// 왜 테스트인가: 운영 DB 의 알림 39건 중 36건이 /admin/members 를 가리킨다.
// 그 줄들은 이미 저장돼 있어서 코드를 고쳐도 안 바뀐다. 발송된 메일 안의
// 링크도 마찬가지다. 리다이렉트가 빠지면 그것들이 조용히 404 가 된다 —
// 배포는 멀쩡하고 아무 오류도 안 난다.
//
// /install 도 같다. 2026-09-11 에 내보낸 업데이트 소식의 단추가 그 주소를
// 가리킨다(lib/newsItems.js).
const OLD_TO_NEW = {
  '/admin/brands': '/settings/brands',
  '/admin/members': '/settings/members',
  '/admin/organizations': '/settings/organizations',
  '/admin/feedback': '/settings/feedback',
  '/requirements/settings': '/settings/brand/team',
  '/install': '/settings/install',
};

async function rules() {
  const config = (await import('../next.config.mjs')).default;
  return config.redirects();
}

describe('옛 주소 리다이렉트', () => {
  it('여섯이 새 주소를 가리킨다', async () => {
    const map = Object.fromEntries((await rules()).map((r) => [r.source, r.destination]));
    expect(map).toMatchObject(OLD_TO_NEW);
  });

  // 308 은 브라우저가 영구히 기억한다. 나중에 주소를 또 옮기면 그 사람
  // 브라우저에서는 옛 규칙이 계속 돈다 — 우리가 손쓸 방법이 없다.
  it('영구 리다이렉트가 아니다', async () => {
    for (const rule of await rules()) expect(rule.permanent, rule.source).toBe(false);
  });

  // /admin/dashboard 는 안 옮긴다. 설정이 아니라 보는 화면이다.
  it('대시보드는 안 건드린다', async () => {
    expect((await rules()).some((r) => r.source.startsWith('/admin/dashboard'))).toBe(false);
  });
});
