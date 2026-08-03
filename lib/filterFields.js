import { CHANNELS } from './channels';
import { REQUIREMENT_STATUSES } from './statuses';
import { REQUIREMENT_TYPES } from './requirementTypes';

const PRIORITIES = ['상', '중', '하'];

// 데스크톱 필터바에서 접지 않고 늘 보이는 둘.
// 나머지는 '필터 더보기' 뒤에 있고, 모바일에서는 일곱 개 전부가 시트 안에 있다.
export const PRIMARY_FILTER_KEYS = ['status', 'type'];

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
// 조회로 받는 목록(담당자·카테고리·프로젝트)은 아직 안 왔을 수 있으므로 빈
// 배열이 기본이다. 여기서 터지면 화면 전체가 안 뜬다.
export function buildFilterFields({ teamMembers = [], categories = [], projects = [] } = {}) {
  return [
    { key: 'status', label: '상태', options: asOptions(REQUIREMENT_STATUSES) },
    { key: 'type', label: '유형', options: asOptions(REQUIREMENT_TYPES) },
    {
      key: 'assignee',
      label: '담당자',
      options: teamMembers.map((m) => ({ value: m.id, label: m.name })),
    },
    {
      key: 'category',
      label: '카테고리',
      options: categories.map((c) => ({ value: c.id, label: c.category_name })),
    },
    { key: 'channel', label: '채널', options: asOptions(CHANNELS) },
    { key: 'priority', label: '우선순위', options: asOptions(PRIORITIES) },
    {
      key: 'project',
      label: '프로젝트',
      options: projects.map((p) => ({ value: p.id, label: p.name })),
    },
  ];
}
