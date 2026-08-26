import { describe, expect, it } from 'vitest';
import { TOP_N, buildMeetingDigest } from './meetingDigest';

const NOW = '2026-08-26T00:00:00Z';
// 26일 전. 손대지 않으면 정체 건이 된다.
const OLD = '2026-07-31T00:00:00Z';
const req = (over = {}) => ({
  id: 'r1',
  title: '제목',
  status: '검토대기',
  created_at: OLD,
  assignee: null,
  ...over,
});

describe('buildMeetingDigest — 멈춘 것', () => {
  it('담당 없는 건이 담당 있는 건보다 앞에 온다 — 덜 멈쳤더라도', () => {
    const digest = buildMeetingDigest({
      requirements: [
        req({ id: 'old', title: '오래됨', created_at: '2026-07-01T00:00:00Z', assignee: 'm1' }),
        req({ id: 'fresh', title: '덜오래됨', created_at: OLD, assignee: null }),
      ],
      now: NOW,
    });
    expect(digest.stalled.items.map((i) => i.id)).toEqual(['fresh', 'old']);
  });

  it('담당 유무가 같으면 오래 멈춘 순', () => {
    const digest = buildMeetingDigest({
      requirements: [
        req({ id: 'b', created_at: OLD }),
        req({ id: 'a', created_at: '2026-07-01T00:00:00Z' }),
      ],
      now: NOW,
    });
    expect(digest.stalled.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('14일 미만은 안건이 아니다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ created_at: '2026-08-20T00:00:00Z' })],
      now: NOW,
    });
    expect(digest.stalled.count).toBe(0);
  });

  it('종결 건은 안건이 아니다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ status: '반려' }), req({ id: 'r2', status: '중복' })],
      now: NOW,
    });
    expect(digest.stalled.count).toBe(0);
  });

  it('코멘트가 최근이면 안건이 아니다', () => {
    const digest = buildMeetingDigest({
      requirements: [req()],
      comments: [{ requirement_id: 'r1', created_at: '2026-08-25T00:00:00Z' }],
      now: NOW,
    });
    expect(digest.stalled.count).toBe(0);
  });

  it('상위 다섯만 펴고 나머지는 센다', () => {
    const requirements = Array.from({ length: 8 }, (_, i) => req({ id: `r${i}` }));
    const digest = buildMeetingDigest({ requirements, now: NOW });
    expect(digest.stalled.count).toBe(8);
    expect(digest.stalled.items).toHaveLength(TOP_N);
    expect(digest.stalled.more).toBe(3);
  });

  it('담당 없는 건수를 따로 센다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ id: 'a' }), req({ id: 'b', assignee: 'm1' })],
      now: NOW,
    });
    expect(digest.stalled.unassigned).toBe(1);
  });
});

describe('buildMeetingDigest — 신규와 움직인 것', () => {
  it('지난 7일 안에 생긴 건이 신규', () => {
    const digest = buildMeetingDigest({
      requirements: [
        req({ id: 'new', created_at: '2026-08-24T00:00:00Z' }),
        req({ id: 'old', created_at: OLD }),
      ],
      now: NOW,
    });
    expect(digest.incoming.items.map((i) => i.id)).toEqual(['new']);
  });

  it("움직인 것은 field_name='status' 로만 거른다 — 중복병합도 잡힌다", () => {
    const digest = buildMeetingDigest({
      requirements: [req({ id: 'a' }), req({ id: 'b' }), req({ id: 'c' })],
      changeLogs: [
        { requirement_id: 'a', field_name: 'status', created_at: '2026-08-25T00:00:00Z' },
        {
          requirement_id: 'b',
          field_name: 'status',
          change_type: '중복병합',
          created_at: '2026-08-25T00:00:00Z',
        },
        {
          requirement_id: 'c',
          field_name: 'expected_release_date',
          created_at: '2026-08-25T00:00:00Z',
        },
      ],
      now: NOW,
    });
    expect(digest.moved.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('지난 7일 밖의 상태 변경은 안 센다', () => {
    const digest = buildMeetingDigest({
      requirements: [req()],
      changeLogs: [
        { requirement_id: 'r1', field_name: 'status', created_at: '2026-08-01T00:00:00Z' },
      ],
      now: NOW,
    });
    expect(digest.moved.count).toBe(0);
  });
});

describe('buildMeetingDigest — 보낼 값어치', () => {
  it('안건도 신규도 없으면 안 보낸다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ status: '완료' })],
      now: NOW,
    });
    expect(digest.hasContent).toBe(false);
  });

  it('움직인 것만 있으면 안 보낸다 — 잘 굴러간 주다', () => {
    const digest = buildMeetingDigest({
      requirements: [req({ id: 'a', status: '완료' })],
      changeLogs: [
        { requirement_id: 'a', field_name: 'status', created_at: '2026-08-25T00:00:00Z' },
      ],
      now: NOW,
    });
    expect(digest.moved.count).toBe(1);
    expect(digest.hasContent).toBe(false);
  });

  it('안건이 있으면 보낸다', () => {
    expect(buildMeetingDigest({ requirements: [req()], now: NOW }).hasContent).toBe(true);
  });

  it('빈 입력에서 죽지 않는다', () => {
    const digest = buildMeetingDigest();
    expect(digest.hasContent).toBe(false);
    expect(digest.stalled.count).toBe(0);
  });
});
