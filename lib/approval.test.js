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

  it('담당자 본인은 거절한다', () => {
    const r = { status: '승인대기', assignee: 'm1' };
    expect(canApprove({ requirement: r, actor: ACTOR })).toEqual({
      allowed: false,
      reason: '담당자 본인은 승인할 수 없습니다.',
    });
  });

  it('전체 관리자는 담당자여도 승인할 수 있다', () => {
    const r = { status: '승인대기', assignee: 'm1' };
    const admin = { memberId: 'm1', tier: '3차', isGlobalAdmin: true };
    expect(canApprove({ requirement: r, actor: admin }).allowed).toBe(true);
  });

  it('전체 관리자여도 이미 완료된 건은 거절한다', () => {
    // 상태 검사가 권한 검사보다 먼저다. 아니면 change_logs 에 완료 → 완료 가 쌓인다.
    const r = { status: '완료', assignee: 'm2' };
    const admin = { memberId: 'm9', tier: '1차', isGlobalAdmin: true };
    expect(canApprove({ requirement: r, actor: admin }).allowed).toBe(false);
  });

  it('담당자가 없는 건은 아무나 승인할 수 있다', () => {
    // assignee 와 memberId 가 둘 다 undefined 일 때 undefined === undefined 로
    // 통과해 "담당자 본인" 판정에 잘못 걸리는 것을 막는다.
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
