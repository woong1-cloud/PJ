# 등급 어휘 정리 구현 계획

> **에이전트에게:** 이 계획은 작업 단위로 서브에이전트를 띄워 실행한다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 브랜드별 등급의 어휘를 한 곳으로 모으고, 전체관리자 해제에 확인을 단다.

**스택:** Next.js 16.3.4 App Router (JS), Tailwind v4, vitest(`environment: 'node'`).

**스펙:** `docs/superpowers/specs/2026-09-11-tier-vocabulary-design.md`

**브랜치:** `feature/tier-vocabulary` (새로 만든다. 지금 `feature/settings-stage2a` 위에서 딴다)

**기준선: 88 파일 / 1313 테스트 전부 통과. lint 오류 0 · 경고 1건**
(기존 `components/ImageDropzone.jsx`). 둘 다 나빠지면 안 된다.

---

## 스펙에서 하나 뺀다 — 이미 되어 있다

스펙 §3-④ 가 「조직의 빈 기본등급이 무엇이 되는지 말한다」고 했는데,
`components/OrganizationSettings.jsx:304` 가 **이미 「요청자 (기본)」로
그리고 있다.** 화면에서 할 일이 없다. 그 화면에서 고칠 것은 **드롭다운에서
1차를 빼는 것 하나**다.

---

### Task 1: `BRAND_TIERS` — 한 곳에서 정한다

**Files:** Modify `lib/tiers.js`, `lib/tiers.test.js`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`lib/tiers.test.js` 맨 아래에 더한다(**기존 테스트는 안 건드린다**):

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_TIERS } from './tiers';

describe('BRAND_TIERS', () => {
  // 1차는 브랜드별 등급이 아니다. 전체관리자라는 별도의 깃발이고,
  // 서버가 brand-team 에 1차를 저장하지 못하게 막는다.
  it('1차가 없다 — 저장할 수 없는 값이다', () => {
    expect(BRAND_TIERS).toEqual(['2차', '3차', '4차']);
  });

  it('TIER_LABELS 가 셋을 다 안다', () => {
    for (const t of BRAND_TIERS) expect(TIER_LABELS[t]).toBeTruthy();
  });
});

// 어휘가 다섯 곳에서 갈라졌던 것이 이 사달의 원인이다. 한 곳으로 모은 뒤에도
// 새 화면이 자기 배열을 또 만들면 같은 일이 반복된다. 파일을 글로 읽어 막는다
// (lib/middlewareMatcher.test.js 와 같은 수법).
describe('등급 목록을 따로 만든 곳이 없다', () => {
  const FILES = [
    'app/api/brand-team/route.js',
    'app/api/brand-team/[targetMemberId]/route.js',
    'app/api/organizations/route.js',
    'app/api/organizations/[id]/route.js',
    'components/BrandTeamSection.jsx',
    'components/BrandTeamAssignDialog.jsx',
    'components/settings/MemberPanel.jsx',
    'components/OrganizationSettings.jsx',
  ];

  it.each(FILES)('%s 가 자기 배열을 안 만든다', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    // '1차'~'4차' 가 배열 리터럴 안에 나오면 자기 목록을 만든 것이다.
    expect(src, file).not.toMatch(/\[\s*'[1-4]차'/);
  });

  it.each(FILES)('%s 가 BRAND_TIERS 를 쓴다', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src, file).toContain('BRAND_TIERS');
  });
});
```

**`TIER_LABELS` 가 이미 import 돼 있는지 보고, 없으면 import 를 더한다.**

- [ ] **Step 2: 실패 확인**

```
npx vitest run lib/tiers.test.js
```

기대: `BRAND_TIERS` 가 없어 FAIL. 파일 검사도 여덟 곳 전부 FAIL.

- [ ] **Step 3: `lib/tiers.js` 에 더한다**

**기존 `TIER_RANK`·`TIER_LABELS`·`TIER_HINTS` 와 그 긴 주석은 한 글자도
안 건드린다.** 아래에 더한다:

```js
// 브랜드별 등급은 셋뿐이다.
//
// 1차는 브랜드별 등급이 아니다. 전체관리자라는 별도의 깃발이고, 그 사람은
// 어느 브랜드에서든 1차로 **동작**할 뿐 1차로 **저장되지** 않는다
// (lib/checkBrandAccess.js 의 첫 줄이 그렇게 판정한다).
//
// 이 목록이 따로 있는 이유: 예전에는 다섯 자리가 각자 배열을 들고 있었고
// 값이 서로 달랐다. 조직 기본등급만 1차를 받아서, 「사업부문」(기본 1차)
// 소속인 사람은 브랜드에 배치할 수가 없었다 — 제안 등급이 1차로 채워지는데
// 고를 수도 저장할 수도 없었다. 그리고 두 화면만 2차를 안 줘서, 이미 2차인
// 사람의 등급이 이름 대신 코드값으로 보이고 손대면 강등됐다.
//
// TIER_RANK 에서 1차를 빼지는 않는다. checkBrandAccess 가 전체관리자에게
// tier: '1차' 를 돌려주고 그 값이 순위 비교에 쓰인다.
export const BRAND_TIERS = ['2차', '3차', '4차'];
```

- [ ] **Step 4: 두 테스트만 통과 확인**

`BRAND_TIERS` 테스트 둘은 PASS, 파일 검사는 아직 FAIL(Task 2 가 고친다).

- [ ] **Step 5: 커밋**

```bash
git add -- lib/tiers.js lib/tiers.test.js
git commit -m "feat: 브랜드별 등급 목록을 한 곳에 둔다"
```

---

### Task 2: 여덟 자리가 그것을 보게 한다

**Files:** Modify 위 목록의 여덟 파일

- [ ] **Step 1: 서버 넷**

```js
// app/api/brand-team/route.js:51
if (!BRAND_TIERS.includes(tier)) throw new ApiError(400, '유효하지 않은 tier입니다.');

// app/api/brand-team/[targetMemberId]/route.js:16
if (tier !== undefined && !BRAND_TIERS.includes(tier)) { ... }

// app/api/organizations/route.js:41  — TIER_RANK 검사를 바꾼다
if (defaultTier && !BRAND_TIERS.includes(defaultTier)) { ... }

// app/api/organizations/[id]/route.js:30  — 같음
```

**조직 쪽 둘은 `TIER_RANK` import 가 안 쓰이게 될 수 있다.** 안 쓰이면
import 도 지운다(lint 가 잡는다).

- [ ] **Step 2: 화면 넷**

`const TIERS = [...]` 를 지우고 `BRAND_TIERS` 를 import 해서 쓴다.

| 파일 | 지금 |
|---|---|
| `components/BrandTeamSection.jsx:14` | `['3차', '4차']` |
| `components/BrandTeamAssignDialog.jsx:23` | `['3차', '4차']` |
| `components/settings/MemberPanel.jsx:18` | `['2차', '3차', '4차']` |
| `components/OrganizationSettings.jsx:16` | `['1차', '2차', '3차', '4차']` |

**조직 화면은 「정하지 않음」 항목을 그대로 둔다**(`OrganizationSettings.jsx:128`).
그건 등급이 아니라 「안 정했다」이고, 안 정하면 요청자로 떨어진다는 안내가
이미 표에 있다(`:304`).

- [ ] **Step 3: 통과 확인**

```
npx vitest run lib/tiers.test.js
```

기대: 파일 검사 열여섯(여덟 × 둘)이 전부 PASS.

```
npx vitest run && npm run lint && npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: 여덟 자리가 BRAND_TIERS 하나를 보게 함"
```

---

### Task 3: `lib/globalAdminDemote.js` — 해제하면 무엇이 남나

**Files:** Create `lib/globalAdminDemote.js`, `lib/globalAdminDemote.test.js`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

```js
import { describe, expect, it } from 'vitest';
import { demoteImpact } from './globalAdminDemote';

// 2026-09-11 운영 값이다.
const BRANDS = [
  { id: 'm', name: '미쏘', is_active: true },
  { id: 's', name: '스파오', is_active: true },
  { id: 'n', name: '신규 브랜드', is_active: true },
  { id: 'nb', name: '뉴발란스', is_active: false },
  { id: 'r', name: '로엠', is_active: false },
  { id: 'h', name: '후아유', is_active: false },
];

describe('demoteImpact', () => {
  // 한지웅: 배치 4개인데 둘은 브랜드가 비활성이다. 개수만 세면 안전해
  // 보이는데 실제로 들어갈 수 있는 곳은 둘뿐이다.
  it('비활성 브랜드의 배치는 따로 가른다', () => {
    const out = demoteImpact({
      brandRoles: [
        { brandId: 'm', brandName: '미쏘', tier: '2차' },
        { brandId: 'r', brandName: '로엠', tier: '2차' },
        { brandId: 'h', brandName: '후아유', tier: '2차' },
        { brandId: 's', brandName: '스파오', tier: '2차' },
      ],
      brands: BRANDS,
    });
    expect(out.keep.map((k) => k.name)).toEqual(['미쏘', '스파오']);
    expect(out.lose).toEqual(['신규 브랜드']);
    expect(out.inactive).toEqual(['로엠', '후아유']);
  });

  // 변기석·장재혁: 스파오 하나뿐이다. 지금은 전체관리자라 셋 다 보인다.
  it('배치가 하나면 나머지 활성 브랜드를 다 잃는다', () => {
    const out = demoteImpact({
      brandRoles: [{ brandId: 's', brandName: '스파오', tier: '2차' }],
      brands: BRANDS,
    });
    expect(out.keep.map((k) => k.name)).toEqual(['스파오']);
    expect(out.lose).toEqual(['미쏘', '신규 브랜드']);
    expect(out.inactive).toEqual([]);
  });

  // 이 경우 창이 더 세게 말해야 한다 — 화면이 keep.length 로 판단한다.
  it('배치가 없으면 아무 데도 못 들어간다', () => {
    const out = demoteImpact({ brandRoles: [], brands: BRANDS });
    expect(out.keep).toEqual([]);
    expect(out.lose).toEqual(['미쏘', '스파오', '신규 브랜드']);
  });

  it('브랜드 목록이 없어도 안 죽는다', () => {
    expect(demoteImpact({ brandRoles: [], brands: undefined }))
      .toEqual({ keep: [], lose: [], inactive: [] });
    expect(demoteImpact({})).toEqual({ keep: [], lose: [], inactive: [] });
  });

  // 목록에 없는 브랜드에 배치가 남아 있을 수 있다(브랜드를 지웠거나 조회가
  // 활성만 가져왔거나). 그때 keep 에 넣으면 못 들어가는 곳을 들어간다고 말한다.
  it('브랜드 목록에 없는 배치는 keep 에 안 넣는다', () => {
    const out = demoteImpact({
      brandRoles: [{ brandId: 'zzz', brandName: '없어진 브랜드', tier: '2차' }],
      brands: BRANDS,
    });
    expect(out.keep).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 만든다**

```js
// 전체관리자를 해제하면 어디에 남고 어디를 잃나.
//
// 창에서 세지 않고 여기서 센다 — 화면은 이 결과를 그리기만 한다.
//
// 비활성 브랜드를 따로 가르는 이유: 배치가 있어도 /api/my-brands 가
// 걸러내서 실제로는 못 들어간다. 개수만 세면 안전해 보이는데 실제는 절반일
// 수 있다 — 한지웅이 배치 4개 중 둘만 살아남는다.
//
// brandRoles: [{ brandId, brandName, tier }]
// brands:     [{ id, name, is_active }]
export function demoteImpact({ brandRoles, brands } = {}) {
  // 이름순으로 고정한다. 순서가 요청마다 바뀌면 같은 창이 다르게 보인다.
}
```

- [ ] **Step 4: 통과 확인 → 5개 PASS**

- [ ] **Step 5: 커밋**

```bash
git add -- lib/globalAdminDemote.js lib/globalAdminDemote.test.js
git commit -m "feat: 전체관리자 해제가 무엇을 남기고 무엇을 잃는지"
```

---

### Task 4: 해제 확인 창

**Files:** Create `components/settings/DemoteAdminDialog.jsx` ·
Modify `app/settings/members/page.js`

- [ ] **Step 1: 창**

이 저장소의 다이얼로그 어법을 따른다(`components/ui/dialog`).
`components/launch/BlockDialog.jsx` 나 `CloseReasonDialog.jsx` 를 본보기로 읽어라.

담을 것:

```
{이름} 님의 전체관리자를 해제합니다

해제하면 저장된 브랜드 배치로 돌아갑니다.

  들어갈 수 있는 곳        미쏘 · 스파오   (실무 관리자)
  들어갈 수 없게 되는 곳    신규 브랜드
  배치가 있지만 못 들어감   로엠 · 후아유   (브랜드가 비활성)

                                    [취소]  [해제]
```

- **빈 묶음은 안 그린다.** 잃는 곳이 없으면 그 줄이 없다
- **`keep` 이 비면 더 세게 말한다** — 「이 사람은 어느 브랜드에도 못 들어가게
  됩니다」. **막지는 않는다.** 비활성화하려는 것일 수도 있다
- **`DialogTitle` 에 `pr-10`** — 닫기 X 가 `absolute top-2 right-2 size-7` 이라
  오른쪽 36px 을 먹는다

- [ ] **Step 2: 배선**

지금 `TeamMemberListSection.jsx:69` 의 `⋯ → 전체관리자 해제` 가
`onToggleGlobalAdmin(member)` 를 바로 부른다.

**해제일 때만 창을 거친다.** 지정은 그대로 바로 간다.

```js
onToggleGlobalAdmin={(m) =>
  m.is_global_admin
    ? setDemoteTarget(m)                                   // 창을 연다
    : patchMember(m, { isGlobalAdmin: true }, '…')          // 지금 그대로
}
```

**`MemberPanel` 에도 해제 자리가 있으면 같은 창을 지난다.** 없으면 안 만든다.

- [ ] **Step 3: 창을 조건부로 그린다**

닫혀도 계속 그리면 지난 사람이 남는다 — 이 저장소의 네 창에 있던 병이다.

- [ ] **Step 4: 서버가 막는 경우**

마지막 전체관리자는 서버가 400 을 돌려준다(`lib/checkLastGlobalAdmin.js`).
**창에서 다시 세지 않는다.** 지금 `patchMember` 가 오류를 `actionError` 에
담고 있는지 보고, 그 문구가 실제로 보이는지 확인해라.

- [ ] **Step 5: 렌더 테스트**

`components/settings/DemoteAdminDialog.render.test.jsx` —
`react-dom/server` 로 그려 본다. `components/settings/MemberPanel.render.test.jsx`
가 본보기다.

**왜 필요한지:** 2026-09-11 에 상단바에서 훅의 의존성 배열이 변수 선언보다
위에 있어 **운영이 섰다.** 빌드도 테스트도 린트도 못 잡았다.

덮을 것: 셋 다 있는 경우 · `keep` 이 빈 경우 · `brandRoles` 가 `null` 인 경우.

- [ ] **Step 6: 확인하고 커밋**

```
npx vitest run && npm run lint && npm run build
```

---

### Task 5: 화면 둘

**Files:** Modify `components/TeamMemberListSection.jsx`,
`components/settings/MemberPanel.jsx`

- [ ] **Step 1: 전체관리자 줄이 실제 권한을 말한다**

```
변기석 [전체관리자]   본부 소속 미지정   모든 브랜드 · 전체 관리자
                                      해제하면: 스파오 실무 관리자
```

- 브랜드 칸이 `memberBrandLabel` 대신 **「모든 브랜드 · 전체 관리자」**
- 그 아래 흐리게 **「해제하면: …」** — `demoteImpact` 의 `keep` 으로 만든다
- `keep` 이 비면 「해제하면: 들어갈 곳이 없습니다」

**저장값을 숨기지 않는다.** 처음 목업에서 숨겼다가 틀렸다 — 해제하는 사람이
무엇이 남는지 모르는 채로 누르게 된다.

- [ ] **Step 2: 소속 미지정**

`displayAffiliation(m)` 이 조직 이름 → 옛 `affiliation` → `—` 순으로 떨어진다
(`lib/organizations.js`). **조직이 없어서 옛 값으로 떨어진 경우**를 가른다.

- 흐린 글씨 + 「소속 미지정」 표시
- **지금 셋이고 전부 전체관리자다**(장재혁 · 변기석 · 한지웅)

**필터도 둔다.** `lib/memberFilter.js` 의 `f` 에 한 갈래를 더하는 것이
자연스럽다 — 그러면 `MEMBER_FILTERS` 와 `memberCounts` 와 칩이 함께 늘어난다.
**그 파일의 테스트도 함께 늘려라.**

- [ ] **Step 3: 확인하고 커밋**

---

### Task 6: 점검과 배포

- [ ] **Step 1: 전체**

```
npx vitest run && npm run lint && npm run build
```

기대: 기준선 88/1313 에 Task 1·3·5 의 테스트가 는다. **실제 수를 세어
보고하되 줄면 안 된다.**

- [ ] **Step 2: SQL 을 사용자에게 넘긴다**

```sql
update organizations set default_tier = '2차' where name = '사업부문';
```

**직접 실행하지 마세요.** 규칙만 고치면 이 값은 그대로 남는다.
규칙이 고쳐진 뒤라면 조직 화면에서 손으로 바꿔도 된다.

- [ ] **Step 3: 낡은 dev 서버를 죽이고 확인**

| | |
|---|---|
| 팀 배치 | 코드값 「2차」가 **사라지고** 「실무 관리자」로 보인다 |
| 팀 배치에서 등급 바꾸기 | 실무 관리자를 고를 수 있다 |
| 직원 목록 전체관리자 줄 | 「모든 브랜드 · 전체 관리자」 + 「해제하면: …」 |
| 소속 미지정 셋 | 흐리게 + 표시. 필터로 찾힌다 |
| 조직 기본등급 드롭다운 | **1차가 없다** |
| **전체관리자 해제** | 창이 뜨고 남는 곳·잃는 곳·비활성이 맞다 |
| 취소 | 아무 일도 안 일어난다 |
| 전체관리자 **지정** | 창 없이 바로 된다 |
| 마지막 전체관리자 해제 | 서버가 막고 그 문구가 보인다 |

**로그인이 필요해 못 보면 "못 봤다"고 명확히 보고한다.**

- [ ] **Step 4: 배포** — `npm run package:src`

---

## 안 하는 것

| | 왜 |
|---|---|
| 저장값 `1차`~`4차` 바꾸기 | 이름표는 이미 사람 말이다. 마이그레이션과 기존 데이터가 다 걸린다 |
| `TIER_RANK` 에서 1차 빼기 | `checkBrandAccess` 가 전체관리자에게 `tier: '1차'` 를 돌려주고 순위 비교에 쓴다 |
| 비활성 브랜드 접근 막기 | `checkBrandAccess` 는 활성 여부를 안 본다. 지금 그런 사람이 없다. 따로 본다 |
| 비활성화(재직) 확인 | 같은 종류지만 여러 줄 일괄과 함께 본다 |
| 조직 화면의 「요청자 (기본)」 | **이미 되어 있다** (`OrganizationSettings.jsx:304`) |
