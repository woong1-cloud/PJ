-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 확인 대기 — 공이 요청자에게 넘어가 있다는 표시.
--
-- 지금은 요건이 불명확해 물어봐도 그 건이 여전히 '검토대기 27일'로 남는다.
-- 화면은 "IT 가 27일째 안 집었다"고 말하는데 실제로는 답을 기다리는 중이다.
-- 검토대기 중앙값 17일 중 일부가 우리 쪽 지연이 아닐 수 있고, 그 구분이
-- 앱에 없었다.
--
-- 상태가 아니라 컬럼인 이유: '일이 어디까지 갔나'(검토대기·검토중)와 '공이
-- 누구에게 있나'는 직교하는 축이다. 하나로 합치면 둘 다 흐려진다. 그리고
-- 보류를 만든 지 나흘째라, 상태 목록을 또 늘리면 열둘이 되고 그때부터
-- 아무도 상태 가이드를 안 읽는다.
alter table requirements
  add column if not exists awaiting_answer_since timestamptz,
  add column if not exists awaiting_answer_comment_id uuid
    references requirement_comments(id) on delete set null;

comment on column requirements.awaiting_answer_since is
  '요청자에게 요건을 물어본 시각. null 이면 우리 차례다.';
comment on column requirements.awaiting_answer_comment_id is
  '무엇을 물어봤는지 가리키는 코멘트. 코멘트를 지워도 확인 대기는 유지된다.';

-- 확인 대기인 건만 찾는다. 대부분이 null 이라 부분 인덱스로 충분하다.
create index if not exists requirements_awaiting_answer_idx
  on requirements (brand_id, awaiting_answer_since)
  where awaiting_answer_since is not null;
