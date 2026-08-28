-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 업데이트 소식을 어디까지 봤는지.
--
-- 첫 로그인 안내(0020 의 onboarded_at)와 같은 방식이다. 소식 목록은 코드에
-- 있고(lib/newsItems.js), 이 컬럼은 "그중 어디까지 봤나"만 기억한다.
--
-- 시각까지 담지만 견줄 때는 날짜만 쓴다. 시각까지 견주면 소식을 본 그날 내내
-- 창이 다시 뜬다(lib/newsItems.js 의 unseenNews 참고).
--
-- null 은 한 번도 안 봤다는 뜻이다. 기존 21명이 전부 null 이 되므로, 배포 후
-- 첫 로그인에 지금까지의 소식 세 건을 함께 본다 — 그게 이 기능을 만든 이유다.
alter table team_members add column if not exists news_seen_at timestamptz;

comment on column team_members.news_seen_at is
  '업데이트 소식을 마지막으로 본 시각. null 이면 한 번도 안 봤다. 날짜만 견준다.';

-- 누가 아직 안 봤는지 확인할 때:
-- select name, news_seen_at from team_members where is_active order by news_seen_at nulls first;
