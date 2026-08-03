import { describe, it, expect } from 'vitest';
import {
  HANDOFF_STATUSES,
  MAX_REDMINE_URL,
  normalizeRedmineUrl,
  redmineLinkState,
  shouldNudge,
  unlinkedHandoffs,
} from './redmineLink';

describe('normalizeRedmineUrl', () => {
  it('http/https 주소를 통과시킨다', () => {
    expect(normalizeRedmineUrl('https://redmine.example.com/issues/1234')).toBe(
      'https://redmine.example.com/issues/1234'
    );
    expect(normalizeRedmineUrl('http://redmine/issues/1')).toBe('http://redmine/issues/1');
  });

  it('앞뒤 공백을 지운다 — 붙여넣기하면 흔히 딸려 온다', () => {
    expect(normalizeRedmineUrl('  https://r/issues/1  ')).toBe('https://r/issues/1');
  });

  it('javascript: 는 막는다 — 이 값은 href 로 그대로 나간다', () => {
    expect(normalizeRedmineUrl('javascript:alert(1)')).toBe('');
    expect(normalizeRedmineUrl('JavaScript:alert(1)')).toBe('');
    expect(normalizeRedmineUrl('data:text/html,<script>')).toBe('');
  });

  it('스킴 없는 주소는 막는다', () => {
    expect(normalizeRedmineUrl('redmine.example.com/issues/1')).toBe('');
    expect(normalizeRedmineUrl('1234')).toBe('');
  });

  it('너무 길면 막는다', () => {
    expect(normalizeRedmineUrl(`https://r/${'a'.repeat(MAX_REDMINE_URL)}`)).toBe('');
  });

  it('빈 값은 빈 문자열이다 — 연결 해제를 뜻한다', () => {
    expect(normalizeRedmineUrl('')).toBe('');
    expect(normalizeRedmineUrl('   ')).toBe('');
    expect(normalizeRedmineUrl(null)).toBe('');
    expect(normalizeRedmineUrl(undefined)).toBe('');
    expect(normalizeRedmineUrl(123)).toBe('');
  });
});

describe('HANDOFF_STATUSES', () => {
  it('개발중부터다 — 검토중은 반려로 끝날 수 있다', () => {
    expect(HANDOFF_STATUSES).toEqual(['개발중', 'QA중', '승인대기']);
    expect(HANDOFF_STATUSES).not.toContain('검토중');
    expect(HANDOFF_STATUSES).not.toContain('검토대기');
  });
});

describe('redmineLinkState', () => {
  it('주소가 있으면 linked', () => {
    expect(redmineLinkState({ status: '개발중', redmine_url: 'https://r/1' })).toBe('linked');
    // 아직 넘길 단계가 아니어도, 미리 붙였다면 보여준다
    expect(redmineLinkState({ status: '검토중', redmine_url: 'https://r/1' })).toBe('linked');
  });

  it('개발중 이후인데 주소가 없으면 missing', () => {
    for (const status of HANDOFF_STATUSES) {
      expect(redmineLinkState({ status, redmine_url: null })).toBe('missing');
    }
  });

  it('아직 넘길 단계가 아니면 none — 배지를 목록 전체에 깔지 않는다', () => {
    expect(redmineLinkState({ status: '작성중' })).toBe('none');
    expect(redmineLinkState({ status: '검토대기' })).toBe('none');
    expect(redmineLinkState({ status: '검토중' })).toBe('none');
    expect(redmineLinkState({ status: '반려' })).toBe('none');
    expect(redmineLinkState({ status: '완료' })).toBe('none');
  });

  it('입력이 없어도 터지지 않는다', () => {
    expect(redmineLinkState(null)).toBe('none');
    expect(redmineLinkState({})).toBe('none');
  });
});

describe('unlinkedHandoffs', () => {
  it('개발중 이후이면서 주소가 없는 건만 고른다', () => {
    const reqs = [
      { id: 'a', status: '개발중', redmine_url: null },
      { id: 'b', status: '개발중', redmine_url: 'https://r/1' },
      { id: 'c', status: 'QA중', redmine_url: '' },
      { id: 'd', status: '검토중', redmine_url: null },
      { id: 'e', status: '완료', redmine_url: null },
    ];
    expect(unlinkedHandoffs(reqs).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('입력이 없어도 터지지 않는다', () => {
    expect(unlinkedHandoffs()).toEqual([]);
    expect(unlinkedHandoffs([])).toEqual([]);
  });
});

describe('shouldNudge', () => {
  it('완료된 건은 재촉하지 않는다', () => {
    // 완료는 HANDOFF_STATUSES 밖이라 이미 none 이지만, 규칙을 명시해 둔다.
    expect(shouldNudge({ status: '완료', redmine_url: null })).toBe(false);
  });

  it('개발중인데 주소가 없으면 재촉한다', () => {
    expect(shouldNudge({ status: '개발중', redmine_url: null })).toBe(true);
  });
});
