-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 모아에 대한 의견.
--
-- 지금은 쓰는 사람이 불편한 점을 말할 곳이 없다. 실제로 나온 의견 셋(보류
-- 상태, 요청일 필터, 코멘트 시안)은 전부 대면으로 전해졌고, 그렇게만 오면
-- 자리에 없는 사람의 말은 영영 안 온다.
--
-- brand_id 를 두지 않는다. 의견은 모아 전체에 대한 것이지 어느 브랜드의
-- 것이 아니다.
--
-- 종류·우선순위 칸도 없다. 분류는 쓰는 사람보다 읽는 쪽이 잘하고, 칸이
-- 늘수록 "이 버튼 좀 작아요" 같은 가벼운 말이 안 올라온다.
create table if not exists moa_feedback (
  id uuid primary key default gen_random_uuid(),
  -- 계정을 지우면 의견도 함께 사라진다. 낸 사람이 없는 의견은 읽어도
  -- 답할 곳이 없다.
  member_id uuid not null references team_members(id) on delete cascade,
  body text not null,
  status text not null default '새로 옴'
    check (status in ('새로 옴','확인함','반영함')),
  -- '반영함' 으로 바꿀 때 받는 한 줄. 그대로 낸 사람에게 간다.
  -- 메모 없이는 '반영함' 으로 못 바꾼다(lib/feedback.js) — 무엇이 어떻게
  -- 반영됐는지 없으면 낸 사람은 그냥 닫혔다고 읽는다.
  admin_note text,
  -- 요구사항으로 승격한 경우 그 건. 승격은 관리 화면에서만 한다.
  -- 요구사항이 지워져도 의견은 남아야 하므로 set null 이다.
  requirement_id uuid references requirements(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 관리 화면은 늘 새로 온 것부터 본다.
create index if not exists moa_feedback_created_at_idx
  on moa_feedback (created_at desc);

comment on table moa_feedback is
  '모아 자체에 대한 의견. 브랜드와 무관하며 전체 관리자가 /admin/feedback 에서 읽는다.';
