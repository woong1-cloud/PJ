-- Supabase SQL Editor에 붙여넣어 실행한다. 호카 런칭 하나만 건드린다.
-- 2026-09-04-dev-wbs-reconcile.sql 다음에 돌린다.
--
-- 선행이 후행보다 늦은 19건을 정리한다.
--
-- 대조 스크립트가 만든 것이 아니라 원래 있던 자료의 흠이다. 한 줄씩
-- 제목을 읽어 보니 세 부류였다:
--
--   ① 방향이 거꾸로 걸림 7건 — 선행과 후행이 뒤바뀌어 있다
--   ② 인과가 아예 없음  4건 — 코드가 재배치되며 남은 흔적으로 보인다
--   ③ 방향은 맞고 날짜만 늦음 8건 — 미룬다 (연쇄 1건 포함)
--
-- 고치는 김에 고리 검사를 돌리다 하나 더 나왔다 — 07-33 이 자기 자신을
-- 선행으로 갖고 있다. 이 스크립트와 무관한 원래의 흠이다. [C] 참고.
--
-- ①②는 자료의 오류라 고치면 참이 된다. ③은 일정 판단이다 — 후행을
-- 뒤로 민다. 앞으로 당기는 것은 희망이고, 뒤로 미는 것은 사실을
-- 인정하는 것이다. 선행이 11/02에 끝나는데 후행을 10/03에 둘 수는 없다.
--
-- 실제 487건에 대고 미리 돌려 확인했다: 뒤집힘 19 → 0건, 오픈일을
-- 넘어간 항목 없음.

do $$
declare
  L uuid;
  n int;
begin
  select id into L from launches where name = '호카';
  if L is null then raise exception '호카 런칭을 못 찾았습니다.'; end if;

  --==========================================================================
  -- [A] 17-14 비상 대응 시나리오에 게이트를 잇는다
  --
  -- 대조 스크립트에서 'depends_on = {}' 조건 때문에 안 걸렸다 — 이미
  -- 07-23 이 있었다. 덮어쓰지 않으려던 조건이 의도대로 동작한 것이라
  -- 여기서 07-23 을 살린 채 19-09 를 더한다.
  --
  -- 롤백 시나리오는 최종 결함 검증(19-09, 12/27)이 끝나야 쓸 수 있다 —
  -- 무엇이 남은 결함인지 모르면 비상 대응을 못 짠다.
  --==========================================================================
  update launch_tasks
     set depends_on = array['07-23', '19-09'], updated_at = now()
   where launch_id = L and code = '17-14';
  raise notice '[A] 17-14 선행 = 07-23 + 19-09';

  --==========================================================================
  -- [C] 07-33 이 자기 자신을 기다린다
  --
  -- 고리 검사에서 나왔다. 자기를 선행으로 가지면 영영 완료가 안 되므로
  -- '착수 가능'에 절대 안 뜬다 — 그리고 07-34 · 07-35 가 07-33 을
  -- 기다리므로 셋이 함께 묶여 있었다.
  --
  -- 07-32 (그룹 IT 통합 계약 범위 확인, D-100) → 07-33 (그 계약을
  -- 솔루션·인프라에 활용 가능한지 검토, D-90) → 07-34 · 07-35 로
  -- 이어지는 줄이다. 코드를 적을 때 한 칸 밀린 것으로 보인다.
  --==========================================================================
  update launch_tasks
     set depends_on = array['07-32'], updated_at = now()
   where launch_id = L and code = '07-33';
  raise notice '[C] 07-33 자기 참조 → 07-32';

  --==========================================================================
  -- [B-①] 방향이 거꾸로 걸린 7건 — 관계를 반대로 돌린다
  --
  -- 선행에서 빼고, 상대 쪽 선행에 넣는다.
  --
  -- 넣을 때 array[...] 로 감싼다. depends_on || '18-34' 라고 쓰면
  -- 포스트그레스가 '18-34' 를 배열 리터럴로 읽어 22P02 로 죽는다
  -- (malformed array literal). text[] || text 가 아니라 text[] || text[] 다.
  --==========================================================================

  -- 18-34 [갭] EP 송출 기능이 요구사항에 없음  ↔  12-02 EP 생성 규격 확정
  --   범위에 넣을지 정해야 규격을 만든다. 갭 지적이 규격을 기다릴 수 없다.
  update launch_tasks set depends_on = array_remove(depends_on, '12-02'), updated_at = now()
   where launch_id = L and code = '18-34';
  update launch_tasks set depends_on = depends_on || array['18-34'], updated_at = now()
   where launch_id = L and code = '12-02' and not ('18-34' = any(depends_on));

  -- 18-35 앱 심사 소요를 일정에 반영  ↔  16-05 앱 심사 제출
  --   일정을 잡고 나서 제출한다.
  update launch_tasks set depends_on = array_remove(depends_on, '16-05'), updated_at = now()
   where launch_id = L and code = '18-35';
  update launch_tasks set depends_on = depends_on || array['18-35'], updated_at = now()
   where launch_id = L and code = '16-05' and not ('18-35' = any(depends_on));

  -- 16-06 스토어 등록정보(ASO) 준비  ↔  16-05 앱 심사 제출
  --   앱명·설명·스크린샷이 있어야 제출한다.
  update launch_tasks set depends_on = array_remove(depends_on, '16-05'), updated_at = now()
   where launch_id = L and code = '16-06';
  update launch_tasks set depends_on = depends_on || array['16-06'], updated_at = now()
   where launch_id = L and code = '16-05' and not ('16-06' = any(depends_on));

  -- 16-18 실기기 테스트 매트릭스  ↔  16-05 앱 심사 제출
  --   테스트하고 나서 제출한다.
  update launch_tasks set depends_on = array_remove(depends_on, '16-05'), updated_at = now()
   where launch_id = L and code = '16-18';
  update launch_tasks set depends_on = depends_on || array['16-18'], updated_at = now()
   where launch_id = L and code = '16-05' and not ('16-18' = any(depends_on));

  -- 08-01 물류 운영 방식 결정 (그룹 vs 3PL)  ↔  01-10 물류 위탁 계약
  --   방식을 정해야 계약한다.
  update launch_tasks set depends_on = array_remove(depends_on, '01-10'), updated_at = now()
   where launch_id = L and code = '08-01';
  update launch_tasks set depends_on = depends_on || array['08-01'], updated_at = now()
   where launch_id = L and code = '01-10' and not ('08-01' = any(depends_on));

  -- 18-26 재무 담당자 초기 배치  ↔  18-25 코스트센터 확정
  --   담당자가 있어야 코스트센터를 정한다.
  update launch_tasks set depends_on = array_remove(depends_on, '18-25'), updated_at = now()
   where launch_id = L and code = '18-26';
  update launch_tasks set depends_on = depends_on || array['18-26'], updated_at = now()
   where launch_id = L and code = '18-25' and not ('18-26' = any(depends_on));

  -- 18-45 결제 수단 범위 확정·PG사 선정  ↔  01-20 PG·간편결제 신규 계약
  --   선정하고 나서 계약한다.
  update launch_tasks set depends_on = array_remove(depends_on, '01-20'), updated_at = now()
   where launch_id = L and code = '18-45';
  update launch_tasks set depends_on = depends_on || array['18-45'], updated_at = now()
   where launch_id = L and code = '01-20' and not ('18-45' = any(depends_on));

  raise notice '[B-1] 방향 7건 되돌림';

  --==========================================================================
  -- [B-②] 인과가 없는 선행 4건 — 뺀다
  --
  -- 코드가 재배치되며 남은 흔적으로 보인다. 도메인·SSL 이 광고 계정
  -- 개설을 기다릴 이유가 없고, 정산 계좌가 CRM 계약을 기다릴 이유도 없다.
  --==========================================================================
  update launch_tasks set depends_on = array_remove(depends_on, '01-25'), updated_at = now()
   where launch_id = L and code = '03-09';    -- 도메인·SSL ← 광고 계정 개설
  update launch_tasks set depends_on = array_remove(depends_on, '01-17'), updated_at = now()
   where launch_id = L and code = '01-19';    -- 정산 계좌 ← CRM 솔루션 계약
  update launch_tasks set depends_on = array_remove(depends_on, '11-01'), updated_at = now()
   where launch_id = L and code = '18-33';    -- [갭] 지적 ← 솔루션 계약 주체
  update launch_tasks set depends_on = array_remove(depends_on, '01-10'), updated_at = now()
   where launch_id = L and code = '07B-04';   -- [확정] WMS 이허브 ← 물류 위탁 계약
  raise notice '[B-2] 인과 없는 선행 4건 제거';

  --==========================================================================
  -- [B-③] 방향은 맞고 날짜만 늦은 8건 — 선행 + 5일로 민다
  --
  -- 06-18 은 연쇄다 — 06-16 을 미니 그 후행도 밀린다.
  --
  --   코드     현재            새 기한         이유
  --   06-15    D-90  10/03  →  D-55  11/07   상표권 이전등록(02-03) 11/02
  --   18-07    D-100 09/23  →  D-75  10/18   회원체계 결정(01-13) 10/13
  --   06-16    D-75  10/18  →  D-55  11/07   상표권 이전등록(02-03) 11/02
  --   06-18    D-60  11/02  →  D-50  11/12   ↑ 06-16 연쇄
  --   03-03    D-70  10/23  →  D-55  11/07   카드사 가맹 심사(01-21) 11/02
  --   08-08    D-35  11/27  →  D-20  12/12   송장 역전송 확인(07-16) 12/07
  --   08-14    D-30  12/02  →  D-20  12/12   재출고 로직 검증(07-19) 12/07
  --   10A-06   D-35  11/27  →  D-25  12/07   앱 전용 혜택 설계(16-15) 12/02
  --   18-15    D-85  10/08  →  D-75  10/18   택소노미 정의서(11-05) 10/13
  --==========================================================================
  update launch_tasks set day_offset = -55, updated_at = now()
   where launch_id = L and code in ('06-15', '06-16', '03-03');
  update launch_tasks set day_offset = -75, updated_at = now()
   where launch_id = L and code in ('18-07', '18-15');
  update launch_tasks set day_offset = -50, updated_at = now()
   where launch_id = L and code = '06-18';
  update launch_tasks set day_offset = -20, updated_at = now()
   where launch_id = L and code in ('08-08', '08-14');
  update launch_tasks set day_offset = -25, updated_at = now()
   where launch_id = L and code = '10A-06';
  get diagnostics n = row_count;
  raise notice '[B-3] 기한 9건 미룸';

  --==========================================================================
  -- [D] D20_개발구축의 주관을 개발PM 으로
  --
  -- 워크스트림이 '개발구축'인데 주관이 브랜드PM · 온라인BU 서비스기획으로
  -- 흩어져 있었다. 처음에 '브랜드가 승인하는 게이트'로 보고 그렇게 적었는데,
  -- 이 줄을 끌고 가는 사람은 개발PM 이다 — 일정을 대는 것도, 산출물을
  -- 받아 오는 것도 그쪽이다.
  --
  -- 지원 역할에는 '이 자리에 누가 더 있어야 하나'를 남긴다. 브랜드가
  -- 승인해야 하는 건은 지원에 브랜드PM · 브랜드를 두어 그 사실이 사라지지
  -- 않게 한다.
  --==========================================================================
  update launch_tasks set owner_role = '개발PM', updated_at = now()
   where launch_id = L and workstream = 'D20_개발구축';
  get diagnostics n = row_count;

  update launch_tasks set support_role = case code
      when '19-01' then '브랜드PM'          -- 요구사항정의서를 승인하는 것은 브랜드다
      when '19-02' then '브랜드PM'
      when '19-03' then '브랜드'            -- 디자인 최종 승인
      when '19-04' then '온라인BU 서비스기획'
      when '19-05' then '온라인BU 서비스기획'
      when '19-06' then 'CAIO실'
      when '19-07' then '전체'
      when '19-08' then '전체'
      when '19-09' then '브랜드PM'          -- Go-Live 판단
      when '19-10' then '전체'
      when '19-11' then '브랜드PM'          -- 오픈 승인
      else support_role end,
      updated_at = now()
   where launch_id = L and workstream = 'D20_개발구축';
  raise notice '[D] D20 주관 %건 → 개발PM', n;

  --==========================================================================
  -- [E] 중복 하나 — 18-23 간편결제 계약 방향 확정
  --
  -- 결제 계약 하나를 네 항목이 나눠 갖고 있었다:
  --
  --   18-45  결제 수단 범위 확정·PG사 선정      D-75  법무팀
  --   18-23  간편결제 계약 방향 확정            D-70  브랜드PM   ← 겹침
  --   01-20  PG·간편결제 신규 계약              D-70  브랜드PM
  --   03-07  간편결제 계약 (네이버페이·카카오페이·토스) D-55  재무팀
  --
  -- 18-23 의 '방향 확정'은 18-45 의 '범위 확정·선정'이 이미 하는 일이고,
  -- '기본 결제사 + 네이버페이 별도 계약'이라는 내용은 01-20 · 03-07 이
  -- 실제로 체결한다. 가운데 한 칸이 남은 것이다.
  --
  -- 지우지 않고 해당없음으로 둔다 — [1]의 중복 처리와 같은 규칙이다.
  --==========================================================================
  update launch_tasks
     set depends_on = array_replace(depends_on, '18-23', '18-45'), updated_at = now()
   where launch_id = L and '18-23' = any(depends_on);

  update launch_tasks
     set status = '해당없음',
         excluded_reason = '중복 — 18-45 결제 수단 범위 확정·PG사 선정에 흡수 '
                           '(계약 체결은 01-20 · 03-07)',
         excluded_at = now(), updated_at = now()
   where launch_id = L and code = '18-23' and status = '할 것';
  get diagnostics n = row_count;
  raise notice '[E] 18-23 중복 %건 해당없음', n;

  --==========================================================================
  -- [F] 겹치는 자리를 지우는 대신 잇는다
  --
  -- 06-13 QA·UAT 시나리오 작성 및 수행 (D-25, 12/07) 이 19-07 1차
  -- 통합테스트 (D-21, 12/11) 기간 안에 통째로 들어 있었다. 같은 활동을
  -- 두 줄로 적은 것에 가깝지만, 시나리오를 만드는 일과 테스트에 참여해
  -- 결함을 등록하는 일은 실제로 다르다 — 지우지 않고 순서를 준다.
  --==========================================================================
  update launch_tasks
     set depends_on = depends_on || array['06-13'], updated_at = now()
   where launch_id = L and code = '19-07' and not ('06-13' = any(depends_on));
  raise notice '[F] 19-07 선행에 06-13 추가';
end $$;

-- ---------------------------------------------------------------------------
-- 확인용
-- ---------------------------------------------------------------------------

-- 1) 선행이 후행보다 늦은 것 — 이제 0건이 나와야 한다
select t.code as 후행, t.day_offset as 후행D, p.code as 선행, p.day_offset as 선행D
  from launch_tasks t
  cross join lateral unnest(t.depends_on) as dep(code)
  join launch_tasks p
    on p.launch_id = t.launch_id and p.code = dep.code
 where t.launch_id = (select id from launches where name = '호카')
   and t.status <> '해당없음' and p.status <> '해당없음'
   and p.day_offset > t.day_offset
 order by p.day_offset - t.day_offset desc;

-- 2) 자기 자신을 선행으로 가진 항목 — 0건이 나와야 한다
select code, depends_on, title
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
   and code = any(depends_on);

-- 3) 끊긴 선행 — 0건이 나와야 한다
select t.code, dep.code as 없는_선행
  from launch_tasks t
  cross join lateral unnest(t.depends_on) as dep(code)
 where t.launch_id = (select id from launches where name = '호카')
   and not exists (
     select 1 from launch_tasks x
      where x.launch_id = t.launch_id and x.code = dep.code);

-- 4) 방향을 되돌린 7쌍 확인
select code, day_offset, depends_on, title
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
   and code in ('18-34','12-02','18-35','16-05','16-06','16-18',
                '08-01','01-10','18-26','18-25','18-45','01-20','17-14','07-33')
 order by code;

-- 5) D20 주관·지원 확인 — 주관이 전부 개발PM 이어야 한다
select code, owner_role, support_role, day_offset, title
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
   and workstream = 'D20_개발구축'
 order by code;

-- 6) 미룬 9건 확인
select code, day_offset, (date '2027-01-01' + day_offset) as 기한, depends_on, title
  from launch_tasks
 where launch_id = (select id from launches where name = '호카')
   and code in ('06-15','06-16','06-18','03-03','08-08','08-14','10A-06','18-07','18-15')
 order by day_offset;
