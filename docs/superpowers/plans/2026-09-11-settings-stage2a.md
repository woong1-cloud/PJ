# 설정 2단계-가 구현 계획 — 직원 목록 다시 짜기

> **에이전트에게:** 이 계획은 작업 단위로 서브에이전트를 띄워 실행한다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 전사 직원 목록(`/settings/members`)에 검색과 필터를 붙이고, 줄에서
조작을 걷어내고, 사람 패널을 만든다.

**2단계를 둘로 나눈 이유.** 줄 안의 브랜드 선택 상자를 없애면 **이미 배치된
사람의 등급을 바꿀 자리가 사라진다.** 지금 `BrandTeamAssignDialog` 는
*새로 배치하는* 일만 하고(`candidates` 가 미배치자다), 기존 등급은 줄 안의
`onChangeTier` 로만 바꾼다. 그래서 사람 패널은 미룰 수 없다. 대신 **다이얼로그
넷을 패널로 흡수하는 것과 여러 줄 일괄은 2단계-나로 미룬다.**

**스택:** Next.js 16.3.4 App Router (JS), Tailwind v4, vitest(`environment: 'node'`).

**스펙:** `docs/superpowers/specs/2026-09-11-settings-redesign-design.md` §7~§12

**브랜치:** `feature/settings-stage2a` (새로 만든다)

**기준선: 83 파일 / 1267 테스트 전부 통과. lint 오류 0 · 경고 1건**
(기존 `components/ImageDropzone.jsx`). 둘 다 나빠지면 안 된다.

---

## 이미 있는 것 — 새로 만들지 말 것

| | 어디 | 무엇을 주나 |
|---|---|---|
| 직원 목록 API | `/api/team-members` | `brandRoles: [{brandId, brandName, tier}]` (브랜드 이름순 정렬됨) · `hasAccount` · `hasBrandAssignment` · `is_active` · `is_global_admin` · `email` · `organization`/`affiliation` · `jobRole`/`job_role` |
| 주소 상태 어법 | `lib/launchFilters.js` · `components/useLaunchFilters.js` | parse/merge 와 `router.replace` 경합 막는 법 |
| `⋯` 메뉴 어법 | `components/RequirementStatusActions.jsx` | 이 저장소가 이미 쓰는 모양 |
| 등급 이름 | `lib/tiers.js` 의 `TIER_LABELS` · `TIER_HINTS` | |
| 배치 대기 | `components/PendingMembersSection.jsx` | **그대로 둔다** (스펙 §12) |

---

### Task 1: `lib/memberBrandLabel.js` — 브랜드 칸 문구

**Files:** Create `lib/memberBrandLabel.js`, `lib/memberBrandLabel.test.js`

**등급은 열이 될 수 없다.** 브랜드마다 다르기 때문이다(스펙 §7). 한 사람이
스파오에서는 실무 관리자, 미쏘에서는 요청자일 수 있다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

```js
import { describe, expect, it } from 'vitest';
import { memberBrandLabel } from './memberBrandLabel';

const roles = [
  { brandId: 'm', brandName: '미쏘', tier: '4차' },
  { brandId: 's', brandName: '스파오', tier: '2차' },
  { brandId: 'h', brandName: '후아유', tier: '3차' },
];

describe('memberBrandLabel', () => {
  it('배치가 없으면 그렇게 말한다', () => {
    expect(memberBrandLabel([])).toEqual({ empty: true, name: '', tier: '', more: 0 });
    expect(memberBrandLabel(undefined)).toEqual({ empty: true, name: '', tier: '', more: 0 });
  });

  it('하나면 그것만', () => {
    expect(memberBrandLabel([roles[1]])).toEqual({
      empty: false, name: '스파오', tier: '2차', more: 0,
    });
  });

  // 여럿일 때 대표는 '지금 보고 있는 브랜드'가 있으면 그것, 없으면 첫째다.
  it('여럿이면 대표 하나와 나머지 수', () => {
    expect(memberBrandLabel(roles)).toEqual({
      empty: false, name: '미쏘', tier: '4차', more: 2,
    });
  });

  it('지금 브랜드가 있으면 그것을 대표로', () => {
    expect(memberBrandLabel(roles, { currentBrandId: 's' })).toEqual({
      empty: false, name: '스파오', tier: '2차', more: 2,
    });
  });

  // 필터가 켜져 있으면 그 브랜드만 보여준다. 「외 N」이 없다 —
  // 그 브랜드로 좁혀 보는 중인데 다른 브랜드 수를 세어 줄 이유가 없다.
  it('브랜드 필터가 켜져 있으면 그 브랜드만', () => {
    expect(memberBrandLabel(roles, { filterBrandId: 'h' })).toEqual({
      empty: false, name: '후아유', tier: '3차', more: 0,
    });
  });

  it('필터 브랜드에 배치가 없으면 빈 것으로', () => {
    expect(memberBrandLabel(roles, { filterBrandId: 'x' }).empty).toBe(true);
  });

  // 필터가 지금 브랜드를 이긴다. 눈으로 좁힌 것이 더 최근의 뜻이다.
  it('필터가 지금 브랜드보다 세다', () => {
    expect(memberBrandLabel(roles, { currentBrandId: 's', filterBrandId: 'm' }).name)
      .toBe('미쏘');
  });
});
```

- [ ] **Step 2: 실패 확인** → `npx vitest run lib/memberBrandLabel.test.js`

- [ ] **Step 3: 만든다**

```js
// 직원 목록의 「브랜드 · 등급」 칸에 무엇을 적을지.
//
// 등급을 독립된 열로 못 만든다 — 브랜드마다 다르기 때문이다. 한 사람이
// 스파오에서는 실무 관리자, 미쏘에서는 요청자일 수 있다. 열 하나로는 어느
// 것을 보여줄지 정할 수가 없어서 브랜드와 함께 적는다.
//
// roles: [{ brandId, brandName, tier }] — /api/team-members 가 이름순으로 준다
// currentBrandId: 지금 상단바에서 보고 있는 브랜드
// filterBrandId: 목록에서 브랜드로 좁혔을 때 그 브랜드
export function memberBrandLabel(roles, { currentBrandId, filterBrandId } = {}) {
  const list = Array.isArray(roles) ? roles : [];
  const none = { empty: true, name: '', tier: '', more: 0 };
  if (list.length === 0) return none;

  // 필터가 지금 브랜드보다 세다. 눈으로 좁힌 것이 더 최근의 뜻이다.
  if (filterBrandId) {
    const hit = list.find((r) => r.brandId === filterBrandId);
    return hit ? { empty: false, name: hit.brandName, tier: hit.tier, more: 0 } : none;
  }

  const pick = list.find((r) => r.brandId === currentBrandId) ?? list[0];
  return { empty: false, name: pick.brandName, tier: pick.tier, more: list.length - 1 };
}
```

- [ ] **Step 4: 통과 확인 → 7개 PASS**

- [ ] **Step 5: 커밋**

```bash
git add -- lib/memberBrandLabel.js lib/memberBrandLabel.test.js
git commit -m "feat: 직원 목록의 브랜드·등급 칸 문구"
```

---

### Task 2: `lib/memberFilter.js` — 좁히기

**Files:** Create `lib/memberFilter.js`, `lib/memberFilter.test.js`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

```js
import { describe, expect, it } from 'vitest';
import { MEMBER_FILTERS, filterMembers, memberCounts } from './memberFilter';

const M = [
  { id: '1', name: '한지웅', email: 'han_jiwoong@eland.co.kr', is_active: true,
    is_global_admin: true, brandRoles: [{ brandId: 's', brandName: '스파오', tier: '2차' }] },
  { id: '2', name: '김동현', email: 'kim_donghyun27@eland.co.kr', is_active: true,
    is_global_admin: false, brandRoles: [{ brandId: 's', brandName: '스파오', tier: '4차' }] },
  { id: '3', name: 'test3', email: 'test3@eland.co.kr', is_active: false,
    is_global_admin: false, brandRoles: [] },
];

describe('filterMembers', () => {
  it('아무것도 안 걸면 전부', () => {
    expect(filterMembers(M, {}).length).toBe(3);
  });

  it('이름으로 찾는다', () => {
    expect(filterMembers(M, { q: '한지' }).map((m) => m.id)).toEqual(['1']);
  });

  // 이름만 보면 「kim_donghyun27 을 찾아 줘」가 안 된다. 사람은 계정 이름으로도
  // 사람을 기억한다.
  it('이메일로도 찾는다', () => {
    expect(filterMembers(M, { q: 'donghyun' }).map((m) => m.id)).toEqual(['2']);
  });

  it('대소문자를 안 가린다', () => {
    expect(filterMembers(M, { q: 'TEST3' }).map((m) => m.id)).toEqual(['3']);
  });

  it('재직·비활성·전체관리자', () => {
    expect(filterMembers(M, { f: 'active' }).map((m) => m.id)).toEqual(['1', '2']);
    expect(filterMembers(M, { f: 'off' }).map((m) => m.id)).toEqual(['3']);
    expect(filterMembers(M, { f: 'admin' }).map((m) => m.id)).toEqual(['1']);
  });

  it('브랜드로 좁힌다', () => {
    expect(filterMembers(M, { brand: 's' }).map((m) => m.id)).toEqual(['1', '2']);
  });

  // 지금 이 사람들을 찾을 방법이 아예 없다. 가입만 하고 배치를 못 받은
  // 사람이라 놓치면 그 사람은 아무것도 못 한다.
  it('배치 없음을 찾는다', () => {
    expect(filterMembers(M, { brand: 'none' }).map((m) => m.id)).toEqual(['3']);
  });

  it('여러 조건은 함께 건다', () => {
    expect(filterMembers(M, { f: 'active', brand: 's', q: '김' }).map((m) => m.id))
      .toEqual(['2']);
  });

  it('모르는 값은 무시한다 — 주소를 손으로 고쳐도 안 죽는다', () => {
    expect(filterMembers(M, { f: '엉뚱한값' }).length).toBe(3);
  });

  it('빈 목록에서 안 죽는다', () => {
    expect(filterMembers(undefined, { q: '가' })).toEqual([]);
  });
});

describe('memberCounts', () => {
  // 칩에 숫자를 적는다. 누르기 전에 몇 건인지 알아야 한다.
  // 숫자는 **브랜드·검색을 뺀 전체 기준**이다 — 칩끼리 서로 줄이면
  // 「재직중 20」을 누른 뒤 「비활성 0」이 되어 아무것도 못 고른다.
  it('칩 숫자는 전체 기준', () => {
    expect(memberCounts(M)).toEqual({ all: 3, active: 2, off: 1, admin: 1 });
  });

  it('MEMBER_FILTERS 가 칩 순서를 정한다', () => {
    expect(MEMBER_FILTERS).toEqual(['all', 'active', 'off', 'admin']);
  });
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 만든다.** `filterMembers(members, { q, f, brand })` 와
`memberCounts(members)`, `MEMBER_FILTERS`. 위 테스트가 요구하는 그대로.

- [ ] **Step 4: 통과 확인 → 12개 PASS**

- [ ] **Step 5: 커밋**

```bash
git add -- lib/memberFilter.js lib/memberFilter.test.js
git commit -m "feat: 직원 목록 좁히기와 칩 숫자"
```

---

### Task 3: 주소에 남기기

**Files:** Create `lib/memberParams.js`, `lib/memberParams.test.js`

`lib/launchFilters.js` 를 **먼저 읽고 같은 어법으로** 만든다. 거기서 배운 것
둘이 그대로 적용된다.

- 모르는 값은 기본값으로 떨어뜨린다
- 기본값이면 주소에서 **키를 지운다**. 안 지우면 주소가 `?f=all&q=&brand=` 로
  지저분해지고 공유할 때 뜻이 흐려진다

```
/settings/members?q=한지&f=active&brand=s
```

- [ ] **Step 1: 테스트 먼저** — `parseMemberParams` 와 `mergeMemberParams`.
  기본값(`f=all`, `q` 없음, `brand` 없음), 모르는 `f`, 빈 `q`, `brand=none`.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 만든다**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋**

---

### Task 4: 툴바와 새 표

**Files:** Modify `app/settings/members/page.js`, `components/TeamMemberListSection.jsx`

- [ ] **Step 1: 툴바**

```
[이름 · 이메일로 찾기]  전체 22 | 재직중 20 | 비활성 2 | 전체관리자 4  [브랜드 ▾]   22명 보임
```

- 브랜드 드롭다운에 **「배치 없음」**을 넣는다
- 오른쪽에 「N명 보임」

- [ ] **Step 2: 표를 다시 짠다**

```
이름 (이메일 · 전체관리자 뱃지) | 소속 · 직무 | 브랜드 · 등급 | 상태 | ⋯
```

**줄에서 선택 상자를 전부 걷어낸다.** 브랜드 칸은 `memberBrandLabel` 이
정해 주는 문구만 그린다. 편집은 패널에서 한다(Task 5).

**`⋯` 는 `components/RequirementStatusActions.jsx` 의 어법을 따른다.**
담을 것: 정보 수정 · 비밀번호 재설정(또는 계정 발급) · 전체관리자 지정/해제 ·
비활성화/활성화. **지금 `TeamMemberListSection` 이 받는 콜백 그대로 쓴다** —
`onEdit`·`onAccount`·`onToggleGlobalAdmin`·`onToggleActive`.

**`onChangeTier` 는 이 부품에서 없앤다.** 패널로 간다.

- [ ] **Step 3: 확인**

```
npm run build && npx vitest run && npm run lint
```

- [ ] **Step 4: 커밋**

---

### Task 5: 사람 패널

**Files:** Create `components/settings/MemberPanel.jsx` · Modify `app/settings/members/page.js`

줄을 누르면 오른쪽에서 열린다. **이번 단계에서 담는 것:**

| | |
|---|---|
| 머리 | 이름 · 이메일 · 전체관리자 뱃지 |
| 정보 | 소속 · 직무 · 재직 — 읽기 전용. 「고치기」가 기존 `TeamMemberEditDialog` 를 연다 |
| **브랜드 배치** | **줄 목록 + 등급 드롭다운 + 빼기.** 줄에서 걷어낸 것이 여기로 온다 |
| 브랜드 추가 | 기존 `BrandTeamAssignDialog` 를 연다 |
| 계정 | 「비밀번호 재설정」이 기존 `AccountCredentialDialog` 를 연다 |

**다이얼로그 넷을 흡수하지 않는다.** 패널이 그것들을 *연다*. 흡수는 2단계-나다.

**⚠ 등급 바꾸기가 이번 단계의 핵심이다.** 줄에서 없앤 기능이 여기서 살아야
한다. 지금 페이지의 `changeTier(member, brandId, tier)` 를 그대로 쓴다 —
**새로 만들지 말고 그 함수를 패널에 내려 준다.**

**패널을 조건부로 그린다.** 닫혀도 계속 그리면 지난 사람이 남는다 — 이
저장소의 네 창에 있던 병이다.

**성공 뒤 새로고침을 빠뜨리지 않는다.** 지금 각 다이얼로그가 성공하면
`refresh()` 를 부른다. 패널에서 열어도 그 줄이 살아 있어야 하고, 패널이
보고 있는 사람도 새 값으로 다시 그려져야 한다.

- [ ] **Step 1: 패널을 만든다**
- [ ] **Step 2: 줄 클릭으로 연다.** `⋯` 를 누를 때는 패널이 안 열려야 한다
  (이벤트가 위로 새면 둘 다 열린다)
- [ ] **Step 3: 확인** — `npm run build && npx vitest run && npm run lint`
- [ ] **Step 4: 커밋**

---

### Task 6: 점검과 배포

- [ ] **Step 1: 전체**

```
npx vitest run && npm run lint && npm run build
```

기대: **86 파일 / 1267 + (7 + 12 + 주소 테스트) 개.** 실제 수를 세어 보고하되
**기준선보다 줄면 안 된다.**

- [ ] **Step 2: 낡은 dev 서버를 죽이고 확인**

| | |
|---|---|
| 검색 | 이름·이메일 둘 다 걸린다 |
| 칩 넷 | 숫자가 맞고, 눌러도 다른 칩 숫자가 안 바뀐다 |
| 브랜드 필터 | 등급이 그 브랜드 것으로 바뀌고 「외 N」이 사라진다 |
| 배치 없음 | 두 명이 나온다 |
| 주소 | 필터가 주소에 남고 새로고침해도 유지된다 |
| `⋯` 넷 | 다 동작한다 |
| 줄 클릭 | 패널이 열린다. `⋯` 를 눌렀을 때는 **안 열린다** |
| **패널에서 등급 바꾸기** | 바뀌고 표의 칸이 따라 바뀐다 |
| 패널에서 「고치기」 | 기존 창이 뜨고 저장된다 |
| 배치 대기 | 그대로 있다 |
| 폰 375px | 넘치지 않는다 |

**로그인이 필요해 못 보면 "못 봤다"고 명확히 보고한다.**

- [ ] **Step 3: 배포** — `npm run package:src`

---

## 앞 단계에서 물린 것 — 이번에 해당하는 것

**① 훅의 의존성 배열이 선언보다 위에 있으면 그 자리에서 터진다.** 2026-09-11
에 이것으로 운영이 섰다. `components/TopBar.render.test.jsx` 가 상단바는
지키지만 **이 화면은 안 지킨다.** 새로 만드는 부품도 같은 방식으로 한 번
그려 보는 것을 고려하라.

**② `react-hooks/set-state-in-effect` 는 오류다.** effect 몸통에서 바로
`setState` 를 부르면 걸린다. `fetch().then()` 안은 괜찮다.

**③ `&&` 안에 JSX 주석을 넣으면 파싱이 깨진다.**

**④ `router.replace` 경합.** `useLaunchFilters.js` 가 `pendingRef` 로 푼
문제다. 주소를 상태로 쓰면 같은 것을 만난다.

**⑤ 줄끝이 파일마다 섞여 있다.** 기존 파일을 고칠 때 먼저 확인한다.

**⑥ 낡은 dev 서버를 죽이고 확인한다.**

## 2단계-나로 미루는 것

| | 왜 |
|---|---|
| 다이얼로그 넷을 패널로 흡수 | 가장 위험하다. 각 창이 성공 뒤 무엇을 다시 부르는지 다 세어야 한다 |
| 여러 줄 골라 일괄 | 표가 자리를 잡은 뒤에 얹는다 |
| 폰에서 표를 줄 목록으로 | 지금은 가로로 민다 |
