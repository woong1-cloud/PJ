-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 런칭 참여자 3단계 — 문 열기.
-- 스펙: docs/superpowers/specs/2026-09-07-launch-participants-design.md
--
-- 지금까지 런칭을 만지는 사람이 전체 관리자 셋뿐이라 "누가 고쳤나"를 안
-- 물었다. 참여자가 들어오면 15명이 501건을 고치기 시작하고, 그때 회의에서
-- 바로 나온다 — "이거 왜 완료로 바뀌었지?"
--
-- updated_at 은 있는데 updated_by 가 없다. 이력 테이블까지는 과하다 —
-- 한 칸이면 '마지막에 누가 만졌나'에 답하고, 회의에는 그거면 충분하다.

alter table launch_tasks add column if not exists updated_by uuid references team_members(id);
alter table launch_decisions add column if not exists updated_by uuid references team_members(id);

comment on column launch_tasks.updated_by is
  '마지막에 이 항목을 고친 사람. 이력이 아니라 마지막 한 명만 안다.';

-- 확인용
select
  (select count(*) from information_schema.columns
    where table_name = 'launch_tasks' and column_name = 'updated_by') as 항목,
  (select count(*) from information_schema.columns
    where table_name = 'launch_decisions' and column_name = 'updated_by') as 결정;
