// 요구사항 상태 단일 출처. '중복'은 병합 전용(직접 전환 불가).
//
// 이름은 "누구 차례인지"가 드러나게 지었다. '작성중'은 브랜드가 아직 제출하지
// 않은 초안이고, '검토대기'는 제출됐지만 IT가 아직 손대지 않은 상태다.
export const REQUIREMENT_STATUSES = [
  '작성중',
  '검토대기',
  '검토중',
  '개발중',
  'QA중',
  '승인대기',
  '완료',
  '반려',
  '취소',
  '중복',
];

// 보드 컬럼(왼쪽→오른쪽). 종결 상태(반려·취소·중복)는 컬럼이 아니다 —
// 드래그로 옮기는 것이 아니라 사유를 적고 종결하는 행동이기 때문이다.
export const BOARD_STATUSES = [
  '작성중',
  '검토대기',
  '검토중',
  '개발중',
  'QA중',
  '승인대기',
  '완료',
];

export const MERGED_STATUS = '중복';
export const DONE_STATUS = '완료';
// 반려는 IT가 "하지 않겠다"고 정한 것, 취소는 브랜드가 "필요 없어졌다"고
// 거둔 것이다. 반려율과 취소율은 처방이 정반대라 하나로 묶으면 안 된다.
export const REJECTED_STATUS = '반려';
export const CANCELLED_STATUS = '취소';
// 새 요구사항의 최초 상태. DB default 와 반드시 일치해야 한다(0007 마이그레이션).
export const INITIAL_STATUS = '작성중';
// 브랜드가 '검토 요청'을 눌렀을 때 도달하는 상태. 여기부터 IT 차례다.
//
// 상수로 뽑아 둔 이유: 이 값이 등록 라우트·제출 라우트·화면 세 곳에서 쓰인다.
// 문자열로 흘리면 한 곳에 오타가 나도 실행은 되고, DB CHECK 에 걸려 사용자
// 화면에서만 실패한다.
export const REVIEW_PENDING_STATUS = '검토대기';
// 개발이 끝나고 테스트가 도는 구간. 아직 개발팀이 들고 있다.
export const QA_STATUS = 'QA중';
// QA 가 끝나고 브랜드·본부의 최종 확인을 기다리는 구간. 여기부터 상대 차례다.
export const APPROVAL_PENDING_STATUS = '승인대기';

// 더 이상 진행되지 않는 상태. 목록에서 기본으로 숨기고, 지연 판정에서 제외하고,
// 정렬에서 뒤로 보낸다. 세 곳 모두에 적용해야 한다 — 하나만 빠뜨리면 에러가
// 아니라 "조용히 틀린 화면"이 된다.
export const CLOSED_STATUSES = [DONE_STATUS, REJECTED_STATUS, CANCELLED_STATUS, MERGED_STATUS];

// 드래그·Select 로 바로 갈 수 있는 상태.
//
// 완료가 빠져 있는 것이 핵심이다. 완료는 POST .../approve 로만 도달한다 —
// 누가 무엇을 확인했는지를 받지 않고 완료로 보낼 길이 하나라도 있으면 승인
// 절차 전체가 선택사항이 된다. 출발지가 승인대기든 개발중이든 마찬가지다.
export const DIRECT_STATUSES = BOARD_STATUSES.filter((s) => s !== DONE_STATUS);
