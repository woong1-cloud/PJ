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
--
-- 법무팀·재무팀은 브랜드 안에서는 아무 권한도 없지만 어떤 프로젝트가
-- 도는지는 봐야 한다. 그 요구를 등급 사다리로 표현하려니 어느 칸에 넣어도
-- 틀렸다 — 5개 브랜드에 전부 배치하면 요구사항까지 열리고, 전체관리자로
-- 올리면 브랜드 생성까지 열린다.
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
-- 화면에서 소속 없는 사람이 된다(lib/organizations.js 의 displayAffiliation
-- 이 이 값으로 떨어진다).
