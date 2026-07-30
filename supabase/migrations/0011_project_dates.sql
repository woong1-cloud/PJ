-- 0011: 프로젝트 기간 (로드맵의 가로축)
--
-- 로드맵을 그리려면 "언제부터 언제까지"가 있어야 하는데, projects 에는 날짜가
-- 하나도 없었다. 요구사항의 배포예상일에서 역산하는 방법도 있었지만, 그건
-- 실무자가 개별 건에 날짜를 다 채워 넣은 뒤에야 그림이 나온다 —
-- 로드맵은 보통 그 반대로, 프로젝트 기간을 먼저 정하고 그 안에 건을 담는다.
--
-- 둘 다 nullable 이다. 기간이 아직 안 정해진 프로젝트가 사라지면 안 되므로,
-- 화면은 날짜 없는 프로젝트를 차트 아래 '기간 미정'으로 따로 보여준다.
-- 하나만 채워진 경우는 마일스톤(◆) 한 점으로 찍는다.
alter table projects add column if not exists start_date date;
alter table projects add column if not exists target_date date;

-- 목표일이 시작일보다 앞서면 막대 폭이 음수가 된다. 화면에서 막아도
-- API 를 직접 부르면 들어올 수 있으니 DB 에서 못 박는다.
-- 한쪽이 null 이면 비교가 null 이 되어 CHECK 를 통과한다(원하는 동작).
alter table projects drop constraint if exists projects_date_order;
alter table projects add constraint projects_date_order
  check (start_date is null or target_date is null or start_date <= target_date);
