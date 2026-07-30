import { describe, it, expect } from 'vitest';
import { computeStatusDurations } from './statusDurations';

const day = (n) => `2026-07-${String(1 + n).padStart(2, '0')}T00:00:00.000Z`;

describe('computeStatusDurations', () => {
  it('로그가 없으면 등록일부터 지금까지 한 구간이다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '작성중',
      changeLogs: [],
      nowIso: day(5),
    });
    expect(got).toEqual([{ status: '작성중', days: 5, ongoing: true }]);
  });

  it('한 번 전환된 정상 이력', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '검토대기',
      changeLogs: [{ old_value: '작성중', new_value: '검토대기', created_at: day(2) }],
      nowIso: day(5),
    });
    expect(got).toEqual([
      { status: '작성중', days: 2, ongoing: false },
      { status: '검토대기', days: 3, ongoing: true },
    ]);
  });

  it('여러 번 전환된 정상 이력', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '검토중',
      changeLogs: [
        { old_value: '작성중', new_value: '검토대기', created_at: day(1) },
        { old_value: '검토대기', new_value: '검토중', created_at: day(3) },
      ],
      nowIso: day(8),
    });
    expect(got).toEqual([
      { status: '작성중', days: 1, ongoing: false },
      { status: '검토대기', days: 2, ongoing: false },
      { status: '검토중', days: 5, ongoing: true },
    ]);
  });

  // 이 테스트가 이 파일의 핵심이다. 로그의 old_value 가 직전 구간에서 흘러온
  // 값과 다르면(로그 누락) 그 구간을 정직하게 '구간 불명'으로 표시한다 —
  // 아무 이름이나 갖다 붙이면 틀린 정보를 확신 있게 보여주는 셈이 된다.
  it('로그가 빠진 구간은 구간 불명으로 표시한다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '개발중',
      changeLogs: [
        { old_value: '작성중', new_value: '검토중', created_at: day(2) },
        // 여기서 old_value 가 '검토중' 이어야 하는데 '검토대기' 다 — 로그 누락.
        { old_value: '검토대기', new_value: '개발중', created_at: day(5) },
      ],
      nowIso: day(8),
    });
    expect(got).toEqual([
      { status: '작성중', days: 2, ongoing: false },
      { status: null, days: 3, ongoing: false },
      { status: '개발중', days: 3, ongoing: true },
    ]);
  });

  // 0007 마이그레이션 전 옛 이름('정책정의' 등)이 이력에 그대로 남아 있다
  // (rewrite 하지 않기로 한 결정). 낯선 이름을 화면에 그대로 보여주면
  // 사용자가 오타로 오해한다.
  it('마이그레이션 전 옛 상태명은 구간 불명으로 표시한다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '개발중',
      changeLogs: [{ old_value: '정책정의', new_value: '개발중', created_at: day(3) }],
      nowIso: day(6),
    });
    expect(got).toEqual([
      { status: null, days: 3, ongoing: false },
      { status: '개발중', days: 3, ongoing: true },
    ]);
  });

  it('연속된 구간 불명은 하나로 합친다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '개발중',
      changeLogs: [
        { old_value: '정책정의', new_value: '검토', created_at: day(1) },
        { old_value: '검토', new_value: '개발중', created_at: day(3) },
      ],
      nowIso: day(5),
    });
    expect(got).toEqual([
      { status: null, days: 3, ongoing: false },
      { status: '개발중', days: 2, ongoing: true },
    ]);
  });

  // 마지막 로그의 new_value 가 실제 현재 상태와 다른 경우(데이터 이상).
  // 이때는 currentStatus 를 그대로 갖다 쓰지 않는다 — 언제 그 상태가 됐는지
  // 이력이 설명하지 못하므로 어느 쪽 이름도 확신할 수 없다.
  it('마지막 로그가 현재 상태와 다르면 마지막 구간도 구간 불명이다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '개발중',
      changeLogs: [{ old_value: '작성중', new_value: '검토대기', created_at: day(2) }],
      nowIso: day(5),
    });
    expect(got).toEqual([
      { status: '작성중', days: 2, ongoing: false },
      { status: null, days: 3, ongoing: true },
    ]);
  });

  it('같은 순간에 두 번 바뀐 0일짜리 중간 구간은 버린다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '검토중',
      changeLogs: [
        { old_value: '작성중', new_value: '검토대기', created_at: day(2) },
        { old_value: '검토대기', new_value: '검토중', created_at: day(2) },
      ],
      nowIso: day(5),
    });
    expect(got).toEqual([
      { status: '작성중', days: 2, ongoing: false },
      { status: '검토중', days: 3, ongoing: true },
    ]);
  });

  // 방금 만든 요구사항(0일짜리 ongoing)은 버리지 않는다. 지워 버리면
  // "지금 상태가 뭐지"를 알 방법이 없다.
  it('방금 등록한 건은 0일짜리 구간이라도 남긴다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '작성중',
      changeLogs: [],
      nowIso: day(0),
    });
    expect(got).toEqual([{ status: '작성중', days: 0, ongoing: true }]);
  });

  // 병합은 change_type='중복병합' 을 쓰지만 field_name='status' 는 같다.
  // 호출하는 쪽이 field_name 으로 걸러 왔다고 가정하면, 이 함수 입장에서는
  // change_type 이 무엇이었는지 상관없이 old_value/new_value 만 본다.
  it('병합으로 인한 상태 변경도 일반 전환과 똑같이 계산한다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '중복',
      changeLogs: [{ old_value: '작성중', new_value: '중복', created_at: day(4) }],
      nowIso: day(6),
    });
    expect(got).toEqual([
      { status: '작성중', days: 4, ongoing: false },
      { status: '중복', days: 2, ongoing: true },
    ]);
  });

  it('시간 순서가 뒤섞여 들어와도 정렬해서 계산한다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '검토중',
      changeLogs: [
        { old_value: '검토대기', new_value: '검토중', created_at: day(3) },
        { old_value: '작성중', new_value: '검토대기', created_at: day(1) },
      ],
      nowIso: day(6),
    });
    expect(got).toEqual([
      { status: '작성중', days: 1, ongoing: false },
      { status: '검토대기', days: 2, ongoing: false },
      { status: '검토중', days: 3, ongoing: true },
    ]);
  });

  it('필수 인자가 없으면 빈 배열이다', () => {
    expect(computeStatusDurations({})).toEqual([]);
    expect(
      computeStatusDurations({ createdAt: day(0), currentStatus: '작성중', changeLogs: [] }),
    ).toEqual([]);
  });

  it('new_value 나 created_at 이 없는 로그 행은 무시한다', () => {
    const got = computeStatusDurations({
      createdAt: day(0),
      currentStatus: '작성중',
      changeLogs: [{ old_value: '작성중', new_value: null, created_at: day(1) }, null],
      nowIso: day(3),
    });
    expect(got).toEqual([{ status: '작성중', days: 3, ongoing: true }]);
  });
});
