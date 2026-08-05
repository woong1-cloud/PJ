-- 스파오 요구사항 시트 이관 — 요청일 2026-08-05 건 (4건)
--
-- 앞선 2026-08-05-spao-sheet.sql(7/8~7/23 13건)의 후속이다. 같은 시트에서
-- 새로 추가된 줄만 옮긴다.
--
-- 마이그레이션이 아니라 데이터 이관이므로 supabase/migrations/ 에 두지 않는다.
-- 새 환경을 만들 때 남의 브랜드 데이터가 딸려 들어가면 안 된다.
--
-- 중복 대조
--   MOA 가 자체 중복 감지에 쓰는 trigramSimilarity 로 기존 23건과 대조했다.
--   최고 점수는 '장바구니 내 가격 노출' 39%('장바구니 내 최대혜택가 바로 노출'),
--   '품절 상품에 대한 전시' 19%('품절 상품 리스팅 자동 하위 정렬') 였다.
--
--   둘 다 사람이 보면 기존 건과 겹치는 부분이 있다. 특히 '품절 상품에 대한
--   전시'는 TO-BE 두 줄이 각각 '신상품 영역 전시 점검'·'품절 상품 리스팅 자동
--   하위 정렬'과 같은 요구다(표현이 달라 알고리즘이 못 잡았다).
--
--   그럼에도 넷 다 넣는다 — 요청자가 다르고, 병합 판단은 IT 가 화면에서
--   중복처리로 한다. 여기서 임의로 빼면 올린 사람은 자기 요청이 사라진 것으로
--   본다.
--
-- 변환 규칙 (앞선 파일과 동일)
--   상태     요청·검토 → 전부 '검토대기'. MOA 의 '검토중' 은 담당자·예상일이
--            붙는 상태인데 시트에는 둘 다 없다.
--   채널     시트에 없음 → 전부 '자사몰' (필수값)
--   유형     운영개선 → '개선'
--   우선순위 시트에 값 없음 → 전부 비움
--   요청자   김동현은 MOA 팀원에 있어 연결된다. 하새란은 없어서 비우고
--            비고에 이름을 남긴다 — 계정을 만드는 것은 별건이다.
--   비고     시트의 비고 열만. 오른쪽 열들("대략적인 배포일", "ㄴ 관리방식",
--            "ㄴ QA 관리")은 행과 무관한 회의 메모라 옮기지 않는다.
--
-- 두 번 실행해도 안전하다. 같은 브랜드에 같은 제목이 있으면 건너뛴다.

begin;

with src(
  title, as_is, to_be, note, request_date, requester_name, category_name, req_type
) as (
  values
  ('기간할인 카테고리 내 정렬 추가',
   '기간할인 카테고리에 기존 전시 기준 외 할인율/가격 기준으로 탐색이 불가능하다.',
   '아이템 카테고리와 동일한 정렬 추가',
   '시트 상태: 요청',
   '2026-08-05', '김동현', '전시', '개선'),

  ('품절 상품에 대한 전시',
   '1) 상품 등록 시점과 재고 연동 시점에 차이가 발생한다 -> 상품 등록은 됐지만 재고가 연동되지 않은 신상품이 전시에 노출된다.
2) 카테고리별 상위 전시 영역에 품절 상품이 노출되는 케이스가 발생한다.',
   '1) 신상품 카테고리에는 품절 상품을 노출하지 않는다.
2) 품절 상품에 대한 모든 전시는 하단으로 고정한다.',
   '시트 상태: 요청
기존 "신상품 영역 전시 점검", "품절 상품 리스팅 자동 하위 정렬" 과 요구가 겹칠 수 있다 — 확인 후 중복처리 검토.',
   '2026-08-05', '김동현', '전시', '개선'),

  ('장바구니 내 가격 노출',
   '장바구니 내에서 기간할인(가격 연동으로 적용된 할인)이 표시되지 않고 즉시할인·쿠폰할인 금액만 노출된다.',
   '장바구니 내에 가격 연동으로 인한 할인도 정상가와 함께 노출하여 가격·할인 메리트를 드러낸다.',
   '시트 상태: 요청
기존 "장바구니 내 최대혜택가 바로 노출" 과 같은 화면이다 — 확인 후 중복처리 검토.',
   '2026-08-05', '김동현', '프론트', '개선'),

  ('이벤트 통합포인트 미사용 전환',
   '이벤트 통합포인트를 지급할 수 있는 상태다.',
   '[BO > 이벤트 등록 > 이벤트 당첨정보 > 경품유형] 내 통합포인트 구분자를 hidden 처리한다.',
   '시트 상태: 검토 / 요청자(시트): 하새란 / 담당(시트): 하새란
하새란은 아직 MOA 팀원이 아니라 요청자 칸을 비워 두었다.',
   '2026-08-05', null, '프로모션', '개선')
)
insert into requirements (
  brand_id, title, as_is, to_be, note, request_date,
  requester, status, category, priority, channel, requirement_type
)
select
  b.id,
  s.title,
  s.as_is,
  s.to_be,
  s.note,
  s.request_date::date,
  m.id,
  '검토대기',
  c.id,
  null,
  '자사몰',
  s.req_type
from src s
cross join (select id from brands where name = '스파오') b
-- 이름을 못 찾으면 비운다. 한 사람 때문에 이관 전체가 멈추면 안 된다.
left join team_members m on m.name = s.requester_name
left join brand_categories c
  on c.brand_id = b.id and c.category_name = s.category_name
where not exists (
  select 1 from requirements r
  where r.brand_id = b.id and r.title = s.title
);

commit;

-- 확인용
--
-- select r.title, r.status, c.category_name, t.name as requester
--   from requirements r
--   left join brand_categories c on c.id = r.category
--   left join team_members t on t.id = r.requester
--  where r.brand_id = (select id from brands where name = '스파오')
--    and r.request_date = '2026-08-05'
--  order by r.title;

-- 되돌리기. 이번에 넣은 4건만 지운다.
--
-- delete from requirements
--  where brand_id = (select id from brands where name = '스파오')
--    and request_date = '2026-08-05'
--    and title in (
--      '기간할인 카테고리 내 정렬 추가',
--      '품절 상품에 대한 전시',
--      '장바구니 내 가격 노출',
--      '이벤트 통합포인트 미사용 전환'
--    );
