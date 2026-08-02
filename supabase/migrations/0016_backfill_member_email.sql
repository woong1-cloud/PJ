-- 0016: team_members.email 채우기
--
-- 알림 메일은 team_members.email 로 보낸다. 그런데 이 값이 채워지는 경로가
-- 하나뿐이었다 — 본인이 직접 가입한 경우(app/api/signup)다.
--
-- 관리자가 만들어 준 계정(app/api/admin/create-account)은 auth.users 에는
-- 이메일이 들어가고 team_members.auth_user_id 도 이어지지만, email 컬럼은
-- null 로 남았다. 그 사람은 그 주소로 로그인하는데 메일은 못 받는다.
-- 라우트 쪽은 함께 고쳤고, 이미 만들어진 계정은 여기서 메운다.
--
-- 로그인 아이디(auth.users.email)를 그대로 복사한다. 두 값이 어긋나 있으면
-- 로그인 아이디가 맞다 — 그게 본인이 실제로 쓰는 주소다.
update team_members tm
set email = u.email
from auth.users u
where u.id = tm.auth_user_id
  and tm.email is distinct from u.email;

-- 확인용. 계정은 있는데 메일 주소가 비어 있는 사람이 남아 있으면 안 된다.
--   select id, name from team_members where auth_user_id is not null and email is null;
