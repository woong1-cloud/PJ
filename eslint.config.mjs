import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // npm run package 가 만드는 배포 산출물. 컴파일된 번들이라 lint 대상이
    // 아닌데, 빼 두지 않으면 ZIP 을 한 번 만든 뒤부터 lint 가 에러 수십 개를
    // 쏟아낸다(우리가 쓰지 않은 규칙까지). 그러면 진짜 에러가 묻힌다.
    "dist/**",
  ]),
]);

export default eslintConfig;
