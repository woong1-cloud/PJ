-- 0008: 자가 회원가입 지원
--
-- 사용자가 직접 가입하고, 관리자는 브랜드 배치만 한다.
-- 아래 컬럼들은 전부 사용자가 스스로 적는 값이라 권한 판단에 쓰지 않는다.
-- 접근 권한은 지금처럼 user_brand_roles 행에서만 나온다.

-- 소속: 등급 제안의 근거가 된다(브랜드→4차, 본부→3차). 제안일 뿐 확정이 아니다.
alter table team_members add column if not exists affiliation text
  check (affiliation in ('브랜드', '본부'));

-- 직무: 순수 표시용. 권한과 무관하다.
alter table team_members add column if not exists job_role text
  check (job_role in ('기획자', '개발자', '디자이너', '기타'));

-- 본인이 적은 근무 브랜드. 관리자 화면에 힌트로 보여줄 뿐,
-- 이 값으로 어떤 데이터도 조회하지 않는다.
alter table team_members add column if not exists requested_brand_id uuid references brands(id);

alter table team_members add column if not exists signed_up_at timestamptz;

-- 이메일: 지금까지 auth.users 에만 있어서 관리자가 팀원 목록에서 누가 누군지
-- 알 수 없었다. 화면에 보여주려면 여기 있어야 한다.
alter table team_members add column if not exists email text;

-- 기존 팀원의 이메일을 auth.users 에서 채운다.
update team_members tm
   set email = u.email
  from auth.users u
 where u.id = tm.auth_user_id
   and tm.email is null;

-- 같은 이메일로 두 번 가입되지 않게 한다. 기존 행 중 이메일이 없는
-- (계정 미생성) 팀원이 있으므로 unique 가 아니라 부분 인덱스를 쓴다.
create unique index if not exists idx_team_members_email
  on team_members (email) where email is not null;
