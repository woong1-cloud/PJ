-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- '보류' 상태.
--
-- 지금은 반려와 취소밖에 없다. 반려된 6건을 읽어 보니 셋은 실제로 보류였다 —
-- "API 개편 예정이라 그 뒤에", "사업자 신고가 나와야", "우선순위 밀림". 하지
-- 않겠다고 정한 것이 아니라 지금은 못 하는 것이다.
--
-- 그런데 반려로 적으면 요청자에게는 거절로 읽히고, 취소로 적으면 요청자가
-- 거둔 것이 된다. 둘 다 사실이 아니다.
--
-- 종결 셋과 같은 자리에 둔다(목록 기본 숨김·회의 안건 제외·지연 판정 제외).
-- 딱 하나가 다르다 — 정체는 계속 잰다. 보류는 끝난 것이 아니라 미뤄둔 것이라,
-- 시간이 가는 것을 세야 잊히지 않는다(lib/stalled.js 의 HOLD_STALL_DAYS).
alter table requirements drop constraint if exists requirements_status_check;
alter table requirements add constraint requirements_status_check
  check (status in ('작성중','검토대기','검토중','개발중','QA중','승인대기',
                    '완료','보류','반려','취소','중복'));

-- 확인용:
-- select status, count(*) from requirements group by status order by 2 desc;
