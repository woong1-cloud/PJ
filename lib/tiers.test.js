import { describe, expect, it } from 'vitest';
import {
  canManageBrand,
  canProcess,
  isGlobalAdmin,
  TIER_HINTS,
  TIER_LABELS,
  TIER_RANK,
} from './tiers';

describe('isGlobalAdmin', () => {
  it('isGlobalAdmin이 true인 identity는 true', () => {
    expect(isGlobalAdmin({ isGlobalAdmin: true })).toBe(true);
  });

  it('isGlobalAdmin이 false인 identity는 false', () => {
    expect(isGlobalAdmin({ isGlobalAdmin: false })).toBe(false);
  });

  it('identity가 없으면 false', () => {
    expect(isGlobalAdmin(undefined)).toBe(false);
  });

  it('isGlobalAdmin 필드가 없으면 false', () => {
    expect(isGlobalAdmin({ tier: '2차' })).toBe(false);
  });
});

describe('canProcess', () => {
  it('1차는 true', () => {
    expect(canProcess({ tier: '1차' })).toBe(true);
  });
  it('2차는 true', () => {
    expect(canProcess({ tier: '2차' })).toBe(true);
  });
  it('3차(실무자)는 true', () => {
    expect(canProcess({ tier: '3차' })).toBe(true);
  });
  it('4차(요청자)는 false', () => {
    expect(canProcess({ tier: '4차' })).toBe(false);
  });
  it('identity가 없으면 false', () => {
    expect(canProcess(undefined)).toBe(false);
  });
});

describe('canManageBrand', () => {
  it('1차는 true', () => {
    expect(canManageBrand({ tier: '1차' })).toBe(true);
  });
  it('2차는 true', () => {
    expect(canManageBrand({ tier: '2차' })).toBe(true);
  });
  it('3차(실무자)는 false', () => {
    expect(canManageBrand({ tier: '3차' })).toBe(false);
  });
  it('4차(요청자)는 false', () => {
    expect(canManageBrand({ tier: '4차' })).toBe(false);
  });
  it('identity가 없으면 false', () => {
    expect(canManageBrand(undefined)).toBe(false);
  });
});

describe('TIER_HINTS', () => {
  it('모든 등급에 한 줄 설명이 있다', () => {
    // 셀렉트에서 한 등급만 설명이 비면 그 등급이 덜 중요한 것처럼 보인다.
    for (const tier of Object.keys(TIER_LABELS)) {
      expect(typeof TIER_HINTS[tier]).toBe('string');
      expect(TIER_HINTS[tier].length).toBeGreaterThan(0);
    }
  });

  it('라벨과 설명이 다르다 — 같은 말을 두 번 하지 않는다', () => {
    for (const tier of Object.keys(TIER_LABELS)) {
      expect(TIER_HINTS[tier]).not.toBe(TIER_LABELS[tier]);
    }
  });

  it('TIER_RANK 와 키가 같다 — 등급이 늘면 설명도 함께 늘어야 한다', () => {
    expect(Object.keys(TIER_HINTS).sort()).toEqual(Object.keys(TIER_RANK).sort());
  });
});
