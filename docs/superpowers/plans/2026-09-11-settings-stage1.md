# 설정 1단계 구현 계획 — 입구를 하나로

> **에이전트에게:** 이 계획은 작업 단위로 서브에이전트를 띄워 실행한다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 흩어진 설정 화면 여섯을 `/settings` 하나로 모으고 왼쪽 레일을 단다.
**화면 내용은 안 바꾼다.** 팀원 목록 다시 짜기는 2단계다.

**구조:** `app/settings/` 아래로 페이지를 **옮기고**, 레일을 다는 레이아웃
하나를 만들고, 옛 주소는 리다이렉트로 살린다.

**스택:** Next.js 16.3.4 App Router (JS), Tailwind v4, vitest(`environment: 'node'`).

**스펙:** `docs/superpowers/specs/2026-09-11-settings-redesign-design.md`

**브랜치:** `feature/settings-redesign` (이미 만들어 스펙을 커밋했다)

**기준선: 80 파일 / 1252 테스트 전부 통과. lint 경고 1건**(기존
`components/ImageDropzone.jsx`). 둘 다 나빠지면 안 된다.

---

## 파일 구조

| 파일 | 무엇 |
|---|---|
| `lib/settingsNav.js` | 레일의 묶음 정의 + 권한으로 고르는 함수 |
| `lib/settingsNav.test.js` | 4차·2차·전체관리자가 각각 무엇을 보나 |
| `app/settings/layout.js` | 상단바 + 레일 + 본문 |
| `components/settings/SettingsRail.jsx` | 레일. 폰에서는 `<select>` |
| `app/settings/profile/page.js` | 새로 만든다 (지금 없는 화면) |
| `app/settings/password/page.js` | `app/change-password` 를 가리키거나 옮긴다 — **Task 3 에서 실제를 보고 정한다** |
| `app/settings/install/page.js` | `app/install/page.js` 를 옮긴다 |
| `app/settings/brand/team/page.js` | `app/requirements/settings` 의 **위쪽 절반** |
| `app/settings/brand/categories/page.js` | 그 **아래쪽 절반** |
| `app/settings/brands/page.js` | `app/admin/brands` 를 옮긴다 |
| `app/settings/members/page.js` | `app/admin/members` 를 옮긴다 |
| `app/settings/organizations/page.js` | `app/admin/organizations` 를 옮긴다 |
| `app/settings/feedback/page.js` | `app/admin/feedback` 를 옮긴다 |
| `next.config.mjs` | 옛 주소 여섯을 리다이렉트 |
| `lib/redirects.test.js` | 그 여섯이 안 죽게 못 박는다 |
| `components/TopBar.jsx` | 메뉴를 세 줄로, 상단바에서 조직 관리 빼기 |
| ~~`components/AdminSectionNav.jsx`~~ | 지운다 |

**`app/admin/dashboard` 는 그대로 둔다.** 설정이 아니다. 그래서
`app/admin/layout.js` 도 남는다.

---

### Task 1: `lib/settingsNav.js` — 순수 로직

**Files:** Create `lib/settingsNav.js`, `lib/settingsNav.test.js`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`lib/settingsNav.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { settingsGroupsFor, settingsItemsFor, isSettingsPathAllowed } from './settingsNav';

const guest = { tier: '4차' };
const brandAdmin = { tier: '2차' };
const global = { tier: '4차', isGlobalAdmin: true };

describe('settingsGroupsFor', () => {
  it('누구나 내 계정은 본다', () => {
    expect(settingsGroupsFor(guest).map((g) => g.id)).toEqual(['account']);
  });

  it('브랜드 관리자는 이 브랜드까지', () => {
    expect(settingsGroupsFor(brandAdmin).map((g) => g.id)).toEqual(['account', 'brand']);
  });

  // 전체관리자는 등급과 무관하게 전부 본다. isGlobalAdmin 이 등급을 덮는
  // 규칙은 lib/tiers.js 가 이미 정해 뒀다 — 여기서 다시 정하지 않는다.
  it('전체관리자는 셋 다', () => {
    expect(settingsGroupsFor(global).map((g) => g.id)).toEqual(['account', 'brand', 'org']);
  });

  it('identity 가 없어도 죽지 않는다', () => {
    expect(settingsGroupsFor(undefined).map((g) => g.id)).toEqual(['account']);
  });
});

describe('isSettingsPathAllowed', () => {
  it('내 것은 누구나', () => {
    expect(isSettingsPathAllowed(guest, '/settings/profile')).toBe(true);
  });

  it('남의 것은 막는다', () => {
    expect(isSettingsPathAllowed(guest, '/settings/members')).toBe(false);
    expect(isSettingsPathAllowed(brandAdmin, '/settings/members')).toBe(false);
  });

  it('전체관리자는 다 된다', () => {
    expect(isSettingsPathAllowed(global, '/settings/members')).toBe(true);
  });

  // 모르는 주소를 true 로 돌리면 새 화면을 더할 때 문지기가 조용히 빠진다.
  it('목록에 없는 주소는 막는다', () => {
    expect(isSettingsPathAllowed(global, '/settings/unknown')).toBe(false);
  });
});

describe('settingsItemsFor', () => {
  it('묶음을 펴서 줄만 준다 — 폰의 select 가 쓴다', () => {
    const items = settingsItemsFor(global);
    expect(items.length).toBe(9);
    expect(items[0].href).toBe('/settings/profile');
    expect(items[0].group).toBe('내 계정');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```
npx vitest run lib/settingsNav.test.js
```

기대: 파일이 없어 **전부 FAIL.**

- [ ] **Step 3: 만든다**

`lib/settingsNav.js`:

```js
import { canManageBrand, isGlobalAdmin } from './tiers';

// 설정 레일의 묶음.
//
// 여기 있는 것이 곧 설정의 전부다. 화면을 더할 때 이 목록에 한 줄을 넣으면
// 레일과 폰의 select 가 함께 늘어난다 — 두 곳을 맞추게 하면 언젠가 한쪽만
// 고친다.
//
// 묶음 제목에 브랜드 이름을 붙이는 일은 화면이 한다(SettingsRail). 여기서
// 붙이면 순수 함수가 identity 의 브랜드 이름까지 알아야 한다.
export const SETTINGS_GROUPS = [
  {
    id: 'account',
    title: '내 계정',
    items: [
      { href: '/settings/profile', label: '내 정보' },
      { href: '/settings/password', label: '비밀번호' },
      { href: '/settings/install', label: '폰에 설치하기' },
    ],
  },
  {
    // 「이 브랜드」다. 아래 org 묶음의 「브랜드」와 이름이 겹쳐 보이지만
    // 묶음이 달라서 안 헷갈린다 — 그게 이 화면을 다시 짠 이유다.
    id: 'brand',
    title: '이 브랜드',
    need: 'brand',
    items: [
      { href: '/settings/brand/team', label: '팀' },
      { href: '/settings/brand/categories', label: '분류' },
    ],
  },
  {
    id: 'org',
    title: '전사',
    need: 'global',
    items: [
      { href: '/settings/brands', label: '브랜드' },
      { href: '/settings/members', label: '팀원' },
      { href: '/settings/organizations', label: '조직 · 직무' },
      { href: '/settings/feedback', label: '받은 의견' },
    ],
  },
];

// 이 사람이 볼 수 있는 묶음.
export function settingsGroupsFor(identity) {
  return SETTINGS_GROUPS.filter((group) => {
    if (group.need === 'brand') return canManageBrand(identity);
    if (group.need === 'global') return isGlobalAdmin(identity);
    return true;
  });
}

// 묶음을 펴서 줄만. 폰의 select 와 문지기가 쓴다.
export function settingsItemsFor(identity) {
  return settingsGroupsFor(identity).flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.title })),
  );
}

// 이 주소를 볼 수 있나.
//
// 목록에 없는 주소는 막는다. true 로 돌리면 새 화면을 더하면서 목록에
// 안 넣었을 때 문지기가 조용히 빠진다.
export function isSettingsPathAllowed(identity, pathname) {
  return settingsItemsFor(identity).some((item) => item.href === pathname);
}
```

- [ ] **Step 4: 통과 확인**

```
npx vitest run lib/settingsNav.test.js
```

기대: 9개 PASS.

- [ ] **Step 5: 커밋**

```bash
git add -- lib/settingsNav.js lib/settingsNav.test.js
git commit -m "feat: 설정 레일의 묶음 정의와 권한 판정"
```

---

### Task 2: 레이아웃과 레일

**Files:** Create `app/settings/layout.js`, `components/settings/SettingsRail.jsx`

- [ ] **Step 1: 레이아웃**

`app/settings/layout.js` — `app/admin/layout.js` 와 같은 뼈대에 레일을 더한다:

```jsx
import { IdentityProvider } from '@/components/IdentityProvider';
import { TopBar } from '@/components/TopBar';
import { SettingsRail } from '@/components/settings/SettingsRail';

// 설정은 한 입구다.
//
// 예전에는 브랜드 관리·팀원 관리·받은 의견이 계정 메뉴에도 있고 관리 화면의
// 탭으로도 있었다. 같은 곳으로 가는 길이 둘이었고, 「브랜드 설정」과
// 「브랜드 관리」는 다른 화면인데 메뉴에서 네 줄 떨어져 있었다.
// 레일로 묶음을 보이면 자리가 이름을 설명한다.
export default function SettingsLayout({ children }) {
  return (
    <IdentityProvider>
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <main className="p-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
            <SettingsRail />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </main>
      </div>
    </IdentityProvider>
  );
}
```

- [ ] **Step 2: 레일**

`components/settings/SettingsRail.jsx`:

```jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { settingsGroupsFor } from '@/lib/settingsNav';

// 설정 레일.
//
// 폰(375px)에는 레일을 둘 자리가 없다. 같은 목록을 select 로 접는다 —
// 두 벌을 따로 만들지 않고 lib/settingsNav.js 하나를 함께 본다.
export function SettingsRail() {
  const { identity } = useIdentity();
  const pathname = usePathname();
  const router = useRouter();

  const groups = settingsGroupsFor(identity);

  // 브랜드 이름은 identity 에 없다(brandId 와 tier 뿐이다 — 확인함).
  // BrandSwitcher 가 하는 것과 같은 조회를 여기서도 한다.
  //
  // 이 이름을 굳이 붙이는 이유: 이 묶음의 화면들은 **지금 보고 있는
  // 브랜드**를 고친다. 어느 브랜드인지 모르는 채로 팀 배치를 건드리는 것이
  // 가장 위험하다 — BrandSwitcher 주석이 같은 말을 적어 뒀다.
  const [brandName, setBrandName] = useState('');
  useEffect(() => {
    if (!identity?.brandId) return undefined;
    let cancelled = false;
    fetch('/api/my-brands')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setBrandName(d.brands?.find((b) => b.id === identity.brandId)?.name ?? '');
      })
      // 못 받아도 그만이다. 제목이 「이 브랜드」로 남을 뿐 화면은 다 돈다.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [identity?.brandId]);

  const title = (group) =>
    group.id === 'brand' && brandName ? `이 브랜드 · ${brandName}` : group.title;

  return (
    <>
      {/* 폰 */}
      <div className="lg:hidden">
        <label className="sr-only" htmlFor="settings-nav">설정 화면</label>
        <select
          id="settings-nav"
          value={pathname}
          onChange={(e) => router.push(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          {groups.map((group) => (
            <optgroup key={group.id} label={title(group)}>
              {group.items.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 데스크톱 */}
      <nav aria-label="설정" className="hidden w-48 shrink-0 lg:block">
        <p className="px-2 pb-2 text-sm font-semibold text-slate-900">설정</p>
        {groups.map((group) => (
          <div key={group.id} className="mt-2 first:mt-0">
            <p className="px-2 py-1 text-[11px] font-medium text-slate-400">{title(group)}</p>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-lg px-2 py-1.5 text-sm ${
                    active ? 'bg-indigo-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
```

**`identity` 에는 브랜드 이름이 없다 — 확인했다.** `brandId` 와 `tier` 뿐이다
(`lib/identity.js`). 이름은 `/api/my-brands` 가 준다. `BrandSwitcher` 가 이미
그렇게 받아 쓰고 있으니 같은 길을 쓴다.

**조회에 실패해도 화면은 다 돈다.** 제목이 「이 브랜드」로 남을 뿐이다 —
레일이 안 그려지거나 배너가 뜨면 안 된다. 이 저장소가 멘션 자동완성과
설치 안내에서 이미 쓰는 판단이다.

**이 `useEffect` 는 `react-hooks/set-state-in-effect` 에 안 걸린다.**
그 규칙이 막는 것은 effect 몸통에서 **바로** `setState` 를 부르는 것이고,
여기서는 `fetch().then()` 안이라 비동기다. `TaskActivity` 와 `NewsMenu` 가
같은 모양으로 이미 통과하고 있다. 앞서 두 번 걸렸던 자리는 브라우저 값을
동기로 읽어 넣던 곳이라 성격이 다르다.

- [ ] **Step 3: 확인하고 커밋**

`npm run build` 가 통과하면 된다(아직 이 레이아웃 밑에 페이지가 없다).

```bash
git add -- app/settings components/settings
git commit -m "feat: 설정 레이아웃과 왼쪽 레일"
```

---

### Task 3: 화면을 옮긴다

**Files:** `git mv` 넷 + 새 페이지 셋

- [ ] **Step 1: 지금 무엇이 있는지 먼저 본다**

```
ls app/admin app/install app/change-password app/requirements/settings
```

**`app/change-password` 가 이미 있다.** 그것을 옮길지, `/settings/password`
에서 그 화면 부품만 다시 쓸지 **파일을 보고 정한다.** 이 화면은
`PUBLIC_PATHS` 에 들어 있어서(비밀번호를 바꿔야 로그인이 끝나는 사람이
있다) **통째로 옮기면 그 흐름이 깨진다.** 옮기지 말고, `/settings/password`
에서 같은 부품을 그리는 쪽을 먼저 검토하라. 결정을 보고하라.

- [ ] **Step 2: 넷을 옮긴다**

```bash
mkdir -p app/settings/brands app/settings/members app/settings/organizations app/settings/feedback
git mv app/admin/brands/page.js app/settings/brands/page.js
git mv app/admin/members/page.js app/settings/members/page.js
git mv app/admin/organizations/page.js app/settings/organizations/page.js
git mv app/admin/feedback/page.js app/settings/feedback/page.js
git mv app/install/page.js app/settings/install/page.js
rm app/install/layout.js
```

**옮긴 파일에서 고칠 것은 둘뿐이다:**
- `AdminSectionNav` import 와 그것을 그리는 줄을 지운다 (셋에 있다)
- 화면 제목이 레일의 이름과 겹치면 한쪽만 남긴다

**`app/install/layout.js` 를 지우는 이유:** 그 레이아웃이 하던 인쇄용
`print:hidden` 은 **설정 레이아웃으로 옮겨야 한다.** 안 옮기면 인쇄물에
상단바가 다시 들어온다. `app/settings/layout.js` 의 `<TopBar />` 를
`<div className="print:hidden">` 으로 감싸고, 바깥 div 에 `print:bg-white`
를 더한다.

- [ ] **Step 3: 브랜드 설정을 둘로 가른다**

`app/requirements/settings/page.js` (76줄)가 두 화면을 한 페이지에 그리고
있다. **이번 단계에서 내용이 실제로 갈라지는 유일한 자리다.**

`app/settings/brand/team/page.js` — 위쪽. `/api/brand-team` 과
`/api/team-members` 를 받아 `<BrandTeamSection>` 을 그린다.

`app/settings/brand/categories/page.js` — 아래쪽. `/api/brand-categories` 를
받아 `<CategorySettings>` 를 그린다.

**둘 다 원본의 문지기를 그대로 가져간다** — `canManageBrand` 가 아니면
`router.replace('/requirements')`. 원본의 `loadError` 처리와
`reloadToken` 새로고침도 그대로 가져간다.

원본 `app/requirements/settings/page.js` 는 지운다.

- [ ] **Step 4: 새 화면 하나 — 내 정보**

`app/settings/profile/page.js`. **지금 없는 화면이다.** 크게 만들지 말고
읽기 전용으로 시작한다 — 이름·이메일·소속·직무·지금 브랜드와 등급.
`/api/me` 가 무엇을 주는지 보고 맞춘다.

- [ ] **Step 5: 확인**

```
npm run build && npx vitest run && npm run lint
```

**낡은 dev 서버를 죽이고** 띄운 뒤, 로그인 없이 `/settings/brands` 가
`/login` 으로 가는지 본다(미들웨어가 그대로 도는지).

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor: 설정 화면 여섯을 /settings 아래로 옮김"
```

---

### Task 4: 옛 주소를 살린다

**Files:** Modify `next.config.mjs` · Create `lib/redirects.test.js`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`lib/redirects.test.js`:

```js
import { describe, expect, it } from 'vitest';

// 옛 주소가 죽지 않게 지킨다.
//
// 특히 /install 이 중요하다. 2026-09-11 에 내보낸 업데이트 소식의 단추가
// 그 주소를 가리킨다(lib/newsItems.js). 리다이렉트가 빠지면 어제 배포한
// 그 단추가 오늘 죽는다 — 그리고 아무 오류도 안 난다.
const OLD_TO_NEW = {
  '/admin/brands': '/settings/brands',
  '/admin/members': '/settings/members',
  '/admin/organizations': '/settings/organizations',
  '/admin/feedback': '/settings/feedback',
  '/requirements/settings': '/settings/brand/team',
  '/install': '/settings/install',
};

describe('옛 주소 리다이렉트', () => {
  it('여섯이 새 주소를 가리킨다', async () => {
    const config = (await import('../next.config.mjs')).default;
    const rules = await config.redirects();
    const map = Object.fromEntries(rules.map((r) => [r.source, r.destination]));
    expect(map).toMatchObject(OLD_TO_NEW);
  });

  // 308 은 브라우저가 영구히 기억한다. 나중에 주소를 또 옮기면 그 사람
  // 브라우저에서는 옛 규칙이 계속 돈다.
  it('영구 리다이렉트가 아니다', async () => {
    const config = (await import('../next.config.mjs')).default;
    const rules = await config.redirects();
    for (const rule of rules) expect(rule.permanent, rule.source).toBe(false);
  });

  // /admin/dashboard 는 안 옮긴다. 설정이 아니라 보는 화면이다.
  it('대시보드는 안 건드린다', async () => {
    const config = (await import('../next.config.mjs')).default;
    const rules = await config.redirects();
    expect(rules.some((r) => r.source.startsWith('/admin/dashboard'))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

```
npx vitest run lib/redirects.test.js
```

기대: `config.redirects is not a function` 으로 FAIL.

- [ ] **Step 3: `next.config.mjs` 에 더한다**

**기존 `output`·`outputFileTracingRoot` 와 그 주석은 한 글자도 안 건드린다.**
`nextConfig` 객체 안에 더한다:

```js
  // 옛 주소를 살린다.
  //
  // 설정 화면을 /settings 아래로 모으면서 주소가 바뀌었다. 북마크와 문서
  // 안의 링크가 있고, 무엇보다 2026-09-11 에 내보낸 업데이트 소식의 단추가
  // /install 을 가리킨다 — 안 살리면 어제 배포한 그 단추가 죽는다.
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
```

- [ ] **Step 4: 통과 확인 + 실제로 가는지**

```
npx vitest run lib/redirects.test.js
```

그리고 dev 서버에서:

```
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:PORT/install
```

기대: **307 이고 `/settings/install` 로 간다.** 로그인 안 해도 리다이렉트는
먼저 돈다.

- [ ] **Step 5: 커밋**

```bash
git add -- next.config.mjs lib/redirects.test.js
git commit -m "feat: 옛 설정 주소 여섯을 새 주소로 보냄"
```

---

### Task 5: 상단바와 계정 메뉴를 줄인다

**Files:** Modify `components/TopBar.jsx` · Delete `components/AdminSectionNav.jsx`

- [ ] **Step 1: 계정 메뉴**

지금 아홉 줄에서 **세 줄**로. 남길 것: **설정** · 도움말 · 로그아웃.

없앨 것: 브랜드 설정 · 브랜드 관리 · 팀원 관리 · 받은 의견 · 폰에 설치하기 ·
비밀번호 변경. 전부 `/settings` 안에 있다.

**모바일 전용 이동 링크 묶음(`md:hidden` 안의 요구사항·주간회의·런칭·
대시보드)은 그대로 둔다.** 그건 설정이 아니라 이동이다.

**의견 보내기는 안 건드린다.** 상단바 아이콘으로 이미 있고, 「아무 때나
열려 있어야 한다」는 판단으로 거기 놓인 것이다(그 자리 주석).

- [ ] **Step 2: 상단바에서 조직 관리를 뺀다**

`NavLink href="/admin/organizations"` 줄을 지운다. 상단바는 다섯이 된다 —
요구사항 · 주간회의 · 프로젝트 · 런칭 · 대시보드.

- [ ] **Step 3: 탭 부품을 지운다**

```bash
git rm components/AdminSectionNav.jsx
```

Task 3 에서 import 를 이미 지웠어야 한다. 남아 있으면 빌드가 깨진다.

```
grep -rn "AdminSectionNav" --include=*.jsx --include=*.js app components
```

기대: **아무것도 안 나온다.**

- [ ] **Step 4: 확인하고 커밋**

```
npm run build && npx vitest run && npm run lint
```

```bash
git add -A
git commit -m "refactor: 계정 메뉴를 세 줄로, 상단바에서 조직 관리 뺌"
```

---

### Task 6: 점검과 배포

- [ ] **Step 1: 전체**

```
npx vitest run && npm run lint && npm run build
```

기대: **82 파일 / 1264 테스트**(기준선 80/1252 + settingsNav 9 + redirects 3).
실제 수가 다르면 그대로 보고하되 **기준선보다 줄면 안 된다.** lint 는 기존
경고 하나만.

- [ ] **Step 2: 낡은 dev 서버를 죽이고 확인**

| | |
|---|---|
| 계정 메뉴 | 세 줄이다 |
| 상단바 | 조직 관리가 없다 |
| `/settings` | 레일이 뜬다 |
| 레일의 여덟 줄 | 전부 열린다 |
| 브랜드를 바꾸면 | 묶음 제목이 따라 바뀐다 |
| **옛 주소 여섯** | 307 로 새 주소에 간다 |
| **소식 팝업의 단추** | 눌러서 설치 안내가 열린다 |
| `/settings/install` 인쇄 | 상단바가 빠진다 |
| 폰 375px | 레일이 select 로 접히고 optgroup 이 보인다 |
| 비로그인 | `/settings/*` 가 `/login` 으로 간다 |

**등급이 다른 계정으로도 봐야 한다.** 4차는 「내 계정」만, 2차는 「이
브랜드」까지. 로그인이 필요해 못 보면 **"못 봤다"고 명확히 보고한다.**

- [ ] **Step 3: 배포**

```
npm run package:src
```

---

## 안 하는 것

| | 왜 |
|---|---|
| 팀원 목록 다시 짜기 | 2단계 |
| 대시보드 옮기기 | 설정이 아니다 |
| 설정에 「의견 보내기」 | 상단바 아이콘이 이미 한다 |
| `app/change-password` 옮기기 | `PUBLIC_PATHS` 에 있다. 옮기면 첫 로그인 흐름이 깨진다 |
| 권한 체계 손보기 | 화면 일이다. 4차~1차 규칙은 안 건드린다 |
