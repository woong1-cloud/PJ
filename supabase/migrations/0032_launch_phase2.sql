-- Supabase SQL Editor에 붙여넣어 실행한다.
--
-- 런칭 2단계 — 흔들리는 목록.
--
-- 1단계는 "403건을 한 번 넣고 쓴다"를 전제로 만들었다. 그 전제가 틀렸다.
-- 목록은 매주 흔들린다 — 항목이 더해지고 빠진다. 이 마이그레이션이 그것을
-- 다룰 자리를 만든다.
--
-- 2-0 · 2-1 이 쓸 것을 한 번에 만든다. 세 번 나눠 돌리면 어느 컬럼이 어느
-- 배포에 속하는지 사람이 추적해야 한다.

-- 1) 해당없음.
--
-- 별도 boolean 을 두지 않는다. 시트가 이미 '상태' 열에 '해당없음' 을 쓰고
-- 있어서(476건 중 25건), 같은 말을 두 축으로 나누면 "완료면서 해당없음"이
-- 만들어지고 그때 진척률이 무슨 뜻인지 아무도 모른다.
alter table launch_tasks drop constraint if exists launch_tasks_status_check;
alter table launch_tasks add constraint launch_tasks_status_check
  check (status in ('할 것', '하는 중', '완료', '막힘', '해당없음'));

-- 2) 어디서 왔나 / 왜 뺐나.
--
-- source 가 'manual' 인 항목은 재가져오기가 안 건드린다. 시트 밖에서 난
-- 일이라 시트에 없는 게 당연하다. 그리고 이 값이 있어야 나중에 "HOKA 에서
-- 새로 생긴 것"을 뽑아 가이드로 되돌릴 수 있다(4단계 되먹임).
-- 지금 안 저장하면 그 목록 자체가 영영 없다.
alter table launch_tasks add column if not exists source text not null default 'guide';
alter table launch_tasks drop constraint if exists launch_tasks_source_check;
alter table launch_tasks add constraint launch_tasks_source_check
  check (source in ('guide', 'import', 'manual'));

-- 사유는 화면에서 필수다. DB 에서 not null 로 막지 않는 이유는 이미 들어간
-- 행이 있고, 상태가 '해당없음' 일 때만 뜻이 있기 때문이다.
--
-- 가져오기가 뺀 것은 사유가 '양식에서 빠짐 (직전 상태: …)' 으로 시작한다.
-- 사람이 뺀 것은 사람이 쓴 문장이다. 그 차이로 되살릴지를 가른다 —
-- 컬럼을 따로 두지 않는 이유다. 사유는 어차피 사람이 읽는 것이고, 거기
-- 적혀 있는 것이 가장 정직하다.
alter table launch_tasks add column if not exists excluded_reason text;
alter table launch_tasks add column if not exists excluded_at timestamptz;
alter table launch_tasks add column if not exists excluded_by uuid references team_members(id);

-- 3) 지식.
--
-- context: 00_개요 의 [제반사항] 7줄. 451건이 왜 그렇게 생겼는지의 답이다.
--   구축 방식 — 자체 구축 차세대 플랫폼 기반
--   개발 주체 — 내부 개발이 아닌 외주 개발
--   재고 — WMS(이허브) 확정. 운영 방식은 미결
-- 반년 뒤에 "왜 회원 연동을 안 했지"를 여기서 읽는다.
--
-- jsonb 인 이유는 항목 이름이 브랜드마다 달라서다 — 컬럼으로 박으면 다음
-- 브랜드에서 '가맹 여부' 가 생겼을 때 마이그레이션을 해야 한다.
alter table launches add column if not exists context jsonb not null default '[]';

-- plain_text: 01_WBS 의 '쉬운 설명' 같은 문장.
--   "법인 설립 및 사업자·통신판매업 신고"
--   → "새 회사를 세우고 온라인으로 물건을 팔 수 있는 허가를 받는 일"
--
-- 451건을 다 채우라는 게 아니다. 비어 있어도 된다. 브랜드가 "이게 뭔 소리야"
-- 하고 물으면 그때 한 줄 채우고, 다음 브랜드는 채워진 것을 받는다.
-- 이것이 지식이 자라는 루프다.
alter table launch_guide_items add column if not exists plain_text text;
alter table launch_tasks       add column if not exists plain_text text;

-- 4) 결정 대기 (2-1 에서 쓴다).
--
-- RAID 로그의 D(Decisions) 다. 새로 만든 개념이 아니라 프로젝트 관리의 표준
-- 개념이고, 그 표준이 "별도 스프레드시트에 두지 말고 시스템에 통합하라"고
-- 말한다 — 지금 00_개요 시트에 있는 것이 정확히 그 문제다.
--
-- 476건 중 회의에서 실제로 다투는 것은 이 14건이고 나머지는 그 결과다.
create table if not exists launch_decisions (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references launches(id) on delete cascade,
  -- 시트 순서. 사람이 시기 순으로 적어 두었으니 그대로 쓴다.
  seq integer not null,
  -- '9월 중'. 날짜로 바꾸지 않는다 — 2026-09-15 로 바꾸면 없는 정확도를
  -- 만들고, 그 날짜가 지나면 화면이 붉어진다. 있지도 않은 약속을 어겼다고.
  when_text text,
  title text not null,
  -- 미결 시 영향. 3단계 협조요청 메일에 그대로 담긴다 — 왜 지금 답해야
  -- 하는지를 그 한 줄이 말한다. 이미 사람이 써 두었다.
  impact text,
  owner_text text,
  status text not null default '대기'
    check (status in ('대기', '결정', '보류')),
  decided_at timestamptz,
  -- 무엇으로 정했나 한 줄. 이것이 나중에 회의록이 된다.
  decided_note text,
  decided_by uuid references team_members(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (launch_id, seq)
);

create index if not exists launch_decisions_launch_idx
  on launch_decisions (launch_id, seq);

-- 5) 막힘 → 결정 (2-1 에서 쓴다).
--
-- "A dependency is not a note. It blocks specific tasks."
--
-- blocked_reason 에 "재고 운영 방식 미결"이라고 써 봐야 그건 글자일 뿐이고,
-- 결정 대기의 그 줄과 아무 연결이 없다. 결정이 내려져도 막힌 항목은 안
-- 풀리고, 사람이 기억해서 찾아가야 한다.
--
-- launch_decisions 를 참조하므로 반드시 그 테이블 다음에 온다.
alter table launch_tasks add column if not exists blocked_decision_id uuid
  references launch_decisions(id) on delete set null;

comment on column launch_tasks.excluded_reason is
  '해당없음 사유. 가져오기가 뺀 것은 ''양식에서 빠짐'' 으로 시작한다.';
comment on column launch_tasks.source is
  'guide=가이드 복제 · import=엑셀 · manual=손으로. manual 은 재가져오기가 안 건드린다.';
comment on column launches.context is
  '프로젝트 전제. 00_개요 의 [제반사항]. [{label, value}]';
comment on column launch_tasks.plain_text is
  '처음 하는 사람을 위한 한 줄. 비어 있어도 된다.';
comment on table launch_decisions is
  '결정 대기. RAID 로그의 D. 미결이 막힌 항목의 원인인 경우가 많다.';
