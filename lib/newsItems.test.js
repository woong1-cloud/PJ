import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEWS, POPOVER_LIMIT, latestNewsDate, unseenNews } from './newsItems';

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

  // 같은 날짜가 둘인 것은 괜찮다. 한 배포로 함께 나가 한 창에서 함께 읽힌다.
  // 위험한 것은 '이미 본 날짜보다 앞선' 항목을 나중에 끼워 넣는 것이다 —
  // 그건 목록 순서로 잡는다.
  it('맨 앞 항목이 가장 새 날짜다 — 새 소식은 위에, 그리고 더 나중 날짜로', () => {
    expect(NEWS[0].date).toBe(latestNewsDate(NEWS));
  });

  it('팝오버가 자를 개수만큼은 있다 — 없으면 팝오버가 얇아진다', () => {
    expect(NEWS.length).toBeGreaterThanOrEqual(POPOVER_LIMIT);
  });

  it('날짜 내림차순으로 적혀 있다', () => {
    const dates = NEWS.map((n) => n.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('latestNewsDate', () => {
  it('가장 새 날짜', () => {
    expect(latestNewsDate(news)).toBe('2026-08-28');
  });

  it('순서가 뒤죽박죽이어도 최대값', () => {
    expect(latestNewsDate([news[1], news[2], news[0]])).toBe('2026-08-28');
  });

  it('빈 목록이면 null — 찍을 것이 없다', () => {
    expect(latestNewsDate([])).toBe(null);
    expect(latestNewsDate(undefined)).toBe(null);
  });
});

describe('NEWS 항목의 모양', () => {
  it('href 가 있으면 cta 도 있다 — 이름 없는 단추를 그릴 수 없다', () => {
    for (const item of NEWS) {
      if (item.href) expect(item.cta, item.date).toBeTruthy();
    }
  });

  it('cta 가 있으면 href 도 있다 — 갈 곳 없는 단추를 그릴 수 없다', () => {
    for (const item of NEWS) {
      if (item.cta) expect(item.href, item.date).toBeTruthy();
    }
  });

  // 파일 이름에 해시가 붙어 있어서, 그림을 다시 구우면 이름이 바뀐다.
  // 여기서 안 잡으면 소식 팝업에 깨진 그림이 뜨고 아무도 오류로 안 본다.
  it('image 가 가리키는 파일이 실제로 있다', () => {
    for (const item of NEWS) {
      if (!item.image) continue;
      const path = join(process.cwd(), 'public', item.image);
      expect(existsSync(path), item.image).toBe(true);
    }
  });
});
