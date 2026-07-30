-- 0007: 요구사항 상태 이름 재정의 + 배포예상일 추가
--
-- 상태 이름에 "누구 차례인지"가 드러나게 바꾼다. '검토'와 '정책정의'는
-- 둘 다 IT가 들고 있는 단계라 '검토중' 하나로 합친다.
--
-- ⚠️ 주의: project_brands.status 에도 '진행중' 이 있다(전개 상태).
--    아래 UPDATE 는 반드시 requirements 테이블만 대상으로 한다.

-- 1) 제약을 먼저 없애야 데이터를 바꿀 수 있다
alter table requirements drop constraint if exists requirements_status_check;

-- 2) 데이터 변환
update requirements set status = '작성중'   where status = '대기';
update requirements set status = '검토대기' where status = '요청';
update requirements set status = '검토중'   where status in ('검토', '정책정의');
update requirements set status = '개발중'   where status = '진행중';

-- 3) 기본값도 함께 바꾼다 (0001_init.sql 에서 '대기' 로 설정돼 있다)
alter table requirements alter column status set default '작성중';

-- 4) 새 제약
alter table requirements add constraint requirements_status_check
  check (status in ('작성중','검토대기','검토중','개발중','완료','중복'));

-- 5) 배포예상일 — IT(3차 이상)만 입력한다. 앱 레벨에서 통제한다.
alter table requirements add column if not exists expected_release_date date;

-- 검증용: 변환 후 남아 있는 옛 상태가 없어야 한다 (0건이어야 정상)
-- select status, count(*) from requirements
--   where status in ('대기','요청','검토','정책정의','진행중') group by status;
