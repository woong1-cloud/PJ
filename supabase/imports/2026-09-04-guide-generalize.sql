-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 가이드에서 HOKA 냄새를 뺀다 — 15건.
--
-- 가이드는 브랜드와 무관한 지식이다. 그런데 기준 파일이 HOKA 전용이라
-- 특정 벤더명과 "이미 정했다"는 문장이 그대로 들어왔다. 다음 브랜드가
-- 이걸 받으면 남의 회사 결정문을 읽게 된다.
--
-- 이름을 지우지 않고 괄호로 민다. 도구는 바뀌지만 그 일이 필요한 자리는
-- 안 바뀐다 — 다음 브랜드가 "이런 게 필요하구나"를 알면서 "우린 다른 걸
-- 쓸 수도 있겠네"를 함께 봐야 한다.
--
-- 유형(신규 법인 22건 · 양수도 6건)과 채널(무신사 12 · 네이버 11)은
-- 손대지 않는다. lib/launchKind.js 와 런칭 만들기 화면이 이미 걸러낸다.
--
-- 이미 만든 런칭에는 영향이 없다. 항목이 값 복사라서다 — 그것이 값 복사인
-- 이유이기도 하다.

-- 이 스크립트가 대상으로 삼는 가이드.
-- 가이드가 여럿이면 아래 where 절의 이름을 확인하고 실행한다.
do $$
declare
  g uuid;
begin
  select id into g from launch_guides order by created_at limit 1;
  if g is null then
    raise exception '가이드가 없습니다.';
  end if;

  -- ── 1) WMS ─────────────────────────────────────────────
  -- 이허브는 그룹 표준일 가능성이 높다. 지우지 않고 괄호로 민다.

  update launch_guide_items set
    title = '재고 원천 시스템 확정 — 자사몰·ERP는 수신 측이라는 전제 공유 및 영향 범위 정리 (그룹 표준: 이허브)',
    note  = '★ 시스템 선정이 아니라 전제 공유가 목적'
  where guide_id = g and code = '07B-01';

  update launch_guide_items set
    title = 'WMS ↔ ERP ↔ 자사몰 재고 동기화 방식·주기·기준 시점 확정 (그룹 표준: 이허브)'
  where guide_id = g and code = '07B-03';

  update launch_guide_items set
    title = 'WMS 도입 방식 결정 — 그룹 표준을 쓰면 적용 범위(창고·채널)만 확정 (그룹 표준: 이허브)',
    note  = '그룹 표준을 쓰면 시스템 선정 단계를 건너뛴다'
  where guide_id = g and code = '07B-04';

  update launch_guide_items set
    title = 'WMS 사용 계약·과금 기준 및 그룹 IT 통합 계약 포함 여부 확인 (그룹 표준: 이허브)'
  where guide_id = g and code = '07B-05';

  update launch_guide_items set
    title = 'WMS 에 법인 코드·창고·로케이션 마스터 생성 (그룹 표준: 이허브)'
  where guide_id = g and code = '07B-06';

  -- ── 2) 솔루션 3사 ──────────────────────────────────────
  -- 크리마(리뷰) · 브레이즈(CRM) · 에어브릿지(어트리뷰션).
  -- 역할로 부르고 현재 쓰는 도구를 괄호에 남긴다.

  update launch_guide_items set
    title = '리뷰·CRM·어트리뷰션 솔루션 계약 주체 확정 (요금제·트래픽 구간 산정) — 현재 크리마·브레이즈·에어브릿지',
    deliverable = '솔루션 계약서'
  where guide_id = g and code = '11-01';

  update launch_guide_items set
    title = '통합 이벤트 택소노미 정의서 작성 — 분석·CRM·어트리뷰션·리뷰 도구 단일 규격 (현재 GA4·Braze·Airbridge·크리마)'
  where guide_id = g and code = '11-05';

  update launch_guide_items set
    title = 'item_id 기준을 ERP SKU 와 일치 — 분석·CRM·리뷰·EP·광고 카탈로그가 동일 키 사용'
  where guide_id = g and code = '11-09';

  update launch_guide_items set
    title = '리뷰 솔루션 설치 및 상품 매핑 (SKU 키 기준) · 리뷰 위젯 노출 위치 확정 (현재 크리마)'
  where guide_id = g and code = '11-22';

  update launch_guide_items set
    title = '포토리뷰·리뷰 적립 정책 연동 (적립 지급 주체·금액 룰)'
  where guide_id = g and code = '11-23';

  update launch_guide_items set
    title = '구조화 데이터 마크업 (Product·Offer·AggregateRating) 및 리뷰 평점 연계'
  where guide_id = g and code = '12-16';

  -- ── 3) [확정] 떼기 ────────────────────────────────────
  -- HOKA 에서 확정이지 다음 브랜드에서는 확인할 사항이다.
  -- 확정문으로 두면 다음 사람이 검증을 건너뛴다.

  update launch_guide_items set
    title = '외부몰 주문과 자사 회원 데이터 연결 가능 여부 확인 — 불가 시 CRM·적립 대상은 자사몰·앱 회원 한정',
    note  = '★ 연결 불가가 일반적. 그 경우 외부몰 고객 대상 CRM 설계는 제외'
  where guide_id = g and code = '10B-01';

  -- ── 4) 브랜드 고유 기능 ───────────────────────────────
  -- 러닝은 스포츠 브랜드의 것이다. 다만 "커머스와 무관한 브랜드 고유
  -- 기능을 1차에 넣을 것인가"는 어느 브랜드에나 있다 — 매장 예약이든
  -- 커스터마이징이든. 그 질문을 남기고 예시로 민다.

  update launch_guide_items set
    title = '브랜드 고유 기능 1차 포함 여부 및 개발 공수 확정 (예: 러닝 기록·타임어택 등 커머스 외 기능)',
    note  = '★ 커머스와 무관한 별도 개발. 1차 포함 시 일정 재산정'
  where guide_id = g and code = '18-36';

  update launch_guide_items set
    title = '브랜드 고유 기능 데이터의 보관·파기 및 개인정보 처리방침 반영'
  where guide_id = g and code = '18-38';

  update launch_guide_items set
    title = '브랜드 주최 행사 참가 신청 기능 — 신청·결제·환불·개인정보 처리 절차 정의 (예: 러닝 대회)',
    note  = '시즌 기능. 1차 포함 여부 결정 필요'
  where guide_id = g and code = '18-39';

  raise notice '가이드 % 의 15건을 일반화했습니다.', g;
end $$;

-- 확인용. 아래를 함께 돌리면 남은 것이 보인다.
-- 0건이 나와야 정상이다.
select code, title
from launch_guide_items
where title ~ '크리마|브레이즈|에어브릿지|이허브|\[확정\]|러닝|타임어택'
   or coalesce(note, '') ~ '\[확정\]|러닝|타임어택'
order by code;
