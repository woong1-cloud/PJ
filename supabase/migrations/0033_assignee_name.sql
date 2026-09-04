-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 담당자 이름 — 계정이 없는 사람도 적을 수 있게.
--
-- launch_tasks.assignee 는 이미 있다. 다만 team_members(id) 를 참조하는
-- uuid 라, 모아 계정이 있는 사람만 담을 수 있다.
--
-- 런칭에 나오는 역할을 보면 브랜드PM · 총PM · 물류팀 · CS팀 · CAIO실 ·
-- 법무팀 인데, 모아 활성 구성원 19명은 스파오 9 · 재무 6 · 소속없음 4 다.
-- 물류팀이나 CAIO실 사람이 모아에 계정을 갖고 있을 가능성이 낮다.
--
-- 계정이 생기기를 기다리면 담당자 칸이 영영 빈다. 이름을 글자로 받는다.
alter table launch_tasks add column if not exists assignee_name text;

comment on column launch_tasks.assignee_name is
  '담당자 이름(글자). 모아 계정이 없는 사람도 적을 수 있게. 계정이 붙으면 assignee 로 옮긴다.';

-- assignee(uuid) 는 그대로 둔다.
--
-- 지우지 않는 이유: 3단계에서 launch_members 로 사람을 붙이면 그때부터
-- "내 할 일"을 계정 기준으로 셀 수 있다. 그때 이름과 계정이 함께 있는 편이
-- 옮기기 쉽다 — 이름만 남아 있으면 동명이인을 사람이 다시 가려야 한다.
comment on column launch_tasks.assignee is
  '담당자 계정. 3단계(launch_members)에서 쓴다. 지금은 assignee_name 을 쓴다.';
