# 조직(소속) 체계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가입 시 고르는 소속을 실제 조직명으로 바꾸고, 브랜드에 배치되지 않는 조직(법무팀·재무팀)도 전사 프로젝트를 읽을 수 있게 한다.

**Architecture:** 조직을 `organizations` 테이블로 빼서 전체관리자가 화면에서 편집한다. 권한은 축을 둘로 나눈다 — 브랜드 안에서의 등급(`user_brand_roles.tier`)과 브랜드를 가로지르는 읽기(`team_members.can_view_all_projects`). 판정 로직은 전부 순수 함수로 두고 라우트는 그 함수를 부르기만 한다.

**Tech Stack:** Next.js 16 App Router · Supabase Postgres · vitest · Tailwind v4 · base-ui Select

**설계 근거:** `docs/superpowers/specs/2026-08-13-organizations-design.md`

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0022_organizations.sql` | 테이블·컬럼 추가, 브랜드 시드, 기존 멤버 이관 |
| `lib/organizations.js` | 순수 함수 — 그룹 나누기, 등급 제안, 표시값 폴백 |
| `lib/organizations.test.js` | 위 함수의 경계 고정 |
| `lib/projectAccess.js` | `canSeeProject` 에 전사 열람 축 추가 (기존 파일) |
| `lib/tiers.js` | `TIER_HINTS` 추가 (기존 파일) |
| `app/api/signup/organizations/route.js` | 비로그인 공개 조회 |
| `app/api/organizations/route.js` | 전체관리자 GET/POST |
| `app/api/organizations/[id]/route.js` | 전체관리자 PATCH |
| `components/OrganizationSettings.jsx` | 조직 목록·추가·수정 UI |
| `app/admin/organizations/page.js` | 위 컴포넌트를 얹는 페이지 |

`lib/signup.js` 의 `suggestTier` 는 Task 11 에서 지운다.

---

### Task 1: 마이그레이션 0022

**Files:**
- Create: `supabase/migrations/0022_organizations.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 0022: 조직(소속) 체계
--
-- 가입 화면의 소속이 '브랜드'/'본부' 두 값뿐이라 패션본부도 법무팀도
-- 재무팀도 전부 '본부' 하나로 뭉뚱그려졌다. 관리자가 배치 화면에서 누가
-- 누군지 알 수 없고, 더 나쁜 것은 그 두 값이 등급을 제안한다는 점이다
-- (본부 -> 3차 실무자). 법무팀 직원에게 상태 변경 권한이 제안된다.
--
-- 조직을 테이블로 빼는 이유: 목록이 코드 상수 + DB CHECK 였다면 값 하나
-- 추가에 마이그레이션과 배포가 필요하다. 조직은 직무보다 훨씬 자주 바뀐다.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- 이 조직이 브랜드면 연결한다. 법무팀·재무팀은 null.
  -- 가입 화면의 그룹(브랜드 / 본부·팀)도 이 컬럼으로 갈린다 — 그룹 컬럼을
  -- 따로 두면 언젠가 이 값과 어긋나고, 그때 어느 쪽이 진실인지 알 수 없다.
  brand_id uuid references brands(id) on delete set null,
  -- 가입 승인 화면에 미리 채울 값. 비면 가장 낮은 등급으로 떨어진다.
  default_tier text check (default_tier in ('1차', '2차', '3차', '4차')),
  default_view_all_projects boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists organizations_brand_id_idx on organizations(brand_id);

alter table team_members
  add column if not exists organization_id uuid references organizations(id);

-- 등급과 직교하는 축이다. 등급은 브랜드 안에서의 사다리이고, 이것은
-- 브랜드를 가로지르는 읽기다. 세로 축으로 가로 요구를 표현할 수 없어서
-- 컬럼을 따로 둔다.
alter table team_members
  add column if not exists can_view_all_projects boolean not null default false;

-- 기존 브랜드를 조직으로 시드한다. 브랜드 소속 가입자가 고를 값이다.
insert into organizations (name, brand_id, default_tier, sort_order)
select b.name, b.id, '4차', 0
  from brands b
 where not exists (select 1 from organizations o where o.brand_id = b.id)
   and not exists (select 1 from organizations o where o.name = b.name);

-- affiliation='브랜드' 이고 근무 브랜드를 적어 둔 사람은 그 조직으로 옮긴다.
update team_members m
   set organization_id = o.id
  from organizations o
 where m.organization_id is null
   and m.affiliation = '브랜드'
   and m.requested_brand_id is not null
   and o.brand_id = m.requested_brand_id;

-- affiliation='본부' 인 사람은 일부러 비워 둔다. 어느 본부인지 데이터에
-- 없고, 마이그레이션이 추측해서 채우면 틀린 값이 맞는 값처럼 보인다.
-- 관리자가 /admin/members 에서 지정한다.
--
-- affiliation 컬럼은 지우지 않는다. 지우면 아직 이관되지 않은 사람이
-- 화면에서 소속 없는 사람이 된다.
```

- [ ] **Step 2: SQL 문법 확인**

Run: `node -e "const s=require('fs').readFileSync('supabase/migrations/0022_organizations.sql','utf8'); if(!/create table if not exists organizations/.test(s)) throw new Error('테이블 정의 없음'); console.log('OK', s.length, 'bytes')"`
Expected: `OK <숫자> bytes`

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0022_organizations.sql
git commit -m "feat: 마이그레이션 0022 — organizations 테이블과 전사 열람 컬럼"
```

---

### Task 2: 순수 함수 — groupOrganizations

**Files:**
- Create: `lib/organizations.js`
- Test: `lib/organizations.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { groupOrganizations } from './organizations';

describe('groupOrganizations', () => {
  const orgs = [
    { id: 'b1', name: '스파오', brand_id: 'brand-1', is_active: true, sort_order: 1 },
    { id: 'o1', name: '법무팀', brand_id: null, is_active: true, sort_order: 2 },
    { id: 'b2', name: '미쏘', brand_id: 'brand-2', is_active: true, sort_order: 0 },
    { id: 'x1', name: '없어진팀', brand_id: null, is_active: false, sort_order: 0 },
  ];

  it('brand_id 유무로 두 그룹으로 나눈다', () => {
    const { brands, teams } = groupOrganizations(orgs);
    expect(brands.map((o) => o.name)).toEqual(['미쏘', '스파오']);
    expect(teams.map((o) => o.name)).toEqual(['법무팀']);
  });

  it('비활성 조직은 빠진다 — 가입 화면에 보이면 안 된다', () => {
    const { teams } = groupOrganizations(orgs);
    expect(teams.map((o) => o.name)).not.toContain('없어진팀');
  });

  it('sort_order 순으로 정렬한다', () => {
    const { brands } = groupOrganizations(orgs);
    expect(brands[0].name).toBe('미쏘');
  });

  it('sort_order 가 같으면 이름 순 — 순서가 매번 달라지면 안 된다', () => {
    const { teams } = groupOrganizations([
      { id: '1', name: '재무팀', brand_id: null, is_active: true, sort_order: 0 },
      { id: '2', name: '법무팀', brand_id: null, is_active: true, sort_order: 0 },
    ]);
    expect(teams.map((o) => o.name)).toEqual(['법무팀', '재무팀']);
  });

  it('빈 입력에 터지지 않는다', () => {
    expect(groupOrganizations()).toEqual({ brands: [], teams: [] });
    expect(groupOrganizations(null)).toEqual({ brands: [], teams: [] });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/organizations.test.js`
Expected: FAIL — `Failed to resolve import "./organizations"`

- [ ] **Step 3: 구현**

```js
// 조직(소속) 판정의 순수 로직.
//
// 가입 화면·관리 화면·승인 화면이 같은 파일을 읽는다. 세 곳에 규칙을
// 복제하면 언젠가 한 곳만 고쳐지고, 그때 화면마다 다른 목록이 보인다.

import { TIER_RANK } from './tiers';

// 가입 화면의 소속 셀렉트에 쓸 두 그룹.
//
// 조직이 20개쯤 되면 한 줄로 늘어놓을 수 없다. 브랜드와 본부·팀은 고르는
// 사람의 머릿속에서 이미 갈라져 있으므로 화면도 그렇게 나눈다.
//
// 그룹 판정은 brand_id 로 한다 — 그룹 컬럼을 따로 두면 언젠가 brand_id 와
// 어긋나고, 그때 어느 쪽이 진실인지 알 수 없다.
export function groupOrganizations(organizations) {
  const active = (Array.isArray(organizations) ? organizations : [])
    .filter((o) => o?.is_active !== false)
    // sort_order 가 같을 때 이름으로 한 번 더 가른다. 안 그러면 목록 순서가
    // 조회할 때마다 달라져서 "어제 여기 있었는데" 가 된다.
    .sort((a, b) => {
      const d = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      return d !== 0 ? d : String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
    });
  return {
    brands: active.filter((o) => o.brand_id),
    teams: active.filter((o) => !o.brand_id),
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/organizations.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/organizations.js lib/organizations.test.js
git commit -m "feat: groupOrganizations — 가입 화면 소속 셀렉트 그룹"
```

---

### Task 3: 순수 함수 — suggestTierFromOrg, displayAffiliation

**Files:**
- Modify: `lib/organizations.js`
- Test: `lib/organizations.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`lib/organizations.test.js` 의 import 줄을 아래로 바꾸고 파일 끝에 두 describe 를 더한다.

```js
import { groupOrganizations, suggestTierFromOrg, displayAffiliation } from './organizations';
```

```js
describe('suggestTierFromOrg', () => {
  it('조직에 적힌 기본 등급을 준다', () => {
    expect(suggestTierFromOrg({ default_tier: '3차' })).toBe('3차');
  });

  it('조직이 없거나 기본 등급이 비면 요청자다', () => {
    // 판단이 안 될 때 권한을 더 주는 쪽으로 기울면 그게 곧 보안 구멍이다.
    expect(suggestTierFromOrg(null)).toBe('4차');
    expect(suggestTierFromOrg({})).toBe('4차');
    expect(suggestTierFromOrg({ default_tier: null })).toBe('4차');
  });

  it('모르는 값도 요청자로 떨어진다', () => {
    expect(suggestTierFromOrg({ default_tier: '0차' })).toBe('4차');
    expect(suggestTierFromOrg({ default_tier: 'toString' })).toBe('4차');
  });
});

describe('displayAffiliation', () => {
  it('조직 이름을 먼저 쓴다', () => {
    expect(displayAffiliation({ organization: { name: '법무팀' }, affiliation: '본부' })).toBe(
      '법무팀'
    );
  });

  it('아직 이관되지 않았으면 옛 소속값을 보여준다', () => {
    // 이관 전에도 관리자 눈에는 '본부'로 계속 보여야 한다.
    expect(displayAffiliation({ organization: null, affiliation: '본부' })).toBe('본부');
  });

  it('둘 다 없으면 대시', () => {
    expect(displayAffiliation({})).toBe('—');
    expect(displayAffiliation(null)).toBe('—');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/organizations.test.js`
Expected: FAIL — `suggestTierFromOrg is not a function`

- [ ] **Step 3: 구현 — `lib/organizations.js` 끝에 추가**

```js
// 가입 승인 화면에 미리 채울 등급.
//
// 제안일 뿐이고 확정은 관리자가 한다. 소속은 가입자가 스스로 고르는
// 자기 신고라, '재무팀' 을 골랐다는 이유로 권한이 자동으로 열리면 그건
// 스스로 권한을 부여하는 길이 된다.
//
// 모르는 값은 전부 가장 낮은 등급으로 떨어진다. TIER_RANK 조회로 판정하는
// 이유는 'toString' 같은 값이 프로토타입을 타고 통과하는 것을 막기 위해서다.
export function suggestTierFromOrg(organization) {
  const tier = organization?.default_tier;
  return Object.prototype.hasOwnProperty.call(TIER_RANK, tier) ? tier : '4차';
}

// 화면에 보여줄 소속.
//
// 조직 이름 -> 옛 affiliation -> 대시 순으로 떨어진다. 마이그레이션이
// affiliation='본부' 인 사람을 비워 두므로, 그 사람들도 이관될 때까지
// 관리자 눈에 계속 보여야 한다.
export function displayAffiliation(member) {
  return member?.organization?.name ?? member?.affiliation ?? '—';
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/organizations.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/organizations.js lib/organizations.test.js
git commit -m "feat: suggestTierFromOrg, displayAffiliation"
```

---

### Task 4: canSeeProject 에 전사 열람 축 추가

**Files:**
- Modify: `lib/projectAccess.js`
- Test: `lib/projectAccess.test.js`

- [ ] **Step 1: 실패하는 테스트 추가 — `lib/projectAccess.test.js` 끝에**

```js
describe('canSeeProject — 전사 열람', () => {
  it('전사 열람이 켜지면 배치된 브랜드와 무관하게 보인다', () => {
    expect(
      canSeeProject({
        projectBrands: [{ brand_id: 'other' }],
        myBrandIds: [],
        isGlobalAdmin: false,
        canViewAllProjects: true,
      })
    ).toBe(true);
  });

  it('전개 브랜드가 없는 프로젝트도 전사 열람자는 본다', () => {
    // 전체관리자와 같은 기준이다. 아무 브랜드의 것도 아닌 프로젝트를
    // 전사 시야를 가진 사람에게만 숨길 이유가 없다.
    expect(
      canSeeProject({
        projectBrands: [],
        myBrandIds: [],
        isGlobalAdmin: false,
        canViewAllProjects: true,
      })
    ).toBe(true);
  });

  it('꺼져 있으면 예전 규칙 그대로다', () => {
    expect(
      canSeeProject({
        projectBrands: [{ brand_id: 'other' }],
        myBrandIds: ['mine'],
        isGlobalAdmin: false,
        canViewAllProjects: false,
      })
    ).toBe(false);
  });

  it('인자를 안 넘겨도 예전과 같이 동작한다', () => {
    // 이 함수를 부르는 곳이 여럿이라, 한 곳을 빠뜨렸을 때 조용히 열리면 안 된다.
    expect(
      canSeeProject({ projectBrands: [{ brand_id: 'other' }], myBrandIds: ['mine'] })
    ).toBe(false);
  });
});

describe('visibleProjects — 전사 열람', () => {
  it('전사 열람자는 전부 본다', () => {
    const projects = [{ id: 'p1' }, { id: 'p2' }];
    const allProjectBrands = [{ project_id: 'p1', brand_id: 'other' }];
    expect(
      visibleProjects({
        projects,
        allProjectBrands,
        myBrandIds: [],
        isGlobalAdmin: false,
        canViewAllProjects: true,
      }).map((p) => p.id)
    ).toEqual(['p1', 'p2']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/projectAccess.test.js`
Expected: FAIL — 첫 테스트가 `false` 를 받는다

- [ ] **Step 3: 구현 — `lib/projectAccess.js` 의 두 함수 교체**

```js
// canViewAllProjects: team_members.can_view_all_projects.
//
// 등급과 직교하는 축이다. 법무팀·재무팀은 브랜드 안에서는 아무 권한도
// 없지만 어떤 프로젝트가 도는지는 봐야 한다. 그 요구를 등급 사다리로
// 표현하려니 어느 칸에 넣어도 틀렸다 — 5개 브랜드에 전부 배치하면
// 요구사항까지 열리고, 전체관리자로 올리면 브랜드 생성까지 열린다.
//
// 넓히는 것은 여기까지다. 건별 요구사항은 requirementsOfMyBrands 가
// 계속 배치된 브랜드로 좁힌다.
export function canSeeProject({ projectBrands, myBrandIds, isGlobalAdmin, canViewAllProjects }) {
  if (isGlobalAdmin === true) return true;
  if (canViewAllProjects === true) return true;
  const mine = new Set(myBrandIds ?? []);
  if (mine.size === 0) return false;
  // 전개 브랜드가 하나도 없는 프로젝트는 전체관리자와 전사 열람자만 본다.
  // 방금 만들어 아직 전개하지 않은 프로젝트가 여기 해당한다 — 아무 브랜드의
  // 것도 아니므로 "내 브랜드에 전개됐다"가 성립하지 않는다.
  return (projectBrands ?? []).some((pb) => mine.has(pb?.brand_id ?? pb?.brandId));
}

// 목록용. 프로젝트마다 전개 행을 찾아 위 판정을 적용한다.
//
// projects: [{ id }]
// allProjectBrands: 전체 전개 행 [{ project_id, brand_id }]
export function visibleProjects({
  projects,
  allProjectBrands,
  myBrandIds,
  isGlobalAdmin,
  canViewAllProjects,
}) {
  const rows = allProjectBrands ?? [];
  return (projects ?? []).filter((p) =>
    canSeeProject({
      projectBrands: rows.filter((pb) => pb.project_id === p.id),
      myBrandIds,
      isGlobalAdmin,
      canViewAllProjects,
    }),
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/projectAccess.test.js`
Expected: PASS — 기존 테스트 포함 전부

- [ ] **Step 5: 커밋**

```bash
git add lib/projectAccess.js lib/projectAccess.test.js
git commit -m "feat: canSeeProject 에 전사 열람 축 추가"
```

---

### Task 5: 공개 조회 API — GET /api/signup/organizations

**Files:**
- Create: `app/api/signup/organizations/route.js`

- [ ] **Step 1: 구현**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse } from '@/lib/apiError';

// 가입 화면은 비로그인 상태라 전체관리자 전용인 GET /api/organizations 를
// 쓸 수 없다. GET /api/signup/brands 와 같은 이유로 따로 둔다.
//
// default_tier 와 default_view_all_projects 는 내려보내지 않는다.
// 가입 화면에 필요한 것은 이름과 그룹뿐이고, 등급 구조를 밖에서 알 이유가
// 없다. 필요 없는 것을 내보내지 않는 것이 이 라우트의 요점이다.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, brand_id, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return Response.json({ organizations: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 빌드로 라우트 등록 확인**

Run: `npm run build 2>&1 | grep "api/signup/organizations"`
Expected: `├ ƒ /api/signup/organizations`

- [ ] **Step 3: 커밋**

```bash
git add app/api/signup/organizations/route.js
git commit -m "feat: 가입 화면용 조직 공개 조회 API"
```

---

### Task 6: 관리 API — GET/POST /api/organizations

**Files:**
- Create: `app/api/organizations/route.js`

- [ ] **Step 1: 구현**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';

// 조직 목록·생성. 전체관리자 전용이다 — 이 목록은 가입 화면에 그대로
// 노출되고 등급 제안까지 정하므로 브랜드 관리자가 건드릴 자리가 아니다.
export async function GET() {
  try {
    await requireGlobalAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .select(
        'id, name, brand_id, default_tier, default_view_all_projects, is_active, sort_order, ' +
          'brand:brands(id, name)'
      )
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return Response.json({ organizations: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    await requireGlobalAdmin();
    const body = await request.json();
    const { name, brandId, defaultTier, defaultViewAllProjects, sortOrder } = body;

    if (!name || !String(name).trim()) throw new ApiError(400, '조직 이름은 필수입니다.');
    // 등급 문자열을 그대로 믿지 않는다. 모르는 값이 DB CHECK 까지 가면
    // 사용자는 23514 라는 숫자만 보게 된다.
    if (defaultTier && !Object.prototype.hasOwnProperty.call(TIER_RANK, defaultTier)) {
      throw new ApiError(400, '유효하지 않은 등급입니다.');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: String(name).trim(),
        brand_id: brandId || null,
        default_tier: defaultTier || null,
        default_view_all_projects: Boolean(defaultViewAllProjects),
        sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      })
      .select()
      .single();
    // 23505 = unique_violation. 같은 이름을 두 번 만들면 가입 화면에
    // 똑같은 선택지가 둘 뜨고, 고른 사람마다 다른 조직에 들어간다.
    if (error?.code === '23505') throw new ApiError(409, '같은 이름의 조직이 이미 있습니다.');
    if (error) throw error;
    return Response.json({ organization: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build 2>&1 | grep "api/organizations"`
Expected: `├ ƒ /api/organizations`

- [ ] **Step 3: 커밋**

```bash
git add app/api/organizations/route.js
git commit -m "feat: 조직 목록/생성 API (전체관리자)"
```

---

### Task 7: 관리 API — PATCH /api/organizations/[id]

**Files:**
- Create: `app/api/organizations/[id]/route.js`

- [ ] **Step 1: 구현**

```js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';

// DELETE 는 만들지 않는다.
//
// 조직을 진짜로 지우면 그 조직으로 가입한 사람의 소속 기록이 깨진다.
// 끄는 것은 is_active 를 false 로 바꾸는 것이고, 그러면 가입 화면 목록에서만
// 빠지고 기존 팀원 표시에는 남는다. 지울 길을 열어 두면 언젠가 눌린다.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();
    const body = await request.json();
    const { name, brandId, defaultTier, defaultViewAllProjects, isActive, sortOrder } = body;

    const updates = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw new ApiError(400, '조직 이름은 필수입니다.');
      updates.name = String(name).trim();
    }
    // brandId 는 null 을 명시적으로 넣을 수 있어야 한다. 브랜드였던 조직을
    // 본부·팀으로 되돌리는 길이 없으면 잘못 만든 조직을 고칠 수 없다.
    if (brandId !== undefined) updates.brand_id = brandId || null;
    if (defaultTier !== undefined) {
      if (defaultTier && !Object.prototype.hasOwnProperty.call(TIER_RANK, defaultTier)) {
        throw new ApiError(400, '유효하지 않은 등급입니다.');
      }
      updates.default_tier = defaultTier || null;
    }
    if (defaultViewAllProjects !== undefined) {
      updates.default_view_all_projects = Boolean(defaultViewAllProjects);
    }
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
      updates.sort_order = Number(sortOrder);
    }
    if (Object.keys(updates).length === 0) throw new ApiError(400, '변경할 값이 없습니다.');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error?.code === '23505') throw new ApiError(409, '같은 이름의 조직이 이미 있습니다.');
    if (error) throw error;
    if (!data) throw new ApiError(404, '조직을 찾을 수 없습니다.');
    return Response.json({ organization: data });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build 2>&1 | grep "api/organizations/\[id\]"`
Expected: `├ ƒ /api/organizations/[id]`

- [ ] **Step 3: 커밋**

```bash
git add "app/api/organizations/[id]/route.js"
git commit -m "feat: 조직 수정 API — 삭제 대신 비활성"
```

---

### Task 8: TIER_HINTS — 등급 한 줄 설명

**Files:**
- Modify: `lib/tiers.js`
- Test: `lib/tiers.test.js`

- [ ] **Step 1: 실패하는 테스트 추가 — `lib/tiers.test.js` 끝에**

```js
describe('TIER_HINTS', () => {
  it('모든 등급에 한 줄 설명이 있다', () => {
    // 셀렉트에서 한 등급만 설명이 비면 그 등급이 덜 중요한 것처럼 보인다.
    for (const tier of Object.keys(TIER_LABELS)) {
      expect(typeof TIER_HINTS[tier]).toBe('string');
      expect(TIER_HINTS[tier].length).toBeGreaterThan(0);
    }
  });

  it('라벨과 설명이 다르다 — 같은 말을 두 번 하지 않는다', () => {
    for (const tier of Object.keys(TIER_LABELS)) {
      expect(TIER_HINTS[tier]).not.toBe(TIER_LABELS[tier]);
    }
  });
});
```

`lib/tiers.test.js` 상단 import 에 `TIER_HINTS` 를 더한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/tiers.test.js`
Expected: FAIL — `Cannot read properties of undefined`

- [ ] **Step 3: 구현 — `lib/tiers.js` 의 `TIER_LABELS` 아래에 추가**

```js
// 등급 셀렉트 아래에 붙는 한 줄.
//
// '실무자'와 '실무 관리자'는 이름만으로 한눈에 안 갈린다. 라벨 자체를 바꾸는
// 대신 설명을 더하는 이유는, 라벨이 도움말·온보딩·팀원 목록에 이미 퍼져
// 있어 이름을 바꾸면 그 전부를 함께 고쳐야 하기 때문이다.
//
// 문장은 "무엇을 할 수 있는가"로 쓴다. 등급 이름은 지위를 말하는데, 고르는
// 사람이 알아야 하는 건 그 지위가 무엇을 여는가다.
export const TIER_HINTS = {
  '1차': '브랜드와 조직을 만듭니다',
  '2차': '팀원을 배치하고 카테고리를 관리합니다',
  '3차': '상태와 담당자를 바꿉니다',
  '4차': '요구사항을 올리고 검토를 요청합니다',
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/tiers.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/tiers.js lib/tiers.test.js
git commit -m "feat: TIER_HINTS — 등급 한 줄 설명"
```

---

### Task 9: 가입 화면 — 소속을 조직 목록으로

**Files:**
- Modify: `app/signup/page.js`

- [ ] **Step 1: 조직 조회로 교체**

`AFFILIATIONS` import 를 지우고 `groupOrganizations` 를 가져온다. 브랜드 조회
`useEffect` 를 조직 조회로 바꾼다.

```js
import { JOB_ROLES } from '@/lib/signup';
import { groupOrganizations } from '@/lib/organizations';
```

```js
const [organizations, setOrganizations] = useState([]);
const [organizationId, setOrganizationId] = useState(null);
const [orgError, setOrgError] = useState('');

useEffect(() => {
  fetch('/api/signup/organizations')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('조직 목록을 불러오지 못했습니다.'))))
    .then((d) => setOrganizations(d.organizations ?? []))
    // 소속은 필수라 목록이 없으면 가입 자체가 불가능하다. 빈 셀렉트를
    // 보여주면 사용자는 자기가 뭘 잘못했는지 찾다가 포기한다.
    .catch((e) => setOrgError(e.message));
}, []);

const { brands: brandOrgs, teams: teamOrgs } = groupOrganizations(organizations);
```

- [ ] **Step 2: 소속 셀렉트를 그룹으로 교체**

`소속` 셀렉트와 `근무 브랜드` 블록 전체를 아래로 바꾼다. `needsBrand`,
`affiliation`, `brandId`, `setBrandId`, `brands` 상태는 전부 지운다.

```jsx
<div className="flex flex-col gap-1">
  <Label htmlFor="organization">소속</Label>
  <Select
    items={organizations.map((o) => ({ value: o.id, label: o.name }))}
    value={organizationId}
    onValueChange={setOrganizationId}
  >
    <SelectTrigger id="organization" className="h-11 w-full md:h-8">
      <SelectValue placeholder="선택하세요" />
    </SelectTrigger>
    <SelectContent>
      {/* 조직이 20개쯤 되면 한 줄로 늘어놓을 수 없다. 고르는 사람 머릿속에
          이미 갈라져 있는 축이라 화면도 그렇게 나눈다. */}
      {brandOrgs.length > 0 && (
        <SelectGroup>
          <SelectLabel>브랜드</SelectLabel>
          {brandOrgs.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
      {teamOrgs.length > 0 && (
        <SelectGroup>
          <SelectLabel>본부·팀</SelectLabel>
          {teamOrgs.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
    </SelectContent>
  </Select>
</div>
```

`SelectGroup`, `SelectLabel` 을 `@/components/ui/select` import 에 더한다.

- [ ] **Step 3: 제출 조건과 본문 교체**

`canSubmit` 에서 `affiliation`/`brandId` 조건을 빼고 `organizationId` 를 넣는다.
`orgError` 가 있으면 제출을 막는다. 제출 본문의 `affiliation`·`brandId` 를
`organizationId` 로 바꾼다.

```js
const canSubmit =
  !orgError &&
  name.trim() &&
  email.trim() &&
  password.length >= 8 &&
  password === confirmPassword &&
  organizationId &&
  jobRole;
```

```js
body: JSON.stringify({ name, email, password, organizationId, jobRole }),
```

`orgError` 를 폼 위에 빨간 줄로 띄운다.

```jsx
{orgError && <p className="text-sm text-red-600">{orgError}</p>}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build 2>&1 | grep -E "Failed|Compiled"`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
git add app/signup/page.js
git commit -m "feat: 가입 화면 소속을 조직 목록으로, 근무 브랜드 칸 삭제"
```

---

### Task 10: 가입 API — organizationId 저장

**Files:**
- Modify: `app/api/signup/route.js`

- [ ] **Step 1: 검증과 저장 교체**

`AFFILIATIONS` 검증과 `requested_brand_id` 채우기를 지우고 조직 조회로 바꾼다.

```js
import { JOB_ROLES, isAllowedEmail } from '@/lib/signup';
```

```js
const { name, email, password, organizationId, jobRole } = body;

if (!organizationId) throw new ApiError(400, '소속을 선택해 주세요.');
if (!JOB_ROLES.includes(jobRole)) throw new ApiError(400, '직무를 선택해 주세요.');

// 조직이 실제로 있고 활성인지 서버가 확인한다. 화면 목록은 편의일 뿐이고
// 여기가 관문이다 — 꺼진 조직 id 를 손으로 보내 가입하는 길을 막는다.
const { data: organization, error: orgError } = await supabase
  .from('organizations')
  .select('id, brand_id, is_active')
  .eq('id', organizationId)
  .maybeSingle();
if (orgError) throw orgError;
if (!organization || !organization.is_active) {
  throw new ApiError(400, '유효하지 않은 소속입니다.');
}
```

`team_members` insert 에서 `affiliation`·`requested_brand_id` 를 아래로 바꾼다.

```js
organization_id: organization.id,
// 조직이 브랜드면 배치 화면이 그 브랜드를 미리 채울 수 있도록 남긴다.
requested_brand_id: organization.brand_id,
job_role: jobRole,
```

- [ ] **Step 2: 가입 알림 문구 확인**

`notifySignup({ name, affiliation, brandName })` 호출이 있다. `affiliation`
자리에 조직 이름을 넣도록 바꾼다.

```js
await notifySignup({ name, affiliation: '소속', brandName: organizationName });
```

여기서 `organizationName` 은 위 조회의 `select` 에 `name` 을 더해 얻는다
(`.select('id, name, brand_id, is_active')`).

- [ ] **Step 3: 빌드 확인**

Run: `npm run build 2>&1 | grep -E "Failed|Compiled"`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 커밋**

```bash
git add app/api/signup/route.js
git commit -m "feat: 가입 API 가 조직을 저장한다"
```

---

### Task 11: 승인/배치 화면 제안값 + suggestTier 제거

**Files:**
- Modify: `components/BrandTeamAssignDialog.jsx`
- Modify: `components/TeamMemberEditDialog.jsx`
- Modify: `lib/signup.js`
- Modify: `app/api/team-members/route.js`

- [ ] **Step 1: 팀원 조회에 조직을 실어 보낸다**

`app/api/team-members/route.js` 의 `ADMIN_COLUMNS` 에 조직 조인을 더한다.

```js
const ADMIN_COLUMNS = `${BASE_COLUMNS}, email, affiliation, job_role, signed_up_at, requested_brand_id, can_view_all_projects, organization_id, organization:organizations(id, name, brand_id, default_tier, default_view_all_projects), requested_brand:brands!team_members_requested_brand_id_fkey(name)`;
```

- [ ] **Step 2: 배치 다이얼로그가 조직에서 제안값을 채운다**

`components/BrandTeamAssignDialog.jsx` 의 초기화 부분을 바꾼다.

```js
import { suggestTierFromOrg } from '@/lib/organizations';
import { TIER_LABELS, TIER_HINTS } from '@/lib/tiers';
```

```js
setBrandId(targetBrandId ?? member?.organization?.brand_id ?? identity?.brandId ?? null);
setTier(suggestTierFromOrg(member?.organization));
```

등급 셀렉트 아래에 한 줄 설명을 붙인다.

```jsx
<p className="mt-1 text-xs text-slate-500">{TIER_HINTS[tier]}</p>
```

- [ ] **Step 3: 소속 수정 다이얼로그를 조직 셀렉트로 바꾼다**

`components/TeamMemberEditDialog.jsx` 에서 `AFFILIATIONS`·`suggestTier` import 를
지우고 조직 목록을 쓴다.

```js
import { JOB_ROLES } from '@/lib/signup';
import { groupOrganizations, suggestTierFromOrg } from '@/lib/organizations';
import { TIER_LABELS } from '@/lib/tiers';
```

`affiliation` 상태를 `organizationId` 로 바꾸고, 셀렉트는 Task 9 와 같은
그룹 구조를 쓴다. 조직 목록은 `GET /api/organizations` 로 받는다(이 화면은
전체관리자 전용이다). 등급 제안 안내 문구는
`suggestTierFromOrg(selectedOrg)` 결과를 쓴다.

저장 본문의 `affiliation` 을 `organizationId` 로 바꾸고,
`app/api/team-members/[id]/route.js` 가 `organization_id` 를 받도록 한다.

```js
if (organizationId !== undefined) updates.organization_id = organizationId || null;
```

- [ ] **Step 4: 팀원 목록이 조직 이름을 보여준다**

`components/TeamMemberListSection.jsx:73` 이 `m.affiliation` 을 그대로 쓴다.
이관되지 않은 사람도 계속 보여야 하므로 폴백 함수로 바꾼다.

```jsx
import { displayAffiliation } from '@/lib/organizations';
```

```jsx
{[displayAffiliation(m), m.job_role].filter(Boolean).join(' · ') || '—'}
```

`displayAffiliation` 은 `조직 이름 ?? affiliation ?? '—'` 순으로 떨어지므로,
마이그레이션이 비워 둔 본부 소속 멤버도 `본부` 로 계속 보인다.

- [ ] **Step 5: suggestTier 제거**

`lib/signup.js` 에서 `TIER_BY_AFFILIATION` 과 `suggestTier` 를 지운다.
`AFFILIATIONS` 도 지운다 — 쓰는 곳이 없어졌다.

```bash
grep -rn "suggestTier\b\|AFFILIATIONS" --include=*.js --include=*.jsx app components lib
```
Expected: 출력 없음 (`suggestTierFromOrg` 는 다른 이름이라 걸리지 않는다)

`lib/signup.test.js` 에서 두 항목의 테스트를 지운다.

- [ ] **Step 6: 테스트·빌드 확인**

Run: `npx vitest run && npm run build 2>&1 | grep -E "Failed|Compiled"`
Expected: 전부 통과, `✓ Compiled successfully`

- [ ] **Step 7: 커밋**

```bash
git add components/BrandTeamAssignDialog.jsx components/TeamMemberEditDialog.jsx components/TeamMemberListSection.jsx lib/signup.js lib/signup.test.js app/api/team-members/route.js "app/api/team-members/[id]/route.js"
git commit -m "feat: 배치 화면이 조직에서 제안값을 채운다, suggestTier 제거"
```

---

### Task 12: 조직 관리 화면

**Files:**
- Create: `components/OrganizationSettings.jsx`
- Create: `app/admin/organizations/page.js`
- Modify: `components/TopBar.jsx`

- [ ] **Step 1: `components/OrganizationSettings.jsx` 작성**

```jsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIER_LABELS, TIER_HINTS } from '@/lib/tiers';

const TIERS = ['1차', '2차', '3차', '4차'];
// 셀렉트에서 "정하지 않음"을 고를 수 있어야 한다. 빈 문자열은 base-ui 가
// "선택 안 됨"과 구분하지 못해 항목이 늘 선택된 것처럼 보인다(FilterSelect 와 같은 이유).
const NO_TIER = '__none__';

// 조직 관리. 전체관리자 전용 화면에만 얹는다.
//
// 이 목록은 가입 화면에 그대로 노출되고 등급 제안까지 정한다. 그래서 여기서
// 조직을 지우지 않고 끄기만 한다 — 지우면 그 조직으로 가입한 사람의 소속
// 기록이 깨진다.
export function OrganizationSettings() {
  const [organizations, setOrganizations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(null);
  const [defaultTier, setDefaultTier] = useState(NO_TIER);
  const [viewAll, setViewAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/organizations').then((r) => r.json()),
      fetch('/api/brands').then((r) => r.json()),
    ])
      .then(([o, b]) => {
        setOrganizations(o.organizations ?? []);
        setBrands(b.brands ?? []);
      })
      .catch(() => setError('목록을 불러오지 못했습니다.'));
  }, []);

  useEffect(load, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        brandId,
        defaultTier: defaultTier === NO_TIER ? null : defaultTier,
        defaultViewAllProjects: viewAll,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '추가하지 못했습니다.');
      return;
    }
    setName('');
    setBrandId(null);
    setDefaultTier(NO_TIER);
    setViewAll(false);
    load();
  }

  async function patch(id, updates) {
    setError('');
    const res = await fetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '변경하지 못했습니다.');
    }
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-900">조직 추가</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-name">이름</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 법무팀"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-brand">연결 브랜드</Label>
            <Select
              items={brands.map((b) => ({ value: b.id, label: b.name }))}
              value={brandId}
              onValueChange={setBrandId}
            >
              <SelectTrigger id="org-brand" className="h-8 w-full">
                <SelectValue placeholder="없음" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-tier">기본 등급</Label>
            <Select
              items={[
                { value: NO_TIER, label: '정하지 않음' },
                ...TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] })),
              ]}
              value={defaultTier}
              onValueChange={setDefaultTier}
            >
              <SelectTrigger id="org-tier" className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TIER}>정하지 않음</SelectItem>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 등급 이름은 지위를 말하는데, 고르는 사람이 알아야 하는 건
                그 지위가 무엇을 여는가다. */}
            <p className="text-xs text-slate-500">
              {defaultTier === NO_TIER ? '비우면 요청자로 제안됩니다' : TIER_HINTS[defaultTier]}
            </p>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => setViewAll(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              전사 프로젝트 열람
            </label>
            <Button onClick={create} disabled={!name.trim() || busy}>
              추가
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">연결 브랜드</th>
              <th className="px-4 py-2">기본 등급</th>
              <th className="px-4 py-2">전사 열람</th>
              <th className="px-4 py-2">사용</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">{o.name}</td>
                <td className="px-4 py-2 text-slate-600">{o.brand?.name ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">
                  {o.default_tier ? TIER_LABELS[o.default_tier] : '요청자(기본)'}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={o.default_view_all_projects}
                    onChange={(e) =>
                      patch(o.id, { defaultViewAllProjects: e.target.checked })
                    }
                    className="h-4 w-4 accent-indigo-600"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={o.is_active}
                    onChange={(e) => patch(o.id, { isActive: e.target.checked })}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  아직 조직이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `app/admin/organizations/page.js` 작성**

```jsx
'use client';

import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { OrganizationSettings } from '@/components/OrganizationSettings';

// 조직 목록은 가입 화면에 그대로 노출되고 등급 제안까지 정한다.
// 브랜드 관리자가 건드릴 자리가 아니라 전체관리자 전용이다.
export default function OrganizationsPage() {
  const { identity } = useIdentity();
  if (!isGlobalAdmin(identity)) {
    return <p className="text-sm text-slate-500">전체 관리자만 볼 수 있는 화면입니다.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">조직 관리</h1>
      <OrganizationSettings />
    </div>
  );
}
```

- [ ] **Step 3: TopBar 에 링크 추가**

`components/TopBar.jsx` 의 `globalAdmin` 블록에 대시보드 옆으로 넣는다.

```jsx
{globalAdmin && (
  <NavLink href="/admin/organizations" active={pathname.startsWith('/admin/organizations')}>
    조직
  </NavLink>
)}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build 2>&1 | grep "admin/organizations"`
Expected: `├ ○ /admin/organizations`

- [ ] **Step 5: 커밋**

```bash
git add components/OrganizationSettings.jsx app/admin/organizations/page.js components/TopBar.jsx
git commit -m "feat: 조직 관리 화면"
```

---

### Task 13: 전사 열람 연결 — 프로젝트 API와 로그인 착지

**Files:**
- Modify: `app/api/projects/route.js`
- Modify: `app/api/projects/[id]/route.js`
- Modify: `app/api/me/route.js`
- Modify: `app/login/page.js`

- [ ] **Step 1: 프로젝트 목록 API 에 플래그를 싣는다**

`app/api/projects/route.js` 에서 세션 멤버의 플래그를 읽어 `visibleProjects`
에 넘긴다.

```js
const { data: me } = await supabase
  .from('team_members')
  .select('can_view_all_projects')
  .eq('id', memberId)
  .maybeSingle();
const canViewAllProjects = me?.can_view_all_projects === true;
```

`visibleProjects({ ..., canViewAllProjects })` 로 넘긴다.
`app/api/projects/[id]/route.js` 의 `canSeeProject` 호출에도 같은 값을 넘긴다.

- [ ] **Step 2: /api/me 가 플래그를 내려준다**

`BASE_COLUMNS` 에 `can_view_all_projects` 를 더하고 응답에 담는다.

```js
canViewAllProjects: member.can_view_all_projects === true,
```

- [ ] **Step 3: 로그인 후 착지 분기**

`app/login/page.js:100` 의 `router.push('/requirements')` 를 바꾼다.

```js
// 전사 열람만 켜지고 브랜드에 배치되지 않은 사람(법무팀·재무팀)은
// 요구사항 목록이 비어 있다. 그 화면으로 보내면 고장난 줄 안다.
//
// 배치된 브랜드는 /api/me 가 아니라 /api/my-brands 가 안다 — /api/me 는
// 사람 자체의 정보만 담고 브랜드 목록은 따로 조회한다.
const [me, myBrands] = await Promise.all([
  fetch('/api/me').then((r) => (r.ok ? r.json() : null)),
  fetch('/api/my-brands').then((r) => (r.ok ? r.json() : null)),
]);
const hasBrand = (myBrands?.brands ?? []).length > 0;
router.push(!hasBrand && me?.canViewAllProjects ? '/projects' : '/requirements');
```

- [ ] **Step 4: 테스트·빌드 확인**

Run: `npx vitest run && npm run build 2>&1 | grep -E "Failed|Compiled"`
Expected: 전부 통과, `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
git add app/api/projects/route.js "app/api/projects/[id]/route.js" app/api/me/route.js app/login/page.js
git commit -m "feat: 전사 열람 플래그를 프로젝트 조회와 로그인 착지에 연결"
```

---

### Task 14: 전체 검증

- [ ] **Step 1: 마이그레이션 실행**

Supabase SQL 편집기에서 `supabase/migrations/0022_organizations.sql` 을 실행한다.

- [ ] **Step 2: 시드 확인**

```sql
select name, brand_id is not null as is_brand, default_tier from organizations order by sort_order, name;
```
Expected: 브랜드 5행(스파오·미쏘·로엠·후아유·뉴발란스), 전부 `is_brand = true`, `default_tier = '4차'`

- [ ] **Step 3: 이관 확인**

```sql
select count(*) filter (where organization_id is not null) as moved,
       count(*) filter (where organization_id is null) as pending
  from team_members;
```
Expected: `affiliation='브랜드'` 였던 사람이 `moved`, `'본부'` 였던 사람이 `pending`

- [ ] **Step 4: 전체 테스트·린트·빌드**

Run: `npx vitest run && npm run lint && npm run build`
Expected: 테스트 전부 통과, lint 0 errors, 빌드 성공

- [ ] **Step 5: 화면 확인**

1. `/admin/organizations` — 브랜드 5개가 보이고 `법무팀` 을 추가할 수 있다
2. `/signup` — 소속 셀렉트가 `브랜드`/`본부·팀` 두 그룹으로 나뉘고 `근무 브랜드` 칸이 없다
3. `/admin/members` — 배치 다이얼로그가 브랜드와 등급을 미리 채운다
4. 전사 열람을 켠 계정으로 로그인 → `/projects` 로 착지하고 전사 프로젝트가 보인다
5. 그 계정으로 `/requirements` 를 열면 배치된 브랜드 것만 보인다(없으면 빈 목록)

- [ ] **Step 6: 배포 ZIP**

```bash
npm run package:src
```

---

## 실행 순서 주의

Task 1 의 마이그레이션은 **Task 9 배포 전에** 실행해야 한다. 컬럼이 없는
상태로 새 가입 화면이 올라가면 `organization_id` 를 넣다가 `PGRST204` 로
가입이 통째로 막힌다. 순서는 **마이그레이션 → 배포** 다.
