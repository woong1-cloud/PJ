import { CHANNELS } from './channels';
import { REQUIREMENT_STATUSES } from './statuses';
import { REQUIREMENT_TYPES } from './requirementTypes';

const PRIORITIES = ['상', '중', '하'];

// 셀렉트에서 "고른 값을 되돌리기"에 쓰는 값.
//
// 빈 문자열을 SelectItem 값으로 쓸 수 없다 — base-ui 가 그것을 "선택 안 됨"
// 과 구분하지 못해서 항목이 늘 선택된 것처럼 보인다. 상세 화면의 유형
// 셀렉트가 같은 이유로 '__none__' 을 쓰고 있고, 여기도 같은 방식이다.
export const CLEAR_FILTER_VALUE = '__all__';

const asOptions = (values) => values.map((v) => ({ value: v, label: v }));

// 필터 일곱 종의 정의를 한 곳에 둔다.
//
// 필터바(데스크톱)와 필터 시트(모바일)가 같은 배열을 읽는다. 양쪽에 셀렉트를
// 복제해 두면 필터를 하나 늘릴 때 한쪽만 고치는 사고가 난다 — 이 프로젝트에서
// 이미 겪었다(유형을 목록·보드에 넣고 상세를 빠뜨렸다).
//
// 배열 순서가 곧 화면 순서다. lib/requirementFilters.js 의 FILTER_KEYS 와 같은
// 집합이어야 하며, 그것을 테스트가 지킨다.
//
// 순서는 실사용 데이터로 정했다(2026-08 기준 33건). 앞쪽일수록 실제로 값이 갈린다:
//   카테고리  9종 (UI/UX 7 · 전시 7 · 프로모션 6 · 데이터 3 · 배송 3 ...)
//   프로젝트  5종 (유지보수 13 · 없음 12 · 프로모션 고도화 5 ...)
//   유형      4종 (개선 20 · 신규 9 · 문의 1 · 오류 1)
//   담당자        (33건 중 29건이 미지정 — 이 축은 빠른 필터 칩이 맡는다)
//   채널      2종 (자사몰 30 · 외부몰 3 — 걸러도 거의 안 줄어든다)
//   우선순위  3종 (중 14 · 없음 11 · 상 6 · 하 2)
//
// 상태를 맨 앞에 두는 건 분산 때문이 아니다. 기본 화면(종결 숨김)에서는
// 검토대기가 25/28 이라 사실상 안 좁혀진다. 사람이 목록을 볼 때 가장 먼저
// 떠올리는 축이라 첫 칸에 있어야 찾지 않는다.
//
// 조회로 받는 목록(담당자·카테고리·프로젝트)은 아직 안 왔을 수 있으므로 빈
// 배열이 기본이다. 여기서 터지면 화면 전체가 안 뜬다.
export function buildFilterFields({ teamMembers = [], categories = [], projects = [] } = {}) {
  return [
    { key: 'status', label: '상태', options: asOptions(REQUIREMENT_STATUSES) },
    {
      key: 'category',
      label: '카테고리',
      options: categories.map((c) => ({ value: c.id, label: c.category_name })),
    },
    {
      key: 'project',
      label: '프로젝트',
      options: projects.map((p) => ({ value: p.id, label: p.name })),
    },
    { key: 'type', label: '유형', options: asOptions(REQUIREMENT_TYPES) },
    {
      key: 'assignee',
      label: '담당자',
      options: teamMembers.map((m) => ({ value: m.id, label: m.name })),
    },
    { key: 'channel', label: '채널', options: asOptions(CHANNELS) },
    { key: 'priority', label: '우선순위', options: asOptions(PRIORITIES) },
  ];
}

// 지금 걸려 있는 필터를 칩으로 그리기 위한 목록.
//
// 필요한 이유: '필터 더보기 (2)' 는 몇 개인지만 알려주고 무엇인지는 알려주지
// 않는다. 담당자를 잘못 골라 놓고 접었다면 펼쳐서 셀렉트 넷을 훑어야 범인을
// 찾는다. 칩은 접힌 것까지 이름과 값으로 드러내고, 하나씩 뗄 수 있게 한다.
//
// valueLabel 이 null 이면 화면은 이름만 그린다. 담당자·카테고리·프로젝트는
// 값이 uuid 라서 옵션 목록이 도착하기 전에는 사람이 읽을 이름이 없다. 그때
// uuid 를 그대로 띄우면 뭔지 모를 뿐 아니라 칩이 줄을 통째로 먹는다.
export function activeFilterChips({
  fields = [],
  filters = {},
  mine = false,
  includeDone = false,
} = {}) {
  const chips = fields
    .filter((f) => filters[f.key])
    .map((f) => ({
      key: f.key,
      label: f.label,
      valueLabel: f.options.find((o) => o.value === filters[f.key])?.label ?? null,
    }));

  // 이 둘은 셀렉트가 아니라 체크박스라 fields 에 없다. 그래도 결과를 좁히는
  // 것은 같으므로 칩에는 나와야 한다 — 특히 모바일에서는 시트 안에 있어
  // 켜져 있는지 밖에서 보이지 않는다.
  if (mine) chips.push({ key: 'mine', label: '내 요청만', valueLabel: null });
  if (includeDone) chips.push({ key: 'includeDone', label: '종결 포함', valueLabel: null });
  return chips;
}
