# PWA 2단계 구현 계획 — 설치 안내와 가이드

> **에이전트에게:** 이 계획은 작업 단위로 서브에이전트를 띄워 실행한다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 폰에 깔 수 있다는 것을 알리고, 깔 수 있는 자리를 만든다. 푸시는 안 한다.

**구조:** `/install` 페이지 하나, 정적 QR 한 장, 계정 메뉴 한 줄, 그리고 소식
팝업이 링크와 그림을 실을 수 있게 넓히는 일.

**스택:** Next.js 16 App Router (JS), Tailwind v4, vitest(`environment: 'node'`).

**스펙:** `docs/superpowers/specs/2026-09-09-pwa-install-guide-design.md`

**기준선: 80 파일 / 1249 테스트 전부 통과.** 줄면 안 된다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `scripts/make-qr.mjs` | 설치 주소 QR 을 굽는다. 이름에 내용 해시 |
| `public/icons/install-qr.<hash>.png` | 결과물. **커밋한다** |
| `components/news/NewsItem.jsx` | 소식 한 줄. **세 곳이 함께 쓴다** |
| `lib/newsItems.js` | `href`·`cta`·`image` 를 받는 항목 하나 추가 |
| `app/install/layout.js` | 상단바 껍데기. `/help` 와 같은 모양 |
| `app/install/page.js` | 안내 본문 |
| `components/install/InstallGuide.jsx` | 깐 앱 감지·인쇄 단추 (클라이언트) |
| `components/TopBar.jsx` | 계정 메뉴에 한 줄 |

**세 곳이 소식을 그린다** — `NewsDialog`(팝업) · `NewsMenu`(팝오버) ·
`help/NewsBody`(기록). 앞의 둘과 셋째 중 **팝업과 기록은 지금 글자까지
똑같다.** 링크와 그림을 세 번 따로 넣으면 언젠가 한 곳만 고친다. 부품으로
뽑고 팝오버만 `compact` 로 줄인다.

---

### Task 1: QR 굽기

**Files:**
- Modify: `package.json` (`npm i -D qrcode`)
- Create: `scripts/make-qr.mjs`, `public/icons/install-qr.<hash>.png`

- [ ] **Step 1: 라이브러리를 devDependency 로 넣는다**

```
npm i -D qrcode
```

**`-D` 여야 한다.** 결과물 PNG 를 커밋하므로 런타임에는 필요 없다.

- [ ] **Step 2: 스크립트를 쓴다**

`scripts/make-qr.mjs`:

```js
// 설치 주소 QR 을 굽는다.
//
// 주소가 안 바뀐다(https://moa.noavibe.app 하나뿐). 그러면 런타임에 만들 것이
// 아니라 한 번 구워 커밋할 것이다 — 화면은 <img> 하나면 되고 의존성이 안 는다.
//
// 이름에 내용 해시를 넣는다. 아이콘에서 겪은 일이다: 주소가 그대로면 그림을
// 바꿔도 브라우저가 옛것을 계속 쓴다. 배포는 정상인데 화면만 안 바뀐다.
//
// qrcode 는 devDependency 다. 결과물이 커밋되므로 빌드도 런타임도 안 다친다.
//
// 돌리는 법: node scripts/make-qr.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';

const OUT = join(process.cwd(), 'public', 'icons');
const URL = 'https://moa.noavibe.app';

// 512px. 화면에는 200px 안팎으로 그리지만, 인쇄했을 때 카메라가 잡으려면
// 원본이 커야 한다(§8 의 인쇄용 서식).
//
// 여백(margin)을 2 로 둔다. QR 은 사방에 흰 여백이 있어야 인식된다 — 0 으로
// 두면 종이나 어두운 배경에 붙었을 때 못 읽는다.
const png = await QRCode.toBuffer(URL, {
  type: 'png',
  width: 512,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#0f172a', light: '#ffffff' },
});

const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
const file = `install-qr.${hash}.png`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, file), png);

// 지난 판을 치운다. 우리가 만든 이름만 건드린다.
for (const name of readdirSync(OUT)) {
  if (/^install-qr(\.[0-9a-f]{8})?\.png$/.test(name) && name !== file) {
    rmSync(join(OUT, name));
    console.log(`  (지움) ${name}`);
  }
}

console.log(`  ${file}`);
console.log('');
console.log('lib/newsItems.js 의 image 에 이 주소를 적으세요:');
console.log(`  /icons/${file}`);
```

- [ ] **Step 3: 돌리고 눈으로 본다**

```
node scripts/make-qr.mjs
```

**그림을 반드시 열어 본다.** 그리고 **폰으로 실제로 찍어 본다** — 화면의
QR 을 폰 카메라로 비춰 `moa.noavibe.app` 이 뜨는지 본다. 이걸 안 하면
"모양은 QR 인데 안 읽히는 그림"을 배포하게 된다.

- [ ] **Step 4: `.gitignore` 를 확인한다**

```
git check-ignore -v public/icons/install-qr.*.png; echo "exit=$?"
```

기대: **아무것도 안 나오고 `exit=1`.** 무언가 나오면 그 규칙을 고친다 —
`scripts/package-zip.mjs` 는 git 이 추적하는 파일만 ZIP 에 담으므로,
무시되면 **배포본에만 QR 이 빠지고 로컬에서는 잘 된다.**

- [ ] **Step 5: 커밋**

```bash
git add -- package.json package-lock.json scripts/make-qr.mjs public/icons
git commit -m "feat: 설치 안내용 QR 을 굽는 스크립트와 결과물"
```

---

### Task 2: 소식 항목 부품과 링크·그림

**Files:**
- Create: `components/news/NewsItem.jsx`
- Modify: `components/NewsDialog.jsx`, `components/NewsMenu.jsx`, `components/help/NewsBody.jsx`
- Modify: `lib/newsItems.js` (주석만), `lib/newsItems.test.js`

- [ ] **Step 1: 지금 셋이 똑같은지 먼저 확인한다**

```
grep -n "border-l-2 border-indigo-500" components/NewsDialog.jsx components/NewsMenu.jsx components/help/NewsBody.jsx
```

기대: 세 곳에 나온다. **팝업과 기록은 글자 크기까지 같고, 팝오버만 작다**
(`text-xs` · `mt-0.5` · `pl-2.5`). 다르면 그대로 보고하고 멈춘다.

- [ ] **Step 2: 부품을 만든다**

`components/news/NewsItem.jsx`:

```jsx
import Link from 'next/link';

// 소식 한 줄. 세 곳이 함께 쓴다 — 팝업(NewsDialog) · 팝오버(NewsMenu) ·
// 기록(help/NewsBody).
//
// 부품으로 뽑은 이유: 링크와 그림을 세 곳에 따로 넣으면 언젠가 한 곳만
// 고친다. 그리고 그 실패는 조용하다 — 팝업에서는 단추가 보이는데 기록에는
// 없는 식이라 아무도 오류로 안 본다.
//
// item: { date, title, body, href?, cta?, image? }
//   href·cta — 그 소식이 시키는 일이 있을 때. 팝업·팝오버·기록 다 그린다
//   image    — 팝업에서만 그린다. 팝오버(320px)는 좁고, 기록은 훑는 자리다
//
// compact 는 팝오버다. 폭이 320px 이라 글자를 한 단계 줄인다.
export function NewsItem({ item, compact = false }) {
  return (
    <li className={`border-l-2 border-indigo-500 ${compact ? 'pl-2.5' : 'pl-3'}`}>
      <p className="text-[11px] text-slate-400">{item.date}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{item.title}</p>
      <p
        className={`break-keep leading-relaxed text-slate-600 ${
          compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'
        }`}
      >
        {item.body}
      </p>

      {/* 그림은 팝업에서만. 여기가 "읽고 나중에" 를 "지금" 으로 바꾸는
          자리다 — QR 이 눈앞에 있으면 폰을 그 자리에서 든다. */}
      {item.image && !compact && (
        <img
          src={item.image}
          alt=""
          className="mt-2 h-40 w-40 rounded-lg border border-slate-200 bg-white p-1.5"
        />
      )}

      {item.href && item.cta && (
        <Link
          href={item.href}
          className={`mt-2 inline-block font-medium text-indigo-700 hover:underline ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {item.cta} →
        </Link>
      )}
    </li>
  );
}
```

- [ ] **Step 3: 세 곳이 그것을 쓰게 한다**

`components/NewsDialog.jsx` 의 `<li>…</li>` 를 통째로 바꾼다:

```jsx
{items.map((item) => (
  <NewsItem key={item.date} item={item} />
))}
```

`components/help/NewsBody.jsx` 도 같다(`compact` 없이).

`components/NewsMenu.jsx` 의 팝오버는 `compact` 를 넘긴다:

```jsx
{visible.map((item) => (
  <NewsItem key={item.date} item={item} compact />
))}
```

**세 곳 다 `import { NewsItem } from '@/components/news/NewsItem';` 를 더한다.**

- [ ] **Step 4: 화면이 안 바뀐 것을 확인한다**

```
npm run build
```

그리고 **눈으로** 본다 — 팝업·팝오버·도움말의 소식이 **지금과 똑같이**
보여야 한다. 기존 소식 항목에는 `href`·`cta`·`image` 가 없으므로 새 코드는
전부 안 그려진다.

- [ ] **Step 5: 규칙을 테스트로 못 박는다**

`lib/newsItems.test.js` 맨 아래에 더한다:

```js
describe('NEWS 항목의 모양', () => {
  it('href 가 있으면 cta 도 있다 — 이름 없는 단추를 그릴 수 없다', () => {
    for (const item of NEWS) {
      if (item.href) expect(item.cta, item.date).toBeTruthy();
    }
  });

  it('cta 가 있으면 href 도 있다 — 갈 곳 없는 단추를 그릴 수 없다', () => {
    for (const item of NEWS) {
      if (item.cta) expect(item.href, item.date).toBeTruthy();
    }
  });

  // 파일 이름에 해시가 붙어 있어서, 그림을 다시 구우면 이름이 바뀐다.
  // 여기서 안 잡으면 소식 팝업에 깨진 그림이 뜨고 아무도 오류로 안 본다.
  it('image 가 가리키는 파일이 실제로 있다', () => {
    for (const item of NEWS) {
      if (!item.image) continue;
      const path = join(process.cwd(), 'public', item.image);
      expect(existsSync(path), item.image).toBe(true);
    }
  });
});
```

파일 맨 위에 필요한 import 를 더한다:

```js
import { existsSync } from 'node:fs';
import { join } from 'node:path';
```

- [ ] **Step 6: 돌린다**

```
npx vitest run lib/newsItems.test.js
```

기대: 기존 것에 3개가 늘어 전부 PASS(지금 `NEWS` 에는 셋 다 없으므로 반복문이
빈 채로 통과한다 — Task 5 에서 실제로 값이 생긴다).

- [ ] **Step 7: 커밋**

```bash
git add -- components/news components/NewsDialog.jsx components/NewsMenu.jsx components/help/NewsBody.jsx lib/newsItems.test.js
git commit -m "refactor: 소식 한 줄을 부품으로 뽑고 링크·그림을 받게"
```

---

### Task 3: `/install` 페이지

**Files:**
- Create: `app/install/layout.js`, `app/install/page.js`, `components/install/InstallGuide.jsx`

- [ ] **Step 1: 껍데기**

`app/install/layout.js` — `app/help/layout.js` 와 같은 모양인데 **상단바를
인쇄에서 뺀다**:

```jsx
import { IdentityProvider } from '@/components/IdentityProvider';
import { TopBar } from '@/components/TopBar';

export default function InstallLayout({ children }) {
  return (
    <IdentityProvider>
      <div className="min-h-screen bg-slate-50 print:bg-white">
        {/* 인쇄물에 상단바가 들어갈 이유가 없다. 이 페이지는 종이로 나눠
            주려고 인쇄한다(스펙 §8) — 그때 필요한 건 QR 과 순서뿐이다.
            globals.css 를 안 건드린다. 여기서만 끈다. */}
        <div className="print:hidden">
          <TopBar />
        </div>
        <main className="p-4">{children}</main>
      </div>
    </IdentityProvider>
  );
}
```

- [ ] **Step 2: 본문**

`app/install/page.js`:

```jsx
import { InstallGuide } from '@/components/install/InstallGuide';

// 폰에 앱으로 까는 방법.
//
// 페이지다. 팝업이 아니다 — QR 을 찍는 동안 열려 있어야 하고, 인쇄해서
// 나눠 줄 수도 있어야 한다(스펙 §3·§8).
//
// 로그인한 사람만 본다. 이 안내를 받을 사람은 이미 모아 계정이 있는
// 사람이고, PUBLIC_PATHS 를 늘리면 그만큼 열린 화면이 는다(스펙 §9).
export default function InstallPage() {
  return <InstallGuide qr="/icons/install-qr.<Task 1 에서 나온 해시>.png" />;
}
```

**`qr` 은 Task 1 스크립트가 찍어 준 이름을 적는다.** 틀리면 Task 2 의
테스트가 아니라 눈으로만 잡히므로, 여기서는 반드시 스크립트 출력을 보고 적는다.

- [ ] **Step 3: 안내 부품**

`components/install/InstallGuide.jsx`:

```jsx
'use client';

import { useEffect, useState } from 'react';

const APP_URL = 'moa.noavibe.app';

// 홈 화면 앱 안에서 보고 있나.
//
// "지금 이 창"만 안다. PC 브라우저는 그 사람이 폰에 깔았는지 모른다 —
// 그래서 계정 메뉴의 줄은 PC 에서 늘 보인다(스펙 §3).
function useStandalone() {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia?.('(display-mode: standalone)');
    // navigator.standalone 은 iOS 사파리만 준다. 둘 다 본다.
    setStandalone(Boolean(media?.matches) || window.navigator.standalone === true);
  }, []);
  return standalone;
}

function Steps({ title, steps }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
        {steps.map((step) => (
          <li key={step} className="text-sm break-keep text-slate-600">
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InstallGuide({ qr }) {
  const standalone = useStandalone();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 break-keep">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">폰에 설치하기</h1>
        <p className="mt-1 text-sm text-slate-500">
          모아를 폰 홈 화면에 앱처럼 둘 수 있습니다. 바로 열리고, 다음 단계에서 알림도 받을 수
          있습니다.
        </p>
      </header>

      {standalone && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800 print:hidden">
          이미 설치된 앱에서 보고 있습니다. 아래는 다른 기기에 깔 때 쓰세요.
        </p>
      )}

      <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <img src={qr} alt={`${APP_URL} QR 코드`} className="h-48 w-48" />
        {/* 주소를 글자로도 둔다. QR 이 안 찍히는 폰이 있고, 인쇄물이
            흐리게 나올 수도 있다(스펙 §3). */}
        <p className="text-sm font-medium tracking-tight text-slate-900">{APP_URL}</p>
        <p className="text-xs text-slate-500">폰 카메라로 찍거나 주소를 직접 입력하세요.</p>
      </section>

      <Steps
        title="아이폰 · 아이패드"
        steps={[
          '사파리로 엽니다. 크롬으로는 홈 화면에 추가할 수 없습니다.',
          '아래 공유 단추(□↑)를 누릅니다.',
          '「홈 화면에 추가」를 고릅니다.',
          '깐 앱을 열면 로그인 화면이 나옵니다. 한 번 더 로그인하세요 — 고장이 아니라, 홈 화면 앱은 사파리와 저장 공간이 따로입니다.',
        ]}
      />

      <Steps
        title="안드로이드"
        steps={[
          '크롬으로 엽니다.',
          '주소창에 뜨는 「앱 설치」를 누릅니다. 안 보이면 오른쪽 위 ⋮ → 「앱 설치」입니다.',
          '홈 화면에 아이콘이 생깁니다.',
        ]}
      />

      <div className="print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          인쇄 · PDF로 저장
        </button>
        <p className="mt-1.5 text-xs text-slate-400">
          인쇄 창에서 「PDF로 저장」을 고르면 파일로 남길 수 있습니다.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 확인한다**

```
npm run build
```

**낡은 dev 서버를 죽이고** 띄운 뒤 `/install` 을 연다. 볼 것:

| | |
|---|---|
| QR 이 뜬다 | 깨진 그림이 아니다 |
| **폰으로 찍힌다** | `moa.noavibe.app` 이 열린다 |
| 인쇄 미리보기 | **상단바와 인쇄 단추가 빠진다.** QR·주소·두 순서는 남는다 |
| 폰 폭(375px) | 넘치지 않는다 |

- [ ] **Step 5: 커밋**

```bash
git add -- app/install components/install
git commit -m "feat: 폰에 설치하기 안내 페이지"
```

---

### Task 4: 계정 메뉴 한 줄

**Files:**
- Modify: `components/TopBar.jsx`

- [ ] **Step 1: `MenuLink` 하나를 더한다**

「브랜드 설정」·「도움말」이 있는 **아래쪽 묶음**에 둔다. 이동
링크(요구사항·주간회의)와 섞지 않는다 — 그건 매일 쓰는 것이고 이건 한 번
쓰는 것이다.

```jsx
<MenuLink href="/install" onClick={closeMenu}>폰에 설치하기</MenuLink>
```

**권한으로 가리지 않는다.** 깔 사람은 전부다.

- [ ] **Step 2: 확인하고 커밋**

```
npm run build && npx vitest run
```

```bash
git add -- components/TopBar.jsx
git commit -m "feat: 계정 메뉴에 「폰에 설치하기」"
```

---

### Task 5: 소식 한 줄

**Files:**
- Modify: `lib/newsItems.js`

- [ ] **Step 1: 맨 위에 항목을 더한다**

`NEWS` 배열의 **맨 앞**에 넣는다. **날짜는 기존 어느 것보다 나중이어야
한다** — 지금 맨 위가 `2026-09-05` 다. 앞선 날짜로 끼우면 이미 본 사람에게는
영영 안 보인다.

```js
{
  date: '2026-09-11',
  title: '모아를 폰에 앱으로 깔 수 있습니다',
  body: '홈 화면에서 바로 열리고, 주소창 없이 앱처럼 씁니다. 아래 QR 을 폰으로 찍으면 됩니다. 아이폰은 사파리에서 공유 → 홈 화면에 추가를 직접 해야 하고, 깐 뒤에 한 번 더 로그인해야 합니다.',
  image: '/icons/install-qr.<Task 1 에서 나온 해시>.png',
  href: '/install',
  cta: '설치 방법 자세히 보기',
},
```

**`image` 는 Task 1 스크립트가 찍어 준 이름 그대로 적는다.** 틀리면 Task 2
Step 5 의 테스트가 잡는다.

- [ ] **Step 2: 돌린다**

```
npx vitest run lib/newsItems.test.js
```

기대: 전부 PASS. 하나라도 실패하면 **파일 이름이 틀린 것이다.**

- [ ] **Step 3: 눈으로 본다**

로그인해서 팝업이 뜨는지, **그 안에 QR 과 단추가 있는지** 본다.
팝업이 이미 떴던 계정이면 안 뜨므로, 확인하려면 브라우저의 `localStorage`
에서 `moa.news.dismissed` 를 지우고 새로고침한다.

- [ ] **Step 4: 커밋**

```bash
git add -- lib/newsItems.js
git commit -m "feat: 모바일 앱 소식 한 줄"
```

---

### Task 6: 점검과 배포

- [ ] **Step 1: 전체**

```
npx vitest run && npm run lint && npm run build
```

기대: **80 파일 / 1252 테스트**(기준선 1249 + Task 2 의 3개). lint 는 기존
`components/ImageDropzone.jsx` 경고 하나만.

- [ ] **Step 2: 브라우저로 한 바퀴**

**낡은 dev 서버를 먼저 죽인다.** 지난 단계마다 하나씩 살아 있었다.

| | |
|---|---|
| 소식 팝업 | 뜨고, **QR 과 단추가 보인다** |
| 팝업에서 QR 찍기 | 폰에서 모아가 열린다 |
| 「확인했습니다」 | 점이 사라지고 **다시 로그인해도 안 돌아온다** |
| X 로 닫기 | 점이 **남는다** |
| 소식 팝오버 | 글자 링크가 보이고 **QR 은 안 보인다** |
| 도움말 → 업데이트 소식 | 안 깨진다 |
| 계정 메뉴 | 「폰에 설치하기」가 보인다 |
| `/install` PC | QR · 주소 · 두 순서 |
| `/install` 깐 앱에서 | 「이미 설치된 앱에서 보고 있습니다」 |
| 인쇄 미리보기 | 상단바가 빠지고 QR 과 주소가 남는다 |
| `/install` 폰 | 폰 폭에서 안 넘친다 |

- [ ] **Step 3: 배포**

```
npm run package:src
```

**ZIP 안에 QR 이 실렸는지 확인한다.** 아이콘 때 이것이 실패할 뻔했다.

---

## 안 하는 것

| | 왜 |
|---|---|
| 토스트 | 스펙 §1 — 사라지는 알림에 폰을 꺼내야 하는 할 일을 못 싣는다 |
| 화면 위 배너 | 스펙 §2 — 끄기 상태를 새로 둘 자리가 필요해진다 |
| 별도 PDF 파일 | 스펙 §8 — 두 곳이 갈라진다 |
| 스플래시 | 스펙 §7 — 안드로이드는 이미 되고, iOS 는 서른 장이다 |
| 푸시 | 3단계 |
| 첫 안내를 안 마친 8명 | 스펙 §14 — 도입 문제라 따로 본다 |
