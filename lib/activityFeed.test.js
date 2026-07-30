import { describe, it, expect } from 'vitest';
import { buildActivityFeed } from './activityFeed';

const log = (id, createdAt, extra = {}) => ({
  id,
  created_at: createdAt,
  change_type: '상태변경',
  ...extra,
});
const comment = (id, createdAt, extra = {}) => ({
  id,
  created_at: createdAt,
  body: `본문 ${id}`,
  edited_at: null,
  ...extra,
});

const ids = (feed) => feed.map((e) => e.id);

describe('buildActivityFeed', () => {
  it('두 출처를 시간순으로 섞는다', () => {
    const history = [log('h1', '2026-07-01T09:00:00Z'), log('h2', '2026-07-03T09:00:00Z')];
    const comments = [comment('c1', '2026-07-02T09:00:00Z'), comment('c2', '2026-07-04T09:00:00Z')];

    expect(ids(buildActivityFeed(history, comments))).toEqual([
      'change:h1',
      'comment:c1',
      'change:h2',
      'comment:c2',
    ]);
  });

  it('오래된 것이 위, 새 것이 아래다', () => {
    const feed = buildActivityFeed(
      [log('h1', '2026-07-05T00:00:00Z')],
      [comment('c1', '2026-07-01T00:00:00Z')],
    );
    expect(ids(feed)).toEqual(['comment:c1', 'change:h1']);
  });

  it('각 항목에 출처 종류를 붙인다', () => {
    const feed = buildActivityFeed([log('h1', '2026-07-01T00:00:00Z')], [comment('c1', '2026-07-02T00:00:00Z')]);
    expect(feed.map((e) => e.kind)).toEqual(['change', 'comment']);
  });

  it('원본 행을 data 로 그대로 넘긴다', () => {
    const c = comment('c1', '2026-07-01T00:00:00Z', { body: '이거 급합니다' });
    const feed = buildActivityFeed([], [c]);
    expect(feed[0].data).toBe(c);
    expect(feed[0].data.body).toBe('이거 급합니다');
  });

  it('createdAt 을 항목 위로 끌어올린다', () => {
    const feed = buildActivityFeed([log('h1', '2026-07-01T00:00:00Z')], []);
    expect(feed[0].createdAt).toBe('2026-07-01T00:00:00Z');
  });

  // 상태를 바꾸고 곧바로 이유를 적는 흐름이 흔하다. 두 행의 시각이 같게 찍히면
  // 이력이 위, 코멘트가 아래여야 "이 상태로 간 이유"로 읽힌다.
  it('시각이 같으면 이력이 코멘트보다 먼저 온다', () => {
    const feed = buildActivityFeed(
      [log('h1', '2026-07-01T00:00:00Z')],
      [comment('c1', '2026-07-01T00:00:00Z')],
    );
    expect(ids(feed)).toEqual(['change:h1', 'comment:c1']);
  });

  it('시각이 같은 코멘트끼리는 들어온 순서를 지킨다', () => {
    const feed = buildActivityFeed(
      [],
      [comment('c1', '2026-07-01T00:00:00Z'), comment('c2', '2026-07-01T00:00:00Z')],
    );
    expect(ids(feed)).toEqual(['comment:c1', 'comment:c2']);
  });

  // 정렬 기준은 created_at 이다. 오타를 고쳤다고 옛 대화가 맨 아래로
  // 튀어나오면 읽던 맥락이 무너진다.
  it('수정된 코멘트도 작성 시각 자리에 그대로 있는다', () => {
    const feed = buildActivityFeed(
      [log('h1', '2026-07-10T00:00:00Z')],
      [comment('c1', '2026-07-01T00:00:00Z', { edited_at: '2026-07-20T00:00:00Z' })],
    );
    expect(ids(feed)).toEqual(['comment:c1', 'change:h1']);
  });

  it('한쪽이 비어도 나머지를 그대로 돌려준다', () => {
    expect(ids(buildActivityFeed([log('h1', '2026-07-01T00:00:00Z')], []))).toEqual(['change:h1']);
    expect(ids(buildActivityFeed([], [comment('c1', '2026-07-01T00:00:00Z')]))).toEqual(['comment:c1']);
  });

  it('둘 다 비면 빈 배열이다', () => {
    expect(buildActivityFeed([], [])).toEqual([]);
  });

  // 코멘트는 상세와 따로 불러오므로, 아직 안 온 동안에는 undefined/null 이다.
  // 그 사이에 피드가 터지면 상태 이력까지 같이 안 보이게 된다.
  it('아직 안 불러온 쪽이 null·undefined 여도 깨지지 않는다', () => {
    expect(ids(buildActivityFeed([log('h1', '2026-07-01T00:00:00Z')], undefined))).toEqual([
      'change:h1',
    ]);
    expect(ids(buildActivityFeed(null, [comment('c1', '2026-07-01T00:00:00Z')]))).toEqual([
      'comment:c1',
    ]);
    expect(buildActivityFeed(undefined, null)).toEqual([]);
  });

  // 시각이 없는 행을 0(1970년)으로 취급하면 피드 맨 위로 올라붙는다.
  // 한 행이 망가진 것을 전체가 이상해 보이는 것으로 키우지 않는다.
  it('시각을 읽을 수 없는 행은 맨 뒤로 보낸다', () => {
    const feed = buildActivityFeed(
      [log('h1', null), log('h2', '2026-07-01T00:00:00Z')],
      [comment('c1', '2026-07-02T00:00:00Z')],
    );
    expect(ids(feed)).toEqual(['change:h2', 'comment:c1', 'change:h1']);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const history = [log('h2', '2026-07-05T00:00:00Z'), log('h1', '2026-07-01T00:00:00Z')];
    const before = [...history];
    buildActivityFeed(history, []);
    expect(history).toEqual(before);
  });

  it('id 는 종류가 섞여도 겹치지 않는다', () => {
    // 두 테이블의 uuid 가 같을 일은 없지만, key 로 쓰는 값이므로 접두사로 갈라둔다.
    const feed = buildActivityFeed([log('same', '2026-07-01T00:00:00Z')], [comment('same', '2026-07-02T00:00:00Z')]);
    expect(new Set(ids(feed)).size).toBe(2);
  });
});
