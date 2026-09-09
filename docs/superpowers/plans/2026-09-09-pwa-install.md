# PWA 1단계 구현 계획 — 설치되는 것까지

> **에이전트에게:** 이 계획은 작업 단위로 서브에이전트를 띄워 실행한다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 모아를 폰 홈 화면에 깔 수 있게 만든다. 푸시·캐싱·QR 은 안 한다.

**구조:** 정적 매니페스트 한 장, 아이콘 넷, 아무것도 안 하는 서비스워커 하나,
미들웨어 매처 한 줄. 화면 코드는 `app/layout.js` 외에 안 건드린다.

**스택:** Next.js 16 App Router (JS), Tailwind v4, vitest(`environment: 'node'`),
`sharp` 8.17.3 (이미 의존성에 있다).

**스펙:** `docs/superpowers/specs/2026-09-09-pwa-install-design.md`

**브랜치:** `feature/pwa-install` (이미 만들어 스펙을 커밋했다)

**기준선: 78 파일 / 1233 테스트 전부 통과.** 줄면 안 된다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `middleware.js` | 매처에서 PWA 파일 셋을 뺀다 (한 줄) |
| `lib/middlewareMatcher.test.js` | 그 한 줄이 되돌아가지 않게 못 박는다 |
| `scripts/make-icons.mjs` | SVG 하나에서 아이콘 넷을 뽑는다 |
| `public/icons/*.png` | 결과물. **커밋한다** (아래 이유) |
| `public/manifest.json` | 설치 정보 |
| `lib/manifest.test.js` | 설치 조건이 빠지지 않게 못 박는다 |
| `public/sw.js` | 아무것도 안 하는 서비스워커 |
| `components/RegisterServiceWorker.jsx` | 등록만 하는 클라이언트 부품 |
| `app/layout.js` | metadata 에 매니페스트·iOS 것을 더한다 |

**아이콘 PNG 를 반드시 커밋한다.** `scripts/package-zip.mjs` 가 **git 이 추적하는
파일만** ZIP 에 담는다. `.gitignore` 에 들어가면 배포본에 아이콘이 빠지고,
매니페스트는 멀쩡한데 설치가 안 된다 — 그리고 로컬에서는 잘 된다.

---

### Task 1: 미들웨어 매처

**Files:**
- Create: `lib/middlewareMatcher.test.js`
- Modify: `middleware.js` (마지막 줄의 `matcher` 문자열 하나)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/middlewareMatcher.test.js`:

```js
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
    '/icons/apple-touch-icon.png',
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
```

- [ ] **Step 2: 실패를 확인한다**

```
npx vitest run lib/middlewareMatcher.test.js
```

기대: PWA 파일 넷이 **FAIL**(지금 매처가 전부 걸어 낸다). 앱 경로 다섯은 PASS.

- [ ] **Step 3: 매처를 고친다**

`middleware.js` 맨 아래를 이렇게 바꾼다. **다른 줄은 안 건드린다.**

```js
export const config = {
  // manifest.json · sw.js · icons/ 를 뺀다.
  //
  // 안 빼면 비로그인 상태에서 셋이 /login 으로 307 된다. 매니페스트는
  // HTML 이 되어 무효가 되고, sw.js 는 콘텐츠 타입이 안 맞아 등록 자체가
  // 실패한다. 로그인한 뒤에는 쿠키가 붙어 통과하므로 **본인 화면에서는
  // 멀쩡해 보인다** — 설치를 권하고 싶은 로그인 화면에서만 안 된다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|manifest\\.json|sw\\.js|icons/).*)'],
};
```

- [ ] **Step 4: 통과를 확인한다**

```
npx vitest run lib/middlewareMatcher.test.js
```

기대: 9개 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add -- middleware.js lib/middlewareMatcher.test.js
git commit -m "fix: 미들웨어가 매니페스트·서비스워커·아이콘을 막지 않게"
```

---

### Task 2: 아이콘 넷

**Files:**
- Create: `scripts/make-icons.mjs`
- Create: `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`

- [ ] **Step 1: 스크립트를 쓴다**

`scripts/make-icons.mjs`:

```js
// 아이콘 넷을 SVG 하나에서 뽑는다.
//
// 손으로 그린 PNG 를 저장소에 넣지 않는 이유는 하나다 — 로고가 생겼을 때
// 이 파일만 고치면 넷이 함께 바뀐다. sharp 는 Next 의 이미지 최적화용으로
// 이미 의존성에 있다.
//
// 돌리는 법: node scripts/make-icons.mjs
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = join(process.cwd(), 'public', 'icons');
const BRAND = '#4f46e5'; // indigo-600. 로그인 화면과 주요 단추가 쓰는 색

// ratio 는 글자가 차지하는 몫이다. maskable 은 안드로이드가 원·사각·물방울로
// 깎으므로 가장자리 20%가 잘려도 되게 그림을 가운데로 몬다.
function svg({ size, radius, ratio }) {
  const font = Math.round(size * ratio);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
        font-size="${font}" font-weight="700" fill="#ffffff">모아</text>
</svg>`,
  );
}

const JOBS = [
  // 일반 아이콘. 모서리를 둥글게 깎아 둔다.
  { file: 'icon-192.png', size: 192, radius: 42, ratio: 0.38 },
  { file: 'icon-512.png', size: 512, radius: 112, ratio: 0.38 },
  // maskable 은 시스템이 모양을 씌운다. 사각으로 꽉 채우고 글자를 작게.
  { file: 'icon-512-maskable.png', size: 512, radius: 0, ratio: 0.26 },
  // iOS 는 자기가 모서리를 깎고, **알파를 검게 칠한다** — 배경을 꽉 채운다.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, ratio: 0.38 },
];

mkdirSync(OUT, { recursive: true });
for (const job of JOBS) {
  await sharp(svg(job)).png().toFile(join(OUT, job.file));
  console.log(`  ${job.file}  ${job.size}x${job.size}`);
}
console.log(`\n${JOBS.length}개 만들었습니다 — public/icons/`);
```

- [ ] **Step 2: 돌리고 눈으로 본다**

```
node scripts/make-icons.mjs
```

기대: 네 줄이 찍히고 `public/icons/` 에 파일 넷.

**그림을 반드시 열어 본다.** 한글이 안 그려지면 남색 사각형만 나온다.
(확인 완료: 이 환경에서 「모아」가 정상 렌더된다. 그래도 눈으로 본다.)

- [ ] **Step 3: `.gitignore` 를 확인한다**

```
git check-ignore -v public/icons/icon-192.png; echo "exit=$?"
```

기대: **아무것도 안 나오고 `exit=1`.** 무언가 나오면 그 규칙을 고친다 —
`scripts/package-zip.mjs` 는 **git 이 추적하는 파일만** ZIP 에 담으므로,
무시되면 배포본에 아이콘이 빠지고 **로컬에서는 잘 된다.**

- [ ] **Step 4: 커밋**

```bash
git add -- scripts/make-icons.mjs public/icons
git commit -m "feat: PWA 아이콘 넷과 생성 스크립트"
```

---

### Task 3: 매니페스트

**Files:**
- Create: `public/manifest.json`
- Create: `lib/manifest.test.js`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/manifest.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 설치 조건을 못 박는다.
//
// 하나라도 빠지면 브라우저가 **아무 말 없이** 설치 단추를 안 띄운다.
// 오류도 경고도 없다. 그래서 사람이 아니라 테스트가 지킨다.
//
// 스펙: docs/superpowers/specs/2026-09-09-pwa-install-design.md §3

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'manifest.json'), 'utf8'));

describe('manifest.json', () => {
  it('이름 둘을 갖는다 — short_name 이 홈 화면 아래 붙는다', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
  });

  it('창으로 뜬다', () => {
    expect(manifest.display).toBe('standalone');
  });

  // 루트는 미들웨어가 무조건 /login 으로 보낸다. 앱을 열 때마다 로그인
  // 화면을 지나가지 않도록 일하는 화면에서 시작한다.
  it('/launch 에서 시작한다 — 루트가 아니다', () => {
    expect(manifest.start_url).toBe('/launch');
  });

  it('192 와 512 아이콘이 있다 — 설치 조건이다', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('maskable 이 하나 있다 — 안드로이드가 모양대로 깎는다', () => {
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  // 매니페스트에 적힌 그림이 실제로 있어야 한다. 파일명을 고치고 매니페스트를
  // 안 고치면 여기서 걸린다.
  it('적힌 아이콘 파일이 전부 실제로 있다', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(ROOT, 'public', icon.src)), icon.src).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```
npx vitest run lib/manifest.test.js
```

기대: 파일이 없어 **읽기에서 터진다.**

- [ ] **Step 3: 매니페스트를 만든다**

`public/manifest.json`:

```json
{
  "name": "모아 MOA",
  "short_name": "모아",
  "description": "요구사항과 프로젝트를 한곳에 모읍니다.",
  "start_url": "/launch",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4f46e5",
  "lang": "ko",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: 통과를 확인한다**

```
npx vitest run lib/manifest.test.js
```

기대: 6개 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add -- public/manifest.json lib/manifest.test.js
git commit -m "feat: PWA 매니페스트"
```

---

### Task 4: 서비스워커와 metadata

**Files:**
- Create: `public/sw.js`
- Create: `components/RegisterServiceWorker.jsx`
- Modify: `app/layout.js`

- [ ] **Step 1: 서비스워커**

`public/sw.js`:

```js
// 아무것도 안 한다. 설치 조건을 채우려고 있다.
//
// 캐싱을 넣지 않는다. 이 앱은 볼 것이 전부 서버에 있고 오프라인으로 할 일이
// 없다. 넣으면 "배포했는데 옛날 화면이 나온다"는 병이 새로 생기고, 그 병은
// 사용자가 스스로 못 고친다.
//
// 걷어내는 법(언젠가 필요하면): 같은 주소에 registration.unregister() 만
// 하는 파일을 올려 한 번 돌린다. 지금 것은 아무 응답도 가로채지 않아서
// 잘못돼도 화면을 망가뜨리지 못한다.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// 이 핸들러가 있어야 크롬이 설치 가능으로 친다. respondWith 를 안 부르므로
// 요청은 평소대로 네트워크로 간다 — 가로채는 것이 아니라 있기만 한 것이다.
self.addEventListener('fetch', () => {});
```

- [ ] **Step 2: 등록하는 부품**

`components/RegisterServiceWorker.jsx`:

```jsx
'use client';

import { useEffect } from 'react';

// 서비스워커를 한 번 등록한다. 화면에 아무것도 안 그린다.
//
// 실패해도 조용히 넘어간다. 설치는 편의이고, 실패를 배너로 띄우면 "앱이
// 고장났나"로 읽힌다 — TaskActivity 의 멘션 자동완성이 같은 판단이다.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
```

- [ ] **Step 3: `app/layout.js`**

**기존 `title`·`description`·폰트·className 은 한 글자도 안 건드린다.**
더하는 것만 적는다:

```js
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
```

metadata 를 이렇게 바꾼다:

```js
export const metadata = {
  title: '모아 MOA',
  description: '요구사항과 프로젝트를 한곳에 모읍니다.',
  manifest: '/manifest.json',
  // iOS 는 설치 프롬프트가 없다. 사용자가 공유 → 홈 화면에 추가를 직접
  // 해야 하고, apple-touch-icon 이 없으면 화면을 찍어서 아이콘으로 쓴다.
  appleWebApp: { capable: true, title: '모아', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

// themeColor 를 metadata 에 두면 Next 15 부터 빌드 경고가 난다.
export const viewport = { themeColor: '#4f46e5' };
```

`<body>` 안 맨 끝에 한 줄:

```jsx
<body className="min-h-full flex flex-col">
  {children}
  <RegisterServiceWorker />
</body>
```

- [ ] **Step 4: 확인한다**

```
npx vitest run
npm run lint
npm run build
```

기대: **80 파일 / 1248 테스트.** 기준선 78/1233 에 매처 테스트 9개와
매니페스트 테스트 6개가 는다. 실제 수가 다르면 그대로 보고하되,
**기준선보다 줄어들면 안 된다.** lint 는 기존 `ImageDropzone.jsx` 경고 하나만.
build 는 `✓ Compiled successfully`.

빌드 로그에 **`themeColor` 경고가 없어야 한다.** 있으면 Step 3 의 `viewport`
분리가 안 먹은 것이다.

- [ ] **Step 5: 커밋**

```bash
git add -- public/sw.js components/RegisterServiceWorker.jsx app/layout.js
git commit -m "feat: 서비스워커 등록과 PWA metadata"
```

---

### Task 5: 확인과 배포

- [ ] **Step 1: 낡은 dev 서버를 죽인다**

3단계에서 낡은 서버가 500을 냈고 하마터면 리팩터를 의심할 뻔했다.
**서비스워커는 그보다 더하다** — 낡은 워커가 남으면 고친 것이 반영이 안 된다.

- [ ] **Step 2: 로그인 **전**에 세 주소를 본다**

이것이 Task 1 의 진짜 확인이다. 로그인하면 쿠키가 붙어 통과하므로
**반드시 시크릿 창이나 로그아웃 상태에서** 본다.

```
http://localhost:3000/manifest.json
http://localhost:3000/sw.js
http://localhost:3000/icons/icon-192.png
```

기대: 셋 다 **200**. `/login` 으로 튕기면 실패다.

- [ ] **Step 3: 배포**

```
npm run package:src
```

- [ ] **Step 4: 사용자가 볼 것**

| | |
|---|---|
| PC 크롬, 로그인 전 | 위 세 주소가 200 |
| PC 크롬, 로그인 후 | 주소창에 설치 아이콘 |
| 설치 | 창으로 뜨고 `/launch` 가 나온다 |
| 안드로이드 크롬 | 「앱 설치」가 뜬다 |
| **아이폰 사파리** | 공유 → 홈 화면에 추가 → **아이콘이 화면 캡처가 아니다** |
| 아이폰, 깐 앱 | 로그인 화면이 뜬다(**정상** — 별개 저장소다). 로그인하면 유지된다 |
| 깐 앱에서 한 바퀴 | 런칭 보드 · 주간 진척 · 항목 창 · 요구사항 목록 |
| 배포 후 | 고친 화면이 **바로** 반영된다 (캐싱을 안 넣은 것이 이 확인이다) |

**마지막 한 바퀴가 이번 작업의 진짜 목적이다.** 폰에서 무엇이 안 되는지
적어 온다. 그것이 다음 단계의 목록이 된다.

---

## 안 하는 것

| | 왜 |
|---|---|
| 오프라인 캐싱 | 볼 것이 전부 서버에 있다. 낡은 화면 문제만 생긴다 |
| 푸시 | 폰에서 쓸 만한지부터 안다. 권한은 한 번 거절당하면 끝이다 |
| QR 팝업 | 찍기·로그인·설치 세 단계다. 지금은 본인 폰 하나면 된다 |
| 설치 유도 배너 | 쓰는 사람이 하나다 |
| 모바일 화면 고치기 | 무엇을 고칠지 Task 5 가 알려 준 뒤에 한다 |
| iOS 스플래시 | 기기마다 한 장씩이라 값이 안 맞는다 |
