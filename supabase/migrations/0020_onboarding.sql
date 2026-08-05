-- 첫 로그인 안내를 봤는지 기록한다.
--
-- localStorage 가 아니라 DB 인 이유: 기기를 바꾸거나 캐시를 지울 때마다 환영
-- 창이 다시 뜨면 짜증나는 정도가 아니라 "이 앱 뭔가 이상한데" 가 된다.
-- 컬럼 하나(timestamptz, 행당 8바이트)라 비용은 사실상 없다.
--
-- boolean 이 아니라 timestamptz 인 이유: 언제 봤는지가 나중에 쓸모 있다.
-- 안내 문구를 크게 고쳤을 때 "그 전에 본 사람에게만 다시 보여주기" 를 하려면
-- 날짜가 있어야 하는데, boolean 이면 전부 다시 띄우거나 아무도 못 띄운다.
alter table team_members add column if not exists onboarded_at timestamptz;

comment on column team_members.onboarded_at is
  '첫 로그인 안내를 닫은 시각. null 이면 아직 안 봤다.';

-- 확인용
-- select name, onboarded_at from team_members order by onboarded_at nulls first;
