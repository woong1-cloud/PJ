-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 런칭 참여자 1단계 — 명단.
-- 스펙: docs/superpowers/specs/2026-09-07-launch-members-step1-design.md
--
-- 권한은 안 건드린다. 라우트는 여전히 전부 requireGlobalAdmin 이고,
-- 참여자는 아직 런칭을 못 본다. 명단만 만든다.
--
-- launch_members 는 0031 에 이미 있다. 지금 0건이라 PK 를 넓히는 것이
-- 공짜다 — 데이터가 들어간 뒤엔 살아있는 테이블에 걸어야 한다.

do $$
declare
  n int;
begin
  select count(*) into n from launch_members;
  -- 0건을 전제로 PK 를 바꾼다. 누군가 먼저 넣었으면 멈춘다 —
  -- role_name 이 null 인 줄이 있으면 not null 을 못 건다.
  if n > 0 then
    raise exception 'launch_members 에 %건이 있습니다. PK 변경 전에 확인이 필요합니다.', n;
  end if;
end $$;

-- 1) 역할은 필수다. PK 에 들어가기도 하고, 역할 없이 넣는 일 자체가 없다 —
--    역할이 곧 그 사람이 무엇을 보는가다.
alter table launch_members alter column role_name set not null;

-- 2) PK 를 (launch_id, member_id) → (launch_id, member_id, role_name) 으로.
--
--    한 사람이 한 런칭에서 두 역할을 가질 수 있다. 작은 조직에서는 흔하다 —
--    같은 사람이 서비스기획이면서 PM 일 수 있다. 안 쓰면 손해가 없고,
--    필요해졌을 때 없으면 마이그레이션이 걸린다.
alter table launch_members drop constraint if exists launch_members_pkey;
alter table launch_members add primary key (launch_id, member_id, role_name);

-- 3) 누가 넣었는지 남긴다.
--
--    명단에 넣는 것이 유일한 통제 지점이다 — 그 결정에 이름이 붙어야 한다.
--    created_at 은 0031 에 이미 있다.
alter table launch_members add column if not exists created_by uuid references team_members(id);

-- 4) 한 런칭의 명단을 통째로 읽는 것이 이 테이블의 유일한 사용 방식이다.
--    PK 의 첫 칸이 launch_id 라 이미 그 인덱스를 타지만, 사람으로 거꾸로
--    찾는 길("이 사람이 낀 런칭")은 2단계의 목록 라우트가 쓴다.
create index if not exists launch_members_member_idx on launch_members (member_id);

comment on column launch_members.role_name is
  '런칭 항목의 owner_role/support_role 과 같은 말. 모아의 직무·등급과 다른 축이다.';
comment on column launch_members.can_edit is
  '참여자(true) / 참관(false). 1단계에서는 저장만 하고 안 쓴다 — 문을 가르는 것은 3·4단계.';

-- 확인용
select
  (select count(*) from launch_members) as 명단,
  (select count(*) from information_schema.columns
    where table_name = 'launch_members' and column_name = 'created_by') as created_by_있음;
