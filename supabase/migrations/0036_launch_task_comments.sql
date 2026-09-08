-- 0036: 런칭 항목 댓글
--
-- requirement_comments(0010) 와 같은 모양이다. 한 테이블에 합치지 않는다 —
-- 요구사항과 런칭 항목은 다른 테이블이고, 한 컬럼에 두 종류의 FK 를 담으면
-- on delete cascade 를 못 건다.
--
-- launch_id 를 두지 않는다. 댓글은 늘 특정 항목에 딸려 조회되고 런칭은
-- launch_tasks 에서 온다. 복제하면 둘이 어긋날 수 있다.
--
-- 이미지 첨부는 안 넣는다. 요구사항도 0026 으로 나중에 붙였다 —
-- 글부터 오가는지 보고 정한다.
create table if not exists launch_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references launch_tasks(id) on delete cascade,
  author uuid references team_members(id),
  body text not null,
  created_at timestamptz not null default now(),
  -- 수정되면 채워진다. null 이면 한 번도 안 고친 댓글이다.
  edited_at timestamptz
);

create index if not exists idx_launch_task_comments_task
  on launch_task_comments (task_id, created_at);
