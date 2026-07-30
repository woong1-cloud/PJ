import { describe, it, expect } from 'vitest';
import { REQUIREMENT_STATUSES } from './statuses';
import { STATUS_META, STATUS_GUIDE, statusStyle, DEFAULT_STATUS_STYLE } from './statusMeta';

describe('STATUS_META', () => {
  // 이 테스트가 존재하는 이유: statusStyle 은 모르는 상태에 대해 예외 대신
  // 기본 회색을 돌려준다. 상태를 추가하고 여기를 빼먹으면 화면에서는
  // "뱃지가 회색이네" 정도로만 보여서 리뷰를 통과해버린다.
  it('모든 상태에 표현이 정의되어 있다', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(STATUS_META[status], `${status}에 STATUS_META 항목이 없다`).toBeDefined();
    }
  });

  it('모든 상태에 style, meaning, next 가 채워져 있다', () => {
    for (const status of REQUIREMENT_STATUSES) {
      const meta = STATUS_META[status];
      expect(meta.style, `${status}.style`).toBeTruthy();
      expect(meta.meaning, `${status}.meaning`).toBeTruthy();
      expect(meta.next, `${status}.next`).toBeTruthy();
    }
  });

  it('정의된 상태 외에 남는 항목이 없다', () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...REQUIREMENT_STATUSES].sort());
  });

  // 이 테스트가 존재하는 이유: Badge 컴포넌트의 기본 클래스에 bg-primary(거의
  // 검정)가 들어 있다. 배경을 명시하지 않으면 그게 살아남아 검은 배경에 회색
  // 글씨가 되고, 렌더링해보기 전에는 아무도 모른다. 실제로 그렇게 나왔었다.
  it('모든 상태가 배경색을 명시한다 — Badge 기본 bg-primary 를 덮어써야 한다', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(STATUS_META[status].style, `${status} 에 bg- 클래스가 없다`).toMatch(/\bbg-/);
    }
  });

  it('검토대기만 앰버다 — 목록에서 튀어야 하는 유일한 상태', () => {
    const amber = REQUIREMENT_STATUSES.filter((s) => STATUS_META[s].style.includes('amber'));
    expect(amber).toEqual(['검토대기']);
  });
});

describe('statusStyle', () => {
  it('알려진 상태는 자기 스타일을 돌려준다', () => {
    expect(statusStyle('완료')).toBe(STATUS_META['완료'].style);
  });

  it('모르는 상태는 기본 스타일로 떨어진다', () => {
    expect(statusStyle('없는상태')).toBe(DEFAULT_STATUS_STYLE);
  });
});

describe('STATUS_GUIDE', () => {
  it('REQUIREMENT_STATUSES 순서를 그대로 따른다', () => {
    expect(STATUS_GUIDE.map((r) => r.status)).toEqual(REQUIREMENT_STATUSES);
  });
});
