-- 0009: 종결 상태(반려·취소), 채널, 공통 카테고리, 외부 링크

-- 1) 종결 상태 두 가지를 CHECK 에 추가한다.
--    보드 컬럼으로는 쓰지 않는다(BOARD_STATUSES 참조) — '중복'과 같은 취급이다.
alter table requirements drop constraint if exists requirements_status_check;
alter table requirements add constraint requirements_status_check
  check (status in ('작성중','검토대기','검토중','개발중','완료','반려','취소','중복'));

-- 2) 채널. 브랜드별 설정이 아니라 전사 고정 목록이다 — 브랜드마다 다른 이름을
--    쓰면 채널별 집계가 불가능해진다.
alter table requirements add column if not exists channel text
  check (channel in ('자사몰','오프라인','외부몰','공통','기타'));

update requirements set channel = '공통' where channel is null;
alter table requirements alter column channel set default '공통';

-- 3) 공통 카테고리. brand_id 가 null 이면 모든 브랜드에서 보이는 공통 항목이다.
alter table brand_categories alter column brand_id drop not null;

-- 공통 카테고리끼리 이름이 겹치지 않게 한다. brand_id 가 null 인 행은
-- 일반 unique 로는 중복을 못 막으므로 부분 인덱스를 쓴다.
create unique index if not exists idx_brand_categories_common_name
  on brand_categories (category_name) where brand_id is null;

-- 4) 외부 링크. 피그마 시안, GA4 대시보드, 슬랙 스레드처럼 여러 개가 붙는다.
--
-- created_by 가 team_members 를 참조하면서 requirement_links 는
-- requirements ↔ team_members 사이의 조인 테이블 모양이 된다(PostgREST 는
-- 이런 테이블을 M2M 후보로 잡는다). 다만 change_logs·duplicate_links·
-- in_app_notifications 가 이미 같은 모양이라 이 관계는 예전부터 여러 겹이었고,
-- 코드의 모든 embed 가 FK 이름을 명시하고 있다
-- (requirements_requester_fkey / requirements_assignee_fkey 등).
-- 그래서 이 FK 하나가 더 늘어도 새로 모호해지는 쿼리는 없다.
create table if not exists requirement_links (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  label text not null,
  url text not null,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_requirement_links_requirement
  on requirement_links (requirement_id);

-- 검증용
-- select status, count(*) from requirements group by status order by status;
-- select channel, count(*) from requirements group by channel;
