import { describe, expect, it } from 'vitest';
import { NEWS, unseenNews } from './newsItems';

const news = [
  { date: '2026-08-20', title: 'A', body: 'a' },
  { date: '2026-08-26', title: 'B', body: 'b' },
  { date: '2026-08-28', title: 'C', body: 'c' },
];

describe('unseenNews', () => {
  it('한 번도 안 봤으면 전부', () => {
    expect(unseenNews(news, null).map((n) => n.title)).toEqual(['C', 'B', 'A']);
  });

  it('본 날짜보다 나중 것만', () => {
    expect(unseenNews(news, '2026-08-26T00:00:00Z').map((n) => n.title)).toEqual(['C']);
  });

  it('같은 날짜는 본 것으로 친다 — 안 그러면 그날 내내 창이 다시 뜬다', () => {
    expect(unseenNews(news, '2026-08-28T09:00:00Z')).toEqual([]);
  });

  it('시각이 붙어 있어도 날짜만 견준다', () => {
    // 8/26 새벽에 봤어도 8/26 항목은 본 것이다. 시각까지 견주면 같은 날
    // 배포된 소식 때문에 창이 다시 뜬다.
    expect(unseenNews(news, '2026-08-26T23:59:00Z').map((n) => n.title)).toEqual(['C']);
  });

  it('전부 본 뒤에는 빈 배열', () => {
    expect(unseenNews(news, '2026-09-01T00:00:00Z')).toEqual([]);
  });

  it('날짜 내림차순 — 새 소식이 먼저 읽힌다', () => {
    const shuffled = [news[1], news[2], news[0]];
    expect(unseenNews(shuffled, null).map((n) => n.date)).toEqual([
      '2026-08-28',
      '2026-08-26',
      '2026-08-20',
    ]);
  });

  it('빈 목록에서 죽지 않는다', () => {
    expect(unseenNews([], null)).toEqual([]);
    expect(unseenNews(undefined, null)).toEqual([]);
  });

  it('읽을 수 없는 시각은 한 번도 안 본 것으로 본다', () => {
    // 못 읽었다고 소식을 감추면 영영 못 본다. 한 번 더 보는 쪽이 낫다.
    expect(unseenNews(news, '깨진값')).toHaveLength(3);
  });
});

describe('NEWS', () => {
  // 항목 하나를 급히 더하다 title 이나 body 를 빠뜨리면 창이 빈 채로 뜬다.
  // 화면에서는 "뭐가 바뀌었다는데 내용이 없네" 로 보인다.
  it('모든 항목에 date·title·body 가 있다', () => {
    for (const item of NEWS) {
      expect(item.date, JSON.stringify(item)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.title, item.date).toBeTruthy();
      expect(item.body, item.date).toBeTruthy();
    }
  });

  it('같은 날짜가 둘 이상이면 안 된다 — 날짜로 본 것을 가리므로 하나를 놓친다', () => {
    const dates = NEWS.map((n) => n.date);
    expect(new Set(dates).size).toBe(dates.length);
  });
});
