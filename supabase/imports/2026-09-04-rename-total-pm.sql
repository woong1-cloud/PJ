-- Supabase SQL Editor에 붙여넣어 실행한다.
-- 2026-09-04-dev-wbs-reconcile.sql 보다 **먼저** 돌린다.
--
-- 총PM → 개발PM
--
-- '총'이 무엇의 총괄인지가 화면에서 안 보인다. 브랜드PM 옆에 총PM 이
-- 놓이면 "브랜드PM 위에 있는 사람"으로 읽히는데, 실제로 이 역할이 맡은
-- 96건은 전부 개발 쪽 일이다:
--
--   06-xx 자사몰 요건정의·인프라 재사용 범위    07-xx ERP 연동 5개 흐름
--   07B-xx WMS 연동·재고 동기화                11-xx GA4·GTM·Airbridge·Braze
--   16-xx 앱 심사·딥링크·푸시                  18-xx 인프라·보안·관리자 권한
--
-- 위아래 관계가 아니라 옆의 다른 축이다. 브랜드PM 은 브랜드를 맡고
-- 개발PM 은 개발을 맡는다 — 그 말이 이름에 있어야 한다.
--
-- 가이드와 런칭을 함께 고친다. 항목은 값 복사라(0031_launch.sql 참고)
-- 가이드만 고치면 진행 중인 호카에는 안 닿는다.
--
-- 2026-09-04-merge-brand-roles.sql 과 같은 방식이다.

do $$
declare
  g_owner int; g_support int; t_owner int; t_support int;
begin
  -- 가이드 — 다음 브랜드부터 적용된다
  update launch_guide_items set owner_role = '개발PM' where owner_role = '총PM';
  get diagnostics g_owner = row_count;

  update launch_guide_items set support_role = '개발PM' where support_role = '총PM';
  get diagnostics g_support = row_count;

  -- 런칭 — 진행 중인 호카
  update launch_tasks set owner_role = '개발PM', updated_at = now()
   where owner_role = '총PM';
  get diagnostics t_owner = row_count;

  update launch_tasks set support_role = '개발PM', updated_at = now()
   where support_role = '총PM';
  get diagnostics t_support = row_count;

  raise notice '가이드 주관 %건 · 지원 %건 / 런칭 주관 %건 · 지원 %건',
    g_owner, g_support, t_owner, t_support;
  -- 기대값: 가이드 63 · 19 / 런칭 78 · 18
end $$;

-- 확인용. 0건이 나와야 정상이다.
select '가이드' as 어디, count(*) from launch_guide_items
 where owner_role = '총PM' or support_role = '총PM'
union all
select '런칭', count(*) from launch_tasks
 where owner_role = '총PM' or support_role = '총PM';

-- 바뀐 뒤의 역할 분포. 개발PM 이 주관 78 · 지원 18 로 잡혀야 한다.
select owner_role, count(*)
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
 group by 1
 order by 2 desc;
