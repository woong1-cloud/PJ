-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 완료 건을 회의에서 확인했다는 표시.
--
-- 지금 주간회의의 '이번 주 완료'는 최근 7일 안에 완료된 건을 보여준다. 그런데
-- 그 칸의 목적은 "이번 주에 뭘 끝냈나"(성과 훑기)가 아니라 "완료된 것을 회의
-- 에서 한 번 더 확인하는 것"이다.
--
-- 목적이 그렇다면 기준이 시간이면 안 된다. 7일 창은 **확인 안 한 건도
-- 8일째에 조용히 사라지게** 만든다 — 목적과 정반대다.
--
-- 그래서 기간 조건을 없애고 이 컬럼 하나로 바꾼다. 확인할 때까지 남고,
-- 확인하면 빠진다.
--
-- 승인(승인대기 → 완료)과 다른 것이다. 승인은 브랜드·본부가 결과를 받아들이는
-- 절차이고, 이것은 팀이 배포된 것을 회의에서 함께 훑고 넘어가는 표시다.
alter table requirements
  add column if not exists meeting_reviewed_at timestamptz,
  add column if not exists meeting_reviewed_by uuid references team_members(id);

comment on column requirements.meeting_reviewed_at is
  '완료 건을 주간회의에서 확인한 시각. null 이면 아직 확인 전이다.';

-- 기존 완료 건은 전부 null 로 둔다. 회의가 아직 한 번도 안 열렸으므로
-- 실제로 아무것도 확인 안 된 것이 맞다 — 여기서 임의로 채우면 거짓말이 된다.

-- 확인 안 된 완료 건을 찾는다. 그 조회 모양 그대로 인덱스를 건다.
create index if not exists requirements_meeting_review_idx
  on requirements (brand_id, meeting_reviewed_at)
  where meeting_reviewed_at is null;
