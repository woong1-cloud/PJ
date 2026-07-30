import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // dist/ 를 빼지 않으면 npm run package 로 ZIP 을 한 번 만든 뒤부터
    // 스테이지 폴더에 복사된 테스트까지 같이 돌아간다. 실제로 315개가
    // 946개로 늘어난 걸 보고 알았다.
    //
    // 숫자가 부풀는 것만이 문제가 아니다. 복사본은 ZIP 을 만든 시점의 코드라,
    // 지금 고친 코드가 깨져도 낡은 복사본이 통과하면서 "몇 개 실패"가 묻힌다.
    // 무엇을 검증한 것인지 알 수 없는 테스트 결과는 없는 것보다 나쁘다.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
});
