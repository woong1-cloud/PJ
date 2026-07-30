-- 0010: 요구사항 코멘트
--
-- change_logs 에 얹지 않고 별도 테이블로 둔다.
-- change_logs 는 감사 기록이라 고치거나 지우면 안 되는데, 코멘트는 오타도
-- 고치고 지우기도 한다. 한 테이블에 섞으면 "이 행은 지워도 되나?"가 매번
-- 애매해진다. 화면에서는 두 출처를 시간순으로 섞어 한 줄기로 보여준다.
--
-- brand_id 를 두지 않는다. 코멘트는 항상 특정 요구사항에 딸려 조회되고,
-- 브랜드는 requirements 에서 온다. 복제하면 둘이 어긋날 수 있다.
create table if not exists requirement_comments (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  author uuid references team_members(id),
  body text not null,
  created_at timestamptz not null default now(),
  -- 수정되면 채워진다. null 이면 한 번도 안 고친 코멘트다.
  edited_at timestamptz
);

create index if not exists idx_requirement_comments_requirement
  on requirement_comments (requirement_id, created_at);
