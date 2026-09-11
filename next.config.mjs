import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 사내 서버에 올릴 것이라 Vercel 이 아니다. standalone 은 실행에 필요한
  // 파일만 골라 .next/standalone 에 모아 준다 — node_modules 전체를 나르지
  // 않아도 되고, 받는 쪽에서 npm install 을 하지 않아도 된다.
  output: 'standalone',

  // 이 줄이 없으면 배포가 조용히 깨진다.
  //
  // 이 저장소는 상위 폴더(agent/)에도 package-lock.json 이 있어서 Next 가
  // 워크스페이스 루트를 agent/ 로 추측한다(빌드 로그에 그 경고가 찍힌다).
  // 그러면 standalone 결과물이 .next/standalone/pj/... 로 한 겹 더 들어가고
  // 무관한 다른 프로젝트 파일까지 추적 대상이 된다. 경로가 바뀐 걸 모른 채
  // server.js 를 찾으면 "파일이 없다"만 보게 된다.
  outputFileTracingRoot: here,

  // 옛 주소를 살린다.
  //
  // 설정 화면을 /settings 아래로 모으면서 주소가 바뀌었다. 그런데 옛 주소를
  // 든 것이 코드 밖에 있다 — 운영 DB 의 알림 39건 중 36건이 /admin/members
  // 를 가리키고, 이미 발송된 메일 안의 링크도 같다. 코드를 고쳐도 그것들은
  // 안 바뀐다. 그리고 2026-09-11 에 내보낸 업데이트 소식의 단추가 /install
  // 을 가리킨다.
  //
  // permanent: false(307)다. 308 은 브라우저가 영구히 기억해서, 나중에
  // 주소를 또 옮기면 그 사람 브라우저에서는 옛 규칙이 계속 돈다.
  async redirects() {
    return [
      { source: '/admin/brands', destination: '/settings/brands', permanent: false },
      { source: '/admin/members', destination: '/settings/members', permanent: false },
      { source: '/admin/organizations', destination: '/settings/organizations', permanent: false },
      { source: '/admin/feedback', destination: '/settings/feedback', permanent: false },
      { source: '/requirements/settings', destination: '/settings/brand/team', permanent: false },
      { source: '/install', destination: '/settings/install', permanent: false },
    ];
  },
};

export default nextConfig;
