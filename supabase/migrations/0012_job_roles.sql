-- 0012: 직무 선택지 확장
--
-- 0008 에서 '기획자/개발자/디자이너/기타' 넷으로 시작했는데, 실제로 요구사항을
-- 올리는 사람 대부분이 그 넷에 없었다. 브랜드 쪽은 온라인 MD·마케팅·CS 가
-- 주력이고, 그 사람들이 전부 '기타'로 들어오면 관리자가 배치할 때 누가 누군지
-- 알 수 없다. 이 칸의 유일한 쓸모가 그 판단인데 그게 사라진다.
--
-- '온라인 MD' 는 상품 등록·가격·자사몰 운영·외부몰(무신사·지그재그) 관리를
-- 묶은 것이다. 업무로는 셋이지만 패션 리테일에서는 한 사람의 직함이다.
--
-- job_role 은 여전히 표시용이다. 권한은 소속(브랜드→4차, 본부→3차)에서만
-- 제안되고 확정은 관리자가 한다. 이 목록을 늘려도 권한 경계는 움직이지 않는다.

-- 기존 CHECK 를 이름으로 지우지 않고 정의 내용으로 찾아 지운다.
--
-- 0008 은 `add column ... check (...)` 로 제약을 만들었고, 그때 붙는 이름은
-- Postgres 가 정한다(보통 team_members_job_role_check). 이름을 가정하고
-- drop if exists 를 쓰면, 이름이 다를 때 조용히 아무것도 지우지 않고 아래에서
-- 제약을 하나 더 추가한다. 그러면 낡은 제약이 그대로 남아 새 직무를 계속
-- 거부하는데, 마이그레이션은 성공한 것으로 보인다 — 가장 찾기 어려운 실패다.
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'team_members'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%job_role%'
  loop
    execute format('alter table team_members drop constraint %I', c.conname);
  end loop;
end $$;

alter table team_members add constraint team_members_job_role_check
  check (job_role in (
    '온라인 MD',
    '마케팅',
    'CS',
    '기획자',
    '디자이너',
    '개발자',
    '데이터 분석',
    '기타'
  ));
