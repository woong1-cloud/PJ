import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GROUP,
  DEFAULT_TAB,
  DEFAULT_VIEW,
  mergeLaunchParams,
  parseLaunchParams,
} from './launchFilters';

const parse = (search) => parseLaunchParams(new URLSearchParams(search));

describe('parseLaunchParams', () => {
  it('빈 주소는 기본값이다', () => {
    expect(parse('')).toMatchObject({
      tab: DEFAULT_TAB, view: DEFAULT_VIEW, group: DEFAULT_GROUP,
      role: '', assignee: '', q: '', ws: '', task: '',
    });
  });

  it('모르는 값은 기본값으로 떨어진다 — 손으로 주소를 고친 사람에게 빈 화면을 주지 않는다', () => {
    expect(parse('tab=zzz&view=zzz&group=zzz')).toMatchObject({
      tab: DEFAULT_TAB, view: DEFAULT_VIEW, group: DEFAULT_GROUP,
    });
  });

  it('아는 값은 그대로 온다', () => {
    expect(parse('tab=weekly&view=blocked&group=assignee')).toMatchObject({
      tab: 'weekly', view: 'blocked', group: 'assignee',
    });
  });

  it('한글 역할이 왕복한다', () => {
    expect(parse('role=' + encodeURIComponent('물류팀')).role).toBe('물류팀');
  });

  it('roleInUrl 이 "키 없음"과 "빈 값"을 가른다 — localStorage 를 쓸지 정하는 값이다', () => {
    expect(parse('view=all').roleInUrl).toBe(false);
    expect(parse('role=').roleInUrl).toBe(true);
    expect(parse('role=물류팀').roleInUrl).toBe(true);
  });

  it('task 는 코드 그대로다', () => {
    expect(parse('task=18-22').task).toBe('18-22');
  });
});

describe('mergeLaunchParams', () => {
  it('빈 값은 키째 지운다 — 기본값이 주소에 남지 않는다', () => {
    expect(mergeLaunchParams('view=blocked&role=물류팀', { role: '' }))
      .toBe('view=blocked');
  });

  it('기본값을 넣으면 키가 빠진다', () => {
    expect(mergeLaunchParams('view=blocked', { view: DEFAULT_VIEW })).toBe('');
    expect(mergeLaunchParams('tab=weekly', { tab: DEFAULT_TAB })).toBe('');
    expect(mergeLaunchParams('group=assignee', { group: DEFAULT_GROUP })).toBe('');
  });

  it('모르는 값도 기본값과 같이 취급해 지운다', () => {
    expect(mergeLaunchParams('view=blocked', { view: 'zzz' })).toBe('');
  });

  it('건드리지 않은 키는 남는다', () => {
    expect(mergeLaunchParams('view=blocked&q=창고', { role: '물류팀' }))
      .toBe('view=blocked&q=%EC%B0%BD%EA%B3%A0&role=%EB%AC%BC%EB%A5%98%ED%8C%80');
  });

  it('여러 개를 한 번에 얹는다', () => {
    expect(mergeLaunchParams('', { view: 'blocked', tab: 'board', q: '' }))
      .toBe('view=blocked');
  });
});
