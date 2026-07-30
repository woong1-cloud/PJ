-- 0014: 요구사항 영구 삭제 기록
--
-- 전체 관리자가 요구사항을 완전히 지울 수 있게 하면서 생긴 구멍이 하나 있다.
-- 그 요구사항의 change_logs 도 함께 사라지기 때문에, 지우고 나면 "그런 게
-- 있었다"는 사실 자체가 어디에도 남지 않는다. 누가 왜 지웠는지 물어볼
-- 대상조차 없어진다.
--
-- 그래서 지우기 전에 최소한의 스냅샷을 여기에 옮겨 적는다. 복원용이 아니다
-- (본문·이미지·이력은 그대로 버린다). "2026-07-30에 한지웅이 '스파오 장바구니
-- 오타' 건을 중복 등록이라 지웠다"를 나중에 확인할 수 있으면 충분하다.
--
-- requirement_id 에 외래키를 걸지 않는다. 가리키는 행이 이미 없는 것이
-- 이 테이블의 정상 상태다.
create table if not exists requirement_deletions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null,
  brand_id uuid references brands(id),
  -- 삭제 시점의 값을 그대로 복사한다. 요청자를 team_members FK 로 두면
  -- 그 사람이 나중에 팀에서 빠졌을 때 기록이 또 흐려진다.
  title text not null,
  status text,
  requester_name text,
  reason text not null,
  deleted_by uuid references team_members(id),
  deleted_at timestamptz not null default now()
);

create index if not exists idx_requirement_deletions_deleted_at
  on requirement_deletions (deleted_at desc);

-- 이 테이블은 서버(service_role)만 쓴다. anon 키로는 어떤 경우에도 열리면 안 된다.
alter table requirement_deletions enable row level security;
