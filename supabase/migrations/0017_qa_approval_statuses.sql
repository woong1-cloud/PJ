-- 0017: QA중 · 승인대기 상태 추가
--
-- 개발이 끝난 뒤 두 개의 문이 생긴다. QA중은 개발팀이 테스트하는 구간이고,
-- 승인대기는 요청한 브랜드나 본부가 "요청한 대로 됐다"를 확인하기를 기다리는
-- 구간이다. 두 구간은 기다리는 주체가 달라서 한 칸으로 합치지 않는다.
--
-- 아래 목록은 0009_requirement_fields.sql 의 제약에 두 값만 더한 것이다.
-- 0009 이후 상태를 건드린 마이그레이션은 없다(확인함).
--
-- 데이터 변환은 없다. 기존 요구사항은 전부 지금 상태 그대로다. 이미 완료된
-- 건들은 승인 기록 없이 남는다 — 소급해서 누가 확인했다고 적을 수는 없다.
alter table requirements drop constraint if exists requirements_status_check;
alter table requirements add constraint requirements_status_check
  check (status in ('작성중','검토대기','검토중','개발중','QA중','승인대기',
                    '완료','반려','취소','중복'));

-- 검증용: 아래가 0건이어야 한다. 제약 밖의 값이 남아 있으면 위 alter 가
-- 애초에 실패하지만, 확인용으로 남겨 둔다.
--   select status, count(*) from requirements
--    where status not in ('작성중','검토대기','검토중','개발중','QA중',
--                         '승인대기','완료','반려','취소','중복')
--    group by status;
