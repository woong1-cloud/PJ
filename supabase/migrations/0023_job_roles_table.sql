-- 0023: 직무를 테이블로
--
-- 0012 에서 직무 목록을 여덟 개로 늘렸는데, 전사로 퍼지면서 또 모자랐다.
-- 법무팀·재무팀·광고팀 사람이 가입하면 고를 것이 '기타'뿐이고, 그러면
-- 0012 가 고치려던 상황이 그대로 돌아온다 — 그 마이그레이션 주석에 적힌
-- 그대로다: "전부 '기타'로 들어오면 관리자가 배치할 때 누가 누군지 알 수
-- 없다. 이 칸의 유일한 쓸모가 그 판단인데 그게 사라진다."
--
-- 값을 몇 개 더 넣는 것으로는 같은 일이 반복된다. 조직(0022)과 같은 이유로
-- 테이블로 빼서 전체관리자가 화면에서 편집하게 한다.

create table if not exists job_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 기존 여덟 개와 새로 필요한 여섯 개.
--
-- 순서는 이 앱에 요구사항을 올리는 빈도다 — 브랜드 실무자가 앞, 지원 조직이
-- 뒤, '기타'는 항상 마지막이다(0012 의 순서 규칙 그대로).
--
-- '광고'를 '마케팅'과 따로 두는 이유: 두 팀이 별도 조직이다. 하나로 묶으면
-- 나중에 직무별로 묶어 볼 때 두 팀이 섞인다.
insert into job_roles (name, sort_order)
values
  ('온라인 MD', 10),
  ('마케팅', 20),
  ('광고', 30),
  ('CS', 40),
  ('기획자', 50),
  ('디자이너', 60),
  ('개발자', 70),
  ('데이터 분석', 80),
  ('영업', 90),
  ('물류', 100),
  ('재무', 110),
  ('법무', 120),
  ('인사', 130),
  -- 목록에 없는 직무를 위한 자리. 늘 맨 아래여야 해서 큰 값을 준다.
  ('기타', 999)
on conflict (name) do nothing;

alter table team_members
  add column if not exists job_role_id uuid references job_roles(id);

-- 기존 값을 이름으로 이어 붙인다. 0012 의 여덟 개가 전부 위 목록에 있으므로
-- 남는 행이 없어야 한다.
update team_members m
   set job_role_id = j.id
  from job_roles j
 where m.job_role_id is null
   and m.job_role = j.name;

-- CHECK 제약을 지운다.
--
-- 목록이 테이블로 옮겨졌으므로 이 제약은 이제 "화면에서 추가한 직무를 DB가
-- 거부하는" 장치가 된다. 관리자가 '홍보'를 추가하면 가입할 때 23514 로 막히고,
-- 그 실패는 가입 버튼을 누른 사람에게만 보인다.
--
-- 이름을 가정하지 않고 정의 내용으로 찾아 지운다 — 0012 가 같은 이유로
-- 이 방식을 썼다(제약 이름은 Postgres 가 정한다).
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'team_members'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%job_role%'
  loop
    execute format('alter table team_members drop constraint %I', c.conname);
  end loop;
end $$;

-- job_role(text) 컬럼은 남긴다. 0022 에서 affiliation 을 남긴 것과 같은
-- 이유다 — 이관되지 않은 행이 화면에서 직무 없는 사람이 되면 안 된다.
