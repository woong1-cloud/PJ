-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 코멘트에 시안을 붙인다.
--
-- 지금 첨부는 요구사항 단위다. 기획자가 논의 중 시안을 올리면 원래 요청의
-- 증거(화면 캡처·기획서)와 같은 칸에 섞여서, 나중에 보면 어느 것이 처음
-- 요청이고 어느 것이 논의 중 나온 안인지 알 수 없다.
--
-- 컬럼 하나로 나눈다.
--   있음 = 그 코멘트에 붙은 시안
--   없음 = 지금까지의 요구사항 첨부
-- 기존 첨부 12개는 전부 null 이라 지금과 똑같이 보인다.
--
-- on delete cascade 인 이유: 코멘트를 지우면 거기 붙은 시안도 함께 지워져야
-- 한다. 남겨 두면 comment_id 가 가리킬 곳을 잃는데, 그때 이 값이 null 이
-- 되면 요구사항 첨부로 되살아나 "지웠는데 그림이 남아 있다"가 된다.
alter table requirement_images
  add column if not exists comment_id uuid
  references requirement_comments(id) on delete cascade;

comment on column requirement_images.comment_id is
  '이 첨부가 붙은 코멘트. null 이면 요구사항 첨부다.';

-- 코멘트 목록을 불러올 때마다 코멘트별 시안을 함께 읽는다.
-- 부분 인덱스인 이유: 첨부의 대부분은 null(요구사항 첨부)이고, 그쪽은
-- requirement_id 로 찾지 이 컬럼으로 찾지 않는다.
create index if not exists requirement_images_comment_id_idx
  on requirement_images (comment_id)
  where comment_id is not null;
