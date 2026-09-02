-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 브랜드 런칭 — 지식(가이드)과 실행(런칭)을 나눈다.
--
-- 신규 브랜드 온라인 오픈은 요구사항과 다른 일이다. 요구사항은 브랜드가 올린
-- 요청이고 언제 될지 모르지만, 런칭은 우리가 정한 할 일이고 오픈일이 정해져
-- 있다. 권한 축도 다르다 — 법무 담당자가 그 브랜드의 3차일 리 없다.
--
-- 기준 자료는 v10 체크리스트 403건 / 18 워크스트림이다.

-- 1) 가이드 — 브랜드와 무관한 지식. 끝나지 않고 계속 자란다.
create table if not exists launch_guides (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- 어느 시트에서 왔는지. 다시 가져올 때 사람이 확인할 근거다.
  source_version text,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 역할 사전 — 시트의 24_R&R분배 가 그대로 이것이다.
--
-- 모아의 직무(기획자·온라인 MD…)로 번역하지 않는다. 여기 역할은 직무와 소속의
-- 합성이라(브랜드PM = 브랜드 소속 PM) 억지로 옮기면 시트를 만든 사람이 자기
-- 문서를 못 알아본다.
create table if not exists launch_roles (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references launch_guides(id) on delete cascade,
  name text not null,
  org text,
  scope_text text,
  sort_order integer not null default 0,
  unique (guide_id, name)
);

-- 3) 가이드 항목.
--
-- 기한 컬럼이 없는 것이 요점이다. 오픈일 + day_offset 으로 계산한다 —
-- 저장하면 오픈일이 바뀔 때 403건을 다시 써야 하고, 하나라도 빠지면 그때부터
-- 화면이 거짓말을 한다. 시트의 00_사용법 이 약속하는 것과 같은 규칙이다.
create table if not exists launch_guide_items (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references launch_guides(id) on delete cascade,
  -- '01-01'. 같은 파일을 두 번 올려도 안전하게 만드는 못이다.
  code text not null,
  workstream text not null,
  category text,
  title text not null,
  channel text,
  -- v10 의 R&R 네 축. 결정권과 소속이 다른 건이 많다 — 물류가 수행하지만
  -- 결정은 브랜드가 하는 식이라, 합치면 "내가 결정할 것"을 못 만든다.
  decision_org text,
  owner_org text,
  owner_role text,
  support_role text,
  depends_on text[] not null default '{}',
  day_offset integer not null,
  deliverable text,
  note text,
  is_critical boolean not null default false,
  sort_order integer not null default 0,
  unique (guide_id, code)
);

create index if not exists launch_guide_items_ws_idx
  on launch_guide_items (guide_id, workstream, sort_order);

-- 4) 런칭 — 브랜드 하나의 실행. 오픈하면 닫힌다.
create table if not exists launches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  open_date date not null,
  -- '신규 법인' / '양수·라이선스' / '기존 법인 내 신규 브랜드'.
  -- 유형이 가져올 워크스트림을 정한다 — 기존 법인이면 01·02 가 통째로 빠진다.
  kind text,
  guide_id uuid references launch_guides(id),
  -- 신규 브랜드는 아직 모아에 없을 수 있으므로 nullable 이다.
  brand_id uuid references brands(id),
  status text not null default '진행 중'
    check (status in ('준비', '진행 중', '완료', '중단')),
  note text,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) 런칭 항목 — 가이드의 복제본이다.
--
-- 참조가 아니라 값 복사인 것이 중요하다. 참조로 두면 D-30 에 누가 가이드를
-- 고쳤을 때 진행 중인 런칭이 슬쩍 바뀌고, 그 순간 아무도 화면을 못 믿는다.
-- guide_item_id 는 남긴다 — 런칭이 끝나면 계획 vs 실제가 그 연결로 가이드에
-- 쌓인다.
create table if not exists launch_tasks (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references launches(id) on delete cascade,
  guide_item_id uuid references launch_guide_items(id) on delete set null,
  code text not null,
  workstream text not null,
  category text,
  title text not null,
  channel text,
  decision_org text,
  owner_org text,
  owner_role text,
  support_role text,
  depends_on text[] not null default '{}',
  day_offset integer not null,
  deliverable text,
  note text,
  is_critical boolean not null default false,
  sort_order integer not null default 0,
  -- 요구사항의 상태 열 개를 쓰지 않는다. 흐름이 다르고, 열 개를 고르게 하면
  -- 아무도 안 바꾼다. '막힘'이 핵심이다 — 주간 진척 회의에서 볼 것이 그것이다.
  status text not null default '할 것'
    check (status in ('할 것', '하는 중', '완료', '막힘')),
  blocked_reason text,
  assignee uuid references team_members(id),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (launch_id, code)
);

create index if not exists launch_tasks_board_idx
  on launch_tasks (launch_id, workstream, sort_order);
create index if not exists launch_tasks_role_idx
  on launch_tasks (launch_id, owner_role);

-- 6) 참여자.
--
-- 브랜드 등급(user_brand_roles)을 안 본다. 신규 브랜드는 아직 모아에 없을 수
-- 있고, 법무 담당자가 그 브랜드의 3차일 리 없다.
--
-- role_name 이 역할 매핑이다. 같은 '물류'라도 브랜드마다 다른 사람일 수 있어
-- 런칭마다 따로 붙인다.
create table if not exists launch_members (
  launch_id uuid not null references launches(id) on delete cascade,
  member_id uuid not null references team_members(id) on delete cascade,
  role_name text,
  can_edit boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (launch_id, member_id)
);

comment on table launch_guides is '브랜드와 무관한 런칭 지식. 런칭은 여기서 복제해 시작한다.';
comment on table launch_tasks is '런칭 항목. 가이드의 복제본이라 가이드를 고쳐도 진행 중 런칭은 안 바뀐다.';
comment on column launch_tasks.day_offset is '오픈일 기준 상대일(D-120). 기한은 저장하지 않고 계산한다.';
