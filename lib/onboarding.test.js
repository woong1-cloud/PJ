import { describe, it, expect } from 'vitest';
import { onboardingSlides, shouldShowOnboarding } from './onboarding';

describe('onboardingSlides', () => {
  it('요청자에게는 올리는 법을 보여준다', () => {
    const keys = onboardingSlides({ tier: '4차' }).map((s) => s.key);
    expect(keys).toEqual(['what', 'submit', 'status']);
  });

  it('처리자에게는 받아서 처리하는 법을 보여준다', () => {
    const keys = onboardingSlides({ tier: '3차' }).map((s) => s.key);
    expect(keys).toEqual(['inbox', 'start', 'approve']);
  });

  it('전체관리자도 처리자로 본다', () => {
    expect(onboardingSlides({ isGlobalAdmin: true })[0].key).toBe('inbox');
  });

  it('등급을 모르면 요청자로 본다 — 못 하는 기능을 설명하지 않는다', () => {
    expect(onboardingSlides({})[0].key).toBe('what');
    expect(onboardingSlides()[0].key).toBe('what');
  });

  it('어느 등급이든 세 장이다 — 네 장부터는 마지막을 아무도 안 읽는다', () => {
    expect(onboardingSlides({ tier: '4차' })).toHaveLength(3);
    expect(onboardingSlides({ tier: '2차' })).toHaveLength(3);
  });

  it('모든 장에 제목과 본문이 있다', () => {
    for (const tier of ['4차', '3차', '2차', '1차']) {
      for (const slide of onboardingSlides({ tier })) {
        expect(slide.title.length).toBeGreaterThan(0);
        expect(slide.body.length).toBeGreaterThan(0);
      }
    }
  });

  it('요청자 안내에 임시저장 설명이 들어 있다', () => {
    // 열 건 중 세 건이 임시저장인 채로 남아 있던 것이 이 기능의 출발점이다.
    const submit = onboardingSlides({ tier: '4차' }).find((s) => s.key === 'submit');
    expect(submit.body).toContain('임시저장');
    expect(submit.title).toContain('검토 요청');
  });
});

describe('shouldShowOnboarding', () => {
  it('아직 안 봤으면 띄운다', () => {
    expect(shouldShowOnboarding({ onboardedAt: null })).toBe(true);
    expect(shouldShowOnboarding({})).toBe(true);
    expect(shouldShowOnboarding()).toBe(true);
  });

  it('본 적 있으면 안 띄운다', () => {
    expect(shouldShowOnboarding({ onboardedAt: '2026-08-05T00:00:00Z' })).toBe(false);
  });

  it('비밀번호 변경이 남아 있으면 안 띄운다 — 창이 겹치고 시험해 볼 화면이 없다', () => {
    expect(shouldShowOnboarding({ onboardedAt: null, mustChangePassword: true })).toBe(false);
  });
});
