import { describe, expect, it } from 'vitest';
import { menuTransitions } from './statusActions';

const it3 = { tier: '3차', memberId: 'm1' };
const it2 = { tier: '2차', memberId: 'm2' };
const requester = { tier: '4차', memberId: 'm3' };
const admin = { tier: '4차', memberId: 'm4', isGlobalAdmin: true };

describe('menuTransitions', () => {
  it('주 버튼의 목적지는 메뉴에 없다 — 같은 것이 두 곳에 있으면 안 된다', () => {
    const got = menuTransitions({ status: '검토대기', identity: it3 });
    expect(got).not.toContain('검토중');
    expect(got).toContain('개발중');
  });

  it('지금 상태는 메뉴에 없다', () => {
    expect(menuTransitions({ status: '검토중', identity: it3 })).not.toContain('검토중');
  });

  it('완료는 어떤 상태에서도 메뉴에 없다 — 서버가 거부한다', () => {
    for (const status of ['작성중', '검토대기', '검토중', '개발중', 'QA중', '승인대기']) {
      expect(menuTransitions({ status, identity: it3 }), status).not.toContain('완료');
    }
  });

  it('건너뛰기가 열려 있다 — 검토대기에서 QA중으로', () => {
    expect(menuTransitions({ status: '검토대기', identity: it3 })).toContain('QA중');
  });

  it('되돌리기가 열려 있다 — 검토중에서 검토대기로', () => {
    expect(menuTransitions({ status: '검토중', identity: it3 })).toContain('검토대기');
  });

  it('종결 상태에서는 비어 있다 — 재개 창이 그 일을 한다', () => {
    for (const status of ['완료', '반려', '취소', '중복']) {
      expect(menuTransitions({ status, identity: it3 }), status).toEqual([]);
    }
  });

  it('4차에게는 비어 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: requester })).toEqual([]);
  });

  it('전체 관리자는 등급과 무관하게 볼 수 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: admin }).length).toBeGreaterThan(0);
  });

  it('2차도 볼 수 있다', () => {
    expect(menuTransitions({ status: '검토대기', identity: it2 }).length).toBeGreaterThan(0);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(menuTransitions()).toEqual([]);
    expect(menuTransitions({ status: null, identity: it3 })).toEqual([]);
  });
});
