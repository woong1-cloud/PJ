-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 회의 세션. '직전 회의가 끝난 뒤부터 지금까지'를 알기 위한 표시 하나다.
--
-- 회의 마치기를 누르면 그 이후 배정된 건을 요청자에게 알린다. 그 범위를
-- 정하려면 "지난번에 어디까지 알렸나"가 있어야 하고, 이 테이블이 그 한 줄이다.
--
-- 시작 시각을 두지 않는 이유: 회의 화면을 여는 것이 곧 회의 시작이라고
-- 정해야 하는데, 그 화면은 회의 밖에서도 열린다. 끝만 기록하면 구간은
-- '직전 끝 ~ 이번 끝'으로 저절로 정해진다.
create table meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  ended_at timestamptz not null default now(),
  ended_by uuid references team_members(id)
);

-- 브랜드마다 '가장 최근 하나'만 찾는다. 그 조회 모양 그대로 인덱스를 건다.
create index idx_meeting_sessions_brand on meeting_sessions (brand_id, ended_at desc);
