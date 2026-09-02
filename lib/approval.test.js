import { describe, it, expect } from 'vitest';
import { canApprove } from './approval';

const ACTOR = { memberId: 'm1', tier: '3차', isGlobalAdmin: false };

describe('canApprove', () => {
  it('일반적인 경우 승인할 수 있다', () => {
    const r = { status: '승인대기', assignee: 'm2' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('승인대기가 아니어도 승인할 수 있다 — 완료로 가는 길은 하나뿐이다', () => {
    // 개발중에서 바로 완료로 끌 수 있다. 절차를 강제하지 않되 건너뛴 사실은
    // 상태 이력에 남는다.
    const r = { status: '개발중', assignee: 'm2' };
    expect(canApprove({ requirement: r, actor: ACTOR }).allowed).toBe(true);
  });

  it('이미 완료면 거절한다', () => {
    const r = { status: '완료', assignee: 'm2' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: false,
      reason: '이미 완료된 요구사항입니다.',
    });
  });

  it('종결된 건은 거절한다', () => {
    for (const status of ['반려', '취소', '중복']) {
      expect(canApprove({ requirement: { status, assignee: 'm2' }, actor: ACTOR })).toEqual({
        allowed: false,
        reason: '종결된 요구사항은 승인할 수 없습니다.',
      });
    }
  });

  it('담당자 본인도 승인할 수 있다', () => {
    // 예전에는 막았다. 운영 3주 데이터가 그 규칙이 절반만 작동한다고
    // 말했다 — 완료 12건 중 5건이 이미 담당자 손으로 끝났고, 전체
    // 관리자에게는 애초에 안 걸렸다. 점검은 주간회의의 '확인할 완료'로
    // 자리를 옮겼다(0030).
    const r = { status: '승인대기', assignee: 'm1' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('전체 관리자도 마찬가지다', () => {
    const r = { status: '승인대기', assignee: 'm1' };
    const admin = { memberId: 'm1', tier: '3차', isGlobalAdmin: true };
    expect(canApprove({ requirement: r, actor: admin }).allowed).toBe(true);
  });

  it('종결 판정은 그대로다 — 담당자를 허용한 것이 상태 검사를 푼 것은 아니다', () => {
    const r = { status: '반려', assignee: 'm1' };
    expect(canApprove({ requirement: r, actor: ACTOR }).allowed).toBe(false);
  });

  it('전체 관리자여도 이미 완료된 건은 거절한다', () => {
    // 상태 검사가 권한 검사보다 먼저다. 아니면 change_logs 에 완료 → 완료 가 쌓인다.
    const r = { status: '완료', assignee: 'm2' };
    const admin = { memberId: 'm9', tier: '1차', isGlobalAdmin: true };
    expect(canApprove({ requirement: r, actor: admin }).allowed).toBe(false);
  });

  it('담당자가 없는 건도 승인할 수 있다', () => {
    const r = { status: '승인대기', assignee: null };
    expect(canApprove({ requirement: r, actor: { memberId: undefined } }).allowed).toBe(true);
    expect(canApprove({ requirement: { status: '승인대기' }, actor: {} }).allowed).toBe(true);
  });

  it('입력이 없으면 거절한다', () => {
    expect(canApprove({ requirement: null, actor: ACTOR }).allowed).toBe(false);
    expect(canApprove({ requirement: { status: '승인대기' }, actor: null }).allowed).toBe(false);
    expect(canApprove({}).allowed).toBe(false);
    expect(canApprove().allowed).toBe(false);
  });
});
