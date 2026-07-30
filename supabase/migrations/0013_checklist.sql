-- 0013: 요구사항 하위 작업 체크리스트
--
-- 요구사항을 처리하다 보면 하위 작업이 생긴다("API 연동", "QA", "배포").
-- 지금은 이걸 담을 곳이 없어 본문(To-Be)에 텍스트로 적거나 별도로 관리했다.
--
-- change_logs 에 얹지 않는다. change_logs 는 감사 기록이라 고치거나 지우면
-- 안 되는데, 체크리스트 항목은 이름을 고치기도 하고 잘못 만들면 지우기도
-- 한다. requirement_comments(0010)와 같은 이유로 별도 테이블이다.
--
-- brand_id 를 두지 않는다. 항상 요구사항을 통해서만 조회되고, 브랜드는
-- requirements 에서 온다. 복제하면 둘이 어긋날 수 있다.
create table if not exists requirement_checklist_items (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  -- 이미지 첨부(requirement_images.sort_order)와 같은 방식이다: 서버가
  -- "현재 최대값 + 1"을 매겨 넣는다. 사용자가 순서를 바꾸는 기능은 아직
  -- 없고, 추가한 순서 그대로 보여주는 것이 목적이다.
  sort_order integer not null default 0,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_requirement_checklist_items_requirement
  on requirement_checklist_items (requirement_id, sort_order);
