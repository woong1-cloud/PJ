import { describe, expect, it } from 'vitest';
import { settingsGroupsFor, settingsItemsFor, isSettingsPathAllowed } from './settingsNav';

const guest = { tier: '4차' };
const brandAdmin = { tier: '2차' };
const global = { tier: '4차', isGlobalAdmin: true };

describe('settingsGroupsFor', () => {
  it('누구나 내 계정은 본다', () => {
    expect(settingsGroupsFor(guest).map((g) => g.id)).toEqual(['account']);
  });

  it('브랜드 관리자는 이 브랜드까지', () => {
    expect(settingsGroupsFor(brandAdmin).map((g) => g.id)).toEqual(['account', 'brand']);
  });

  // 전체관리자는 등급과 무관하게 전부 본다. isGlobalAdmin 이 등급을 덮는
  // 규칙은 lib/tiers.js 가 이미 정해 뒀다 — 여기서 다시 정하지 않는다.
  it('전체관리자는 셋 다', () => {
    expect(settingsGroupsFor(global).map((g) => g.id)).toEqual(['account', 'brand', 'org']);
  });

  it('identity 가 없어도 죽지 않는다', () => {
    expect(settingsGroupsFor(undefined).map((g) => g.id)).toEqual(['account']);
  });
});

describe('isSettingsPathAllowed', () => {
  it('내 것은 누구나', () => {
    expect(isSettingsPathAllowed(guest, '/settings/profile')).toBe(true);
  });

  it('남의 것은 막는다', () => {
    expect(isSettingsPathAllowed(guest, '/settings/members')).toBe(false);
    expect(isSettingsPathAllowed(brandAdmin, '/settings/members')).toBe(false);
  });

  it('전체관리자는 다 된다', () => {
    expect(isSettingsPathAllowed(global, '/settings/members')).toBe(true);
  });

  // 모르는 주소를 true 로 돌리면 새 화면을 더할 때 문지기가 조용히 빠진다.
  it('목록에 없는 주소는 막는다', () => {
    expect(isSettingsPathAllowed(global, '/settings/unknown')).toBe(false);
  });
});

describe('settingsItemsFor', () => {
  it('묶음을 펴서 줄만 준다 — 폰의 select 가 쓴다', () => {
    const items = settingsItemsFor(global);
    expect(items.length).toBe(9);
    expect(items[0].href).toBe('/settings/profile');
    expect(items[0].group).toBe('내 계정');
  });
});
