import { describe, it, expect } from 'vitest';
import {
  REQUIREMENT_STATUSES,
  BOARD_STATUSES,
  CLOSED_STATUSES,
  MERGED_STATUS,
  DONE_STATUS,
  REJECTED_STATUS,
  CANCELLED_STATUS,
  INITIAL_STATUS,
} from './statuses';

describe('BOARD_STATUSES', () => {
  // 이 테스트가 존재하는 이유: KanbanBoard 는 컬럼이 없는 상태의 카드를 조용히
  // 버린다. 그건 종결 상태에 대해서는 의도한 동작이지만, 반대로 종결 상태를
  // 실수로 BOARD_STATUSES 에 넣으면 아무 에러 없이 보드 칸만 늘어난다.
  // 6칸을 5칸으로 줄인 작업이 그렇게 되돌아가는 것을 막는다.
  //
  // 7칸이 된 것은 QA중·승인대기를 의도적으로 더했기 때문이다(v1.4). 둘 다
  // 종결 상태가 아니라서 이 테스트가 지키려던 것과 충돌하지 않는다 — 아래
  // '종결 상태 중 보드 컬럼은 완료뿐이다' 가 그 규칙을 계속 지킨다.
  it('보드는 7칸이다', () => {
    expect(BOARD_STATUSES).toEqual([
      '작성중',
      '검토대기',
      '검토중',
      '개발중',
      'QA중',
      '승인대기',
      '완료',
    ]);
  });

  it('종결 상태 중 보드 컬럼은 완료뿐이다', () => {
    const closedOnBoard = CLOSED_STATUSES.filter((s) => BOARD_STATUSES.includes(s));
    expect(closedOnBoard).toEqual([DONE_STATUS]);
  });

  it('보드 컬럼은 전부 유효한 요구사항 상태다', () => {
    for (const s of BOARD_STATUSES) expect(REQUIREMENT_STATUSES).toContain(s);
  });

  it('최초 상태는 보드의 첫 칸이다', () => {
    expect(BOARD_STATUSES[0]).toBe(INITIAL_STATUS);
  });
});

describe('CLOSED_STATUSES', () => {
  it('완료·반려·취소·중복 네 가지다', () => {
    expect(CLOSED_STATUSES).toEqual([DONE_STATUS, REJECTED_STATUS, CANCELLED_STATUS, MERGED_STATUS]);
  });

  it('전부 유효한 요구사항 상태다', () => {
    for (const s of CLOSED_STATUSES) expect(REQUIREMENT_STATUSES).toContain(s);
  });
});
