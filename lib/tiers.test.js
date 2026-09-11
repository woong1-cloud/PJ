import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BRAND_TIERS,
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

describe('BRAND_TIERS', () => {
  // 1차는 브랜드별 등급이 아니다. 전체관리자라는 별도의 깃발이고,
  // 서버가 brand-team 에 1차를 저장하지 못하게 막는다.
  it('1차가 없다 — 저장할 수 없는 값이다', () => {
    expect(BRAND_TIERS).toEqual(['2차', '3차', '4차']);
  });

  it('TIER_LABELS 가 셋을 다 안다', () => {
    for (const t of BRAND_TIERS) expect(TIER_LABELS[t]).toBeTruthy();
  });
});

// 어휘가 여덟 곳에서 갈라졌던 것이 이 사달의 원인이다. 한 곳으로 모은 뒤에도
// 새 화면이 자기 배열을 또 만들면 같은 일이 반복된다. 파일을 글로 읽어 막는다
// (lib/middlewareMatcher.test.js 와 같은 수법).
describe('등급 목록을 따로 만든 곳이 없다', () => {
  const FILES = [
    'app/api/brand-team/route.js',
    'app/api/brand-team/[targetMemberId]/route.js',
    'app/api/organizations/route.js',
    'app/api/organizations/[id]/route.js',
    'components/BrandTeamSection.jsx',
    'components/BrandTeamAssignDialog.jsx',
    'components/settings/MemberPanel.jsx',
    'components/OrganizationSettings.jsx',
  ];

  it.each(FILES)('%s 가 자기 배열을 안 만든다', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    // '1차'~'4차' 가 배열 리터럴 안에 나오면 자기 목록을 만든 것이다.
    expect(src, file).not.toMatch(/\[\s*'[1-4]차'/);
  });

  it.each(FILES)('%s 가 BRAND_TIERS 를 쓴다', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src, file).toContain('BRAND_TIERS');
  });
});
