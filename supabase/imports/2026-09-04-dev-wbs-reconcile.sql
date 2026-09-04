-- Supabase SQL Editor에 붙여넣어 실행한다. 호카 런칭 하나만 건드린다.
-- 2026-09-04-rename-total-pm.sql (총PM → 개발PM) 을 **먼저** 돌린다.
--
-- 개발사(쓰리탑) 구축 WBS 55건과 대조한 결과다.
--   파일: HOKA_Ecommerce_WBS_2026-2027(1).xlsx
--   착수 2026-09-14 · 1차 통합테스트 12/01~12/11 · 2차 12/15~12/23
--   12/23 이후 신규 기능 개발 Freeze · 공식 오픈 2027-01-01
--
-- 두 문서는 축이 다르다. 모아의 476건은 '브랜드가 정하고 준비할 것'이고
-- 개발 WBS 는 '개발사가 만들 것'이다. 그래서 덮어쓰지 않고 대조만 한다 —
-- 겹치는 자리에서 어긋난 것만 고치고, 브랜드가 기다리는 게이트만 들여온다.
--
--   [1] 중복 4건 → 해당없음, 후행 이관
--   [2] 끊긴 선행 4건 → 비우기
--   [3] 개발 착수보다 늦은 브랜드 결정 6건 → 기한 당기기
--   [4] Freeze 이후에 남은 검증 2건 → 2차 통합테스트 안으로
--   [5] 개발 마일스톤 11건 신규
--
-- 되돌리려면: [5]는 delete, [1]은 status='할 것' + excluded_reason=null,
-- [2][3][4]는 아래 주석에 적힌 원래 값으로 update.

do $$
declare
  L uuid;
  n int;
begin
  select id into L from launches where name = '호카';
  if L is null then
    raise exception '호카 런칭을 못 찾았습니다.';
  end if;

  ----------------------------------------------------------------------------
  -- [1] 중복 — 지우지 않고 '해당없음'으로 둔다
  --
  -- 지우면 상태·사유가 함께 사라지고, 후행이 매달린 채로 끊긴 링크가 된다.
  -- 해당없음은 진척률 분모에서 빠지므로 세는 데도 영향이 없다.
  --
  -- 후행을 먼저 살아있는 쪽으로 옮긴다. 순서가 바뀌면 옮길 대상을 잃는다.
  ----------------------------------------------------------------------------

  -- 1-a) 02-06 '통신판매업 신고 (신규 또는 변경)' → 01-03 (이미 완료)
  --      후행 02-07 · 06-17 을 01-03 으로.
  update launch_tasks
     set depends_on = array_replace(depends_on, '02-06', '01-03')
   where launch_id = L and '02-06' = any(depends_on);
  get diagnostics n = row_count;
  raise notice '[1a] 02-06 후행 %건 이관', n;

  -- 1-b) 13-07 'CRM 솔루션 계약…' → 01-17 (글자까지 동일, 후행 없음)
  --      13-07 은 코드 앞자리(13)와 워크스트림(D01_법인·행정)이 어긋난
  --      유일한 항목이기도 하다 — 이걸 빼면 그 이상도 함께 사라진다.
  update launch_tasks
     set depends_on = array_replace(depends_on, '13-07', '01-17')
   where launch_id = L and '13-07' = any(depends_on);

  -- 1-c) 04-16 '교환/반품/청약철회 정책…' → 09-06 (CS 소관이 맞다)
  --      후행 04-17 · 06-10 · 16-17 을 09-06 으로.
  update launch_tasks
     set depends_on = array_replace(depends_on, '04-16', '09-06')
   where launch_id = L and '04-16' = any(depends_on);
  get diagnostics n = row_count;
  raise notice '[1c] 04-16 후행 %건 이관', n;

  -- 1-d) 04-11 '상세페이지 모듈 표준' → 05-10
  --      05-10 이 선행(18-10 웹 디자인)과 후행(05-11)을 다 갖고 있고
  --      제목도 더 정확하다('화면 디자인 확정본 기준').
  update launch_tasks
     set depends_on = array_replace(depends_on, '04-11', '05-10')
   where launch_id = L and '04-11' = any(depends_on);

  update launch_tasks
     set status = '해당없음',
         excluded_reason = case code
           when '02-06' then '중복 — 01-03 통신판매업 신고와 같은 일'
           when '13-07' then '중복 — 01-17 과 제목까지 동일'
           when '04-16' then '중복 — 09-06 교환·반품 정책과 같은 일 (CS 소관)'
           when '04-11' then '중복 — 05-10 상세페이지 모듈 표준 확정으로 통합'
         end,
         excluded_at = now(),
         updated_at = now()
   where launch_id = L
     and code in ('02-06', '13-07', '04-16', '04-11')
     -- 사람이 이미 붙어 있는 일은 파일이 지우지 않는다. 재가져오기의
     -- markNa 규칙과 같다(lib/launchReimport.js).
     and status = '할 것';
  get diagnostics n = row_count;
  raise notice '[1] 중복 %건 해당없음', n;

  ----------------------------------------------------------------------------
  -- [2] 끊긴 선행 — 목록에 없는 코드를 가리킨다
  --
  -- 비운다. 그럴듯한 코드를 넣지 않는 이유: 지금은 없는 코드라 대기로
  -- 안 치지만(isWaitingOnDep), 추측한 선행을 넣으면 그 순간부터 진짜로
  -- 기다리게 되어 '착수 가능'에서 빠진다. 틀린 링크는 없는 링크보다 나쁘다.
  --
  -- 후보는 남겨 둔다 — 담당자가 맞다고 하면 그때 건다:
  --   08-10 배송비 세팅   ← 09-06 교환·반품 정책 및 귀책별 배송비 기준
  --   08-15 포장재 사양   ← 04-02 로고 파일셋 (로고 인쇄에 필요)
  --   08-16 동봉물 구성   ← 10A-05 쿠폰 발급·사용 조건
  --   14-01 파트너 목록화 ← 없음 (D-100, 9단 체인의 뿌리다)
  ----------------------------------------------------------------------------
  update launch_tasks
     set depends_on = '{}', updated_at = now()
   where launch_id = L and code in ('08-10', '08-15', '08-16', '14-01');
  get diagnostics n = row_count;
  raise notice '[2] 끊긴 선행 %건 비움', n;

  ----------------------------------------------------------------------------
  -- [3] 브랜드 결정이 개발 착수보다 늦은 것
  --
  -- 개발사가 이미 만들기 시작한 뒤에 브랜드가 정하게 되어 있었다.
  -- 개발 착수 5일 전으로 당긴다 — 당일에 주면 반영할 시간이 없다.
  --
  --   코드    현재            개발 착수                     새 기한
  ----------------------------------------------------------------------------
  --   18-44   D-60 (11/02)   10/05 회원/인증 개발 (6.1)    D-93 (09/30)
  --   18-43   D-55 (11/07)   10/19 관리자 기능 개발 (6.6)  D-79 (10/14)
  --   18-42   D-60 (11/02)   10/19 관리자 기능 개발 (6.6)  D-79 (10/14)
  --   18-41   D-70 (10/23)   10/19 관리자 기능 개발 (6.6)  D-79 (10/14)
  --   18-13   D-75 (10/18)   10/05 보안·WAF·SSL 설계 (5.3) D-93 (09/30)
  --   18-36   D-100(09/23)   09/21 요구사항 정의 (2.5)     D-107(09/16)
  update launch_tasks set day_offset = -93,  updated_at = now()
   where launch_id = L and code in ('18-44', '18-13');

  -- 18-13 의 선행이 18-12(인프라 설계 검증, D-80)였다. 당기면 선행보다
  -- 앞서 버린다 — 그런데 방향 자체가 거꾸로다. 보안 요건은 인프라 설계를
  -- 기다리는 것이 아니라 그 설계의 입력이다. 선행을 18-08(구축 범위 확정)
  -- 으로 옮기고, 18-12 는 WBS 5.1 종료(10/02)에 맞춰 D-91 로 당긴다.
  update launch_tasks
     set depends_on = array['18-08'], updated_at = now()
   where launch_id = L and code = '18-13';
  update launch_tasks set day_offset = -91, updated_at = now()
   where launch_id = L and code = '18-12';
  update launch_tasks set day_offset = -79,  updated_at = now()
   where launch_id = L and code in ('18-41', '18-42', '18-43');
  update launch_tasks set day_offset = -107, updated_at = now()
   where launch_id = L and code = '18-36';
  raise notice '[3] 기한 6건 당김';

  -- 18-41 → 18-42 · 18-43 순서가 같은 날이 되었다. 하루씩 벌린다 —
  -- 선행이 후행보다 늦거나 같으면 간트에서 줄이 뒤집힌다.
  update launch_tasks set day_offset = -80, updated_at = now()
   where launch_id = L and code = '18-41';

  ----------------------------------------------------------------------------
  -- [4] Freeze 이후에 남은 검증
  --
  -- 개발사 운영원칙이 '12/23 이후 신규 기능 개발 Freeze' 다. 12/24 에
  -- 하는 결제·쿠폰 검증에서 버그가 나오면 고칠 창구가 없다.
  -- 2차 통합테스트 기간(12/15~12/23) 안으로 넣는다.
  --
  -- 선행은 2차(19-08)가 아니라 1차(19-07)다. 2차의 '종료'를 기다리게 걸면
  -- 검증이 12/23 뒤로 밀려 고치려던 문제가 그대로 남는다 — 이 검증은
  -- 2차 기간 안에서 하는 일이다.
  ----------------------------------------------------------------------------
  update launch_tasks
     set day_offset = -12, depends_on = array['19-07'], updated_at = now()
   where launch_id = L and code = '17-10';        -- 12/24 → 12/20
  update launch_tasks
     set day_offset = -12, depends_on = array['19-07', '06-07'], updated_at = now()
   where launch_id = L and code = '17-11';        -- 12/24 → 12/20
  raise notice '[4] Freeze 이후 검증 2건 당김';

  ----------------------------------------------------------------------------
  -- [5] 개발 마일스톤 — 새 워크스트림 D20_개발구축
  --
  -- 55건을 다 넣지 않는다. 벤더의 내부 작업(PDP/Cart 개발, ERP 연계…)은
  -- 일정이 주마다 바뀌어서, 넣는 순간 모아가 벤더 일정 관리 도구가 되고
  -- 매주 다시 넣어야 한다. 브랜드가 '기다리는 날'만 들여온다.
  --
  -- 제목은 벤더의 작업이 아니라 브랜드의 할 일로 쓴다 — 모아는 브랜드의
  -- 목록이다. '화면설계서 작성'이 아니라 '화면설계서 검토·승인'이다.
  --
  -- M1(킥오프)과 M3 중 화면 설계 착수는 안 넣는다 — 18-29 · 18-09 가
  -- 이미 같은 일이다. 중복을 지우면서 새 중복을 만들지 않는다.
  --
  -- day_offset 은 WBS 종료일 기준이다 (오픈 2027-01-01).
  ----------------------------------------------------------------------------
  insert into launch_tasks
    (launch_id, code, workstream, category, title, owner_org, owner_role,
     support_role, depends_on, day_offset, deliverable, note, is_critical,
     sort_order, status, source)
  values
    (L, '19-01', 'D20_개발구축', '요구사항',
     '요구사항정의서 검토·승인 (누락 기능 최종 확인)',
     '브랜드', '브랜드PM', '온라인BU 서비스기획', array['18-08'], -91,
     '요구사항정의서 승인본', 'WBS 2.5 / M2 · 09-21~10-02', true, 1, '할 것', 'manual'),

    (L, '19-02', 'D20_개발구축', '설계',
     '화면설계서(PC/MO) 검토·승인',
     '브랜드', '브랜드PM', '온라인BU 서비스기획', array['19-01'], -77,
     '화면설계서 승인본', 'WBS 3.3 / M3 · 09-28~10-16', true, 2, '할 것', 'manual'),

    (L, '19-03', 'D20_개발구축', '설계',
     '전체 화면 디자인 최종 승인',
     '브랜드', '브랜드', '브랜드PM', array['19-02'], -63,
     '최종 디자인 승인본', 'WBS 4.4 / M4 · 10-19~10-30', true, 3, '할 것', 'manual'),

    (L, '19-04', 'D20_개발구축', '개발',
     '관리자 기능 인수 확인 (권한 4단계·접근통제·작업 로그 반영 여부)',
     '브랜드', '온라인BU 서비스기획', '개발PM', array['19-03', '18-43'], -42,
     'Admin 인수 확인서', 'WBS 6.6 / M6 · 10-19~11-20', false, 4, '할 것', 'manual'),

    (L, '19-05', 'D20_개발구축', '개발',
     'PC/MO 통합·브라우저 최적화 완료 확인 (Feature Complete)',
     '브랜드', '온라인BU 서비스기획', '개발PM', array['19-03'], -42,
     'Feature Complete 확인', 'WBS 7.5 / M6 · 11-09~11-20', true, 5, '할 것', 'manual'),

    (L, '19-06', 'D20_개발구축', '연계',
     '전체 Interface 통합검증 참여 (ERP·OMS/WMS·PG·CRM)',
     '브랜드', '온라인BU 서비스기획', 'CAIO실', array['19-05'], -42,
     'Interface Test 결과', 'WBS 8.5 / M6 · 11-16~11-20', true, 6, '할 것', 'manual'),

    (L, '19-07', 'D20_개발구축', '테스트',
     '1차 통합테스트 참여 및 결함 등록',
     '브랜드', '전체', '온라인BU 서비스기획', array['19-04', '19-05', '19-06'], -21,
     '1차 테스트 결과', 'WBS 10.3 / M7 · 12-01~12-11', true, 7, '할 것', 'manual'),

    (L, '19-08', 'D20_개발구축', '테스트',
     '2차 통합/Regression Test 참여 — 이후 신규 개발 Freeze',
     '브랜드', '전체', '온라인BU 서비스기획', array['19-07'], -9,
     '최종 테스트 결과', 'WBS 10.5 / M8 · 12-15~12-23. 이 날 이후 개발사는 신규 기능을 만들지 않는다',
     true, 8, '할 것', 'manual'),

    (L, '19-09', 'D20_개발구축', '테스트',
     '최종 결함 수정 검증 및 Go-Live 승인 판단',
     '브랜드', '브랜드PM', '온라인BU 서비스기획', array['19-08'], -5,
     'Go-Live 승인 판단', 'WBS 10.6 / M9 · 12-15~12-27', true, 9, '할 것', 'manual'),

    (L, '19-10', 'D20_개발구축', '오픈준비',
     'Cut-over/Go-Live 리허설 참여',
     '브랜드', '전체', '개발PM', array['19-09'], -2,
     'Cut-over Plan', 'WBS 11.5 / M10 · 12-28~12-30', true, 10, '할 것', 'manual'),

    (L, '19-11', 'D20_개발구축', '오픈준비',
     '오픈 승인 및 변경 Freeze 확정',
     '브랜드', '브랜드PM', '개발PM', array['19-10'], -1,
     'Go-Live 승인서', 'WBS 11.6 / M11 · 12-31', true, 11, '할 것', 'manual')
  on conflict (launch_id, code) do nothing;
  get diagnostics n = row_count;
  raise notice '[5] 마일스톤 %건 추가', n;

  ----------------------------------------------------------------------------
  -- [6] 기존 오픈리허설을 게이트에 잇는다
  --
  -- 17-xx 는 지금 선행이 거의 없어서 전부 '착수 가능'으로 나온다.
  -- 실제로는 2차 통합테스트가 끝나야 할 수 있는 일들이다.
  ----------------------------------------------------------------------------
  update launch_tasks
     set depends_on = array['19-09'], updated_at = now()
   where launch_id = L and code = '17-14'         -- 비상 대응 시나리오·롤백 기준
     and depends_on = '{}';
  update launch_tasks
     set depends_on = array['19-11'], updated_at = now()
   where launch_id = L and code = '17-15'         -- 오픈 직후 채널 주문 수집 확인
     and depends_on = '{}';
  raise notice '[6] 오픈리허설 2건 게이트 연결';
end $$;

-- ---------------------------------------------------------------------------
-- 확인용
-- ---------------------------------------------------------------------------

-- 1) 새 워크스트림 11건
select code, day_offset,
       (date '2027-01-01' + day_offset) as 기한,
       owner_role, title
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
   and workstream = 'D20_개발구축'
 order by code;

-- 2) 중복 4건이 해당없음으로 갔는지
select code, status, excluded_reason
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
   and code in ('02-06', '13-07', '04-16', '04-11')
 order by code;

-- 3) 끊긴 선행이 남아 있는지 — 0건이 나와야 한다
select t.code, dep.code as 없는_선행
  from launch_tasks t
  cross join lateral unnest(t.depends_on) as dep(code)
 where t.launch_id = (select id from launches where name = '호카')
   and not exists (
     select 1 from launch_tasks x
      where x.launch_id = t.launch_id and x.code = dep.code);

-- 4) 선행이 후행보다 늦은 것.
--
-- 0건이 아니다. 이 스크립트 전에도 19건이 있었다 — 이번에 만든 것이
-- 아니라 원래 있던 자료의 흠이다. 고치려면 담당자에게 물어야 해서
-- 여기서는 건드리지 않는다. 이번 변경으로 새로 생긴 것은 없다.
--
-- 큰 것 셋:
--   18-34 [갭] EP·상품피드 D-112 ← 12-02 D-60   (52일)
--   18-35 앱 스토어 심사     D-60  ← 16-05 D-21  (39일)
--   06-15 스마트스토어 결정  D-90  ← 02-03 D-60  (30일)
-- unnest 를 쉼표로 붙인 뒤 join 을 쓰면 join 이 unnest 에만 걸려서
-- t 가 안 보인다 (42P01 invalid reference to FROM-clause entry for table "t").
-- cross join lateral 로 순서를 못 박는다.
select t.code as 후행, t.day_offset as 후행D, p.code as 선행, p.day_offset as 선행D
  from launch_tasks t
  cross join lateral unnest(t.depends_on) as dep(code)
  join launch_tasks p
    on p.launch_id = t.launch_id and p.code = dep.code
 where t.launch_id = (select id from launches where name = '호카')
   and t.status <> '해당없음' and p.status <> '해당없음'
   and p.day_offset > t.day_offset
 order by p.day_offset - t.day_offset desc;
