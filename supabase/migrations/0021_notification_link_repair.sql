-- in_app_notifications.link 복구.
--
-- 0015 에서 이미 추가했어야 하는 컬럼인데, 운영 DB 에 적용되지 않은 채로
-- 남아 있었다. 그 결과 가입 신청 알림이 인앱도 메일도 나가지 못했다.
--
-- 어떻게 조용히 실패했는지 남겨 둔다. 같은 실수를 다시 하지 않기 위해서다.
--
--   1) 알림 코드가 link 를 넣어 insert 한다.
--   2) 컬럼이 없으니 PostgREST 가 PGRST204 를 돌려준다.
--      ("Could not find the 'link' column ... in the schema cache")
--   3) 폴백은 42703(SELECT 에서 없는 컬럼을 읽을 때의 Postgres 코드)만 보고
--      있어서 걸리지 않았다.
--   4) insert 가 그대로 던졌고, 그 catch 가 바로 뒤의 메일 발송까지 건너뛰었다.
--
-- link 를 넣는 알림은 가입 신청뿐이라, 담당자 지정·멘션은 멀쩡히 동작했다.
-- 그래서 "알림은 오는데 가입 알림만 안 온다"로 보였다.
--
-- 0015 를 다시 실행해도 되지만 번호를 새로 딴다 — 건너뛴 마이그레이션을
-- 거슬러 올라가 실행하는 습관이 생기면 다음에 또 어디를 건너뛰었는지 알 수 없다.
-- if not exists 라 0015 가 이미 돈 환경에서도 안전하다.
alter table in_app_notifications add column if not exists link text;

comment on column in_app_notifications.link is
  '알림을 눌렀을 때 갈 곳. 요구사항과 무관한 알림(가입 배치 대기 등)이 쓴다.';

-- 확인용
-- select column_name from information_schema.columns
--  where table_name = 'in_app_notifications' order by ordinal_position;
