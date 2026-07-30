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
};

export default nextConfig;
