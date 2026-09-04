-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 브랜드MD · 브랜드기획 · 브랜드디자인 → 브랜드 로 합친다.
--
-- 역할이 19종인데 그중 넷이 '브랜드' 계열이라 필터가 잘게 쪼개졌다.
-- 회의에서 "브랜드 것 봅시다" 하면 네 번 고르게 된다.
--
-- 대상 (가이드·런칭 각각):
--   주관  브랜드MD 10 · 브랜드디자인 4 · 브랜드기획 1  = 15건
--   지원  브랜드MD  6 · 브랜드디자인 2                 =  8건
--
-- 합치면 주관 '브랜드' 가 75 → 90건이 된다.
--
-- 잃는 것: MD 가 할 일인지 디자인이 할 일인지가 역할 칸에서 사라진다.
-- 다만 그 구분은 제목에 이미 있다 — '로고 파일셋(AI/PNG/SVG)' 은 읽으면
-- 디자인 일이고, '오픈 어소트먼트 셀렉' 은 MD 일이다. 역할 칸은 "어느 팀에
-- 물어보나"를 위한 것이고, 그 답은 셋 다 '브랜드' 다.

do $$
declare
  g_owner int; g_support int; t_owner int; t_support int;
begin
  -- 가이드
  update launch_guide_items
     set owner_role = '브랜드'
   where owner_role in ('브랜드MD', '브랜드기획', '브랜드디자인');
  get diagnostics g_owner = row_count;

  update launch_guide_items
     set support_role = '브랜드'
   where support_role in ('브랜드MD', '브랜드기획', '브랜드디자인');
  get diagnostics g_support = row_count;

  -- 런칭. 항목이 값 복사라 여기도 따로 고쳐야 한다 — 가이드를 고쳐도
  -- 진행 중인 런칭에는 안 닿는다(그것이 값 복사인 이유다).
  update launch_tasks
     set owner_role = '브랜드'
   where owner_role in ('브랜드MD', '브랜드기획', '브랜드디자인');
  get diagnostics t_owner = row_count;

  update launch_tasks
     set support_role = '브랜드'
   where support_role in ('브랜드MD', '브랜드기획', '브랜드디자인');
  get diagnostics t_support = row_count;

  raise notice '가이드 주관 %건 · 지원 %건 / 런칭 주관 %건 · 지원 %건',
    g_owner, g_support, t_owner, t_support;
end $$;

-- 확인용. 0건이 나와야 정상이다.
select '가이드' as 어디, owner_role, support_role, count(*)
  from launch_guide_items
 where owner_role in ('브랜드MD', '브랜드기획', '브랜드디자인')
    or support_role in ('브랜드MD', '브랜드기획', '브랜드디자인')
 group by 1, 2, 3
union all
select '런칭', owner_role, support_role, count(*)
  from launch_tasks
 where owner_role in ('브랜드MD', '브랜드기획', '브랜드디자인')
    or support_role in ('브랜드MD', '브랜드기획', '브랜드디자인')
 group by 1, 2, 3;
