import { describe, expect, it } from 'vitest';
import { closureReason } from './closureReason';

const log = (over = {}) => ({
  change_type: '상태변경',
  field_name: 'status',
  old_value: '검토대기',
  new_value: '반려',
  comment: '중복 요청이라 진행하지 않습니다.',
  created_at: '2026-08-20T00:00:00Z',
  changer: { name: '장재혁' },
  ...over,
});

describe('closureReason', () => {
  it('반려 사유를 찾는다', () => {
    const got = closureReason({ requirement: { status: '반려' }, changeLogs: [log()] });
    expect(got).toEqual({
      status: '반려',
      label: '반려 사유',
      reason: '중복 요청이라 진행하지 않습니다.',
      by: '장재혁',
      at: '2026-08-20T00:00:00Z',
    });
  });

  it('취소는 라벨이 다르다', () => {
    const got = closureReason({
      requirement: { status: '취소' },
      changeLogs: [log({ new_value: '취소', comment: '필요 없어졌습니다.' })],
    });
    expect(got.label).toBe('취소 사유');
  });

  it('완료는 승인 확인 내용이다', () => {
    const got = closureReason({
      requirement: { status: '완료' },
      changeLogs: [log({ new_value: '완료', comment: '검색결과에 할인율이 뜨는 것 확인했습니다.' })],
    });
    expect(got.label).toBe('승인 확인 내용');
    expect(got.reason).toBe('검색결과에 할인율이 뜨는 것 확인했습니다.');
  });

  it('같은 상태로 여러 번 갔으면 마지막 것', () => {
    const got = closureReason({
      requirement: { status: '반려' },
      changeLogs: [
        log({ comment: '먼저 쓴 사유', created_at: '2026-08-10T00:00:00Z' }),
        log({ comment: '나중 사유', created_at: '2026-08-20T00:00:00Z' }),
      ],
    });
    expect(got.reason).toBe('나중 사유');
  });

  it('순서가 뒤섞여 들어와도 시각으로 고른다', () => {
    const got = closureReason({
      requirement: { status: '반려' },
      changeLogs: [
        log({ comment: '나중 사유', created_at: '2026-08-20T00:00:00Z' }),
        log({ comment: '먼저 쓴 사유', created_at: '2026-08-10T00:00:00Z' }),
      ],
    });
    expect(got.reason).toBe('나중 사유');
  });

  it('종결이 아니면 없다', () => {
    for (const status of ['작성중', '검토대기', '검토중', '개발중', 'QA중', '승인대기']) {
      expect(closureReason({ requirement: { status }, changeLogs: [log({ new_value: status })] })).toBeNull();
    }
  });

  it('중복은 없다 — 병합 배너가 따로 말한다', () => {
    expect(
      closureReason({
        requirement: { status: '중복' },
        changeLogs: [log({ new_value: '중복', comment: '병합' })],
      })
    ).toBeNull();
  });

  it('한 글자짜리는 배너로 띄우지 않는다 — 형식을 채우려고 넣은 값이다', () => {
    expect(
      closureReason({
        requirement: { status: '완료' },
        changeLogs: [log({ new_value: '완료', comment: '.' })],
      })
    ).toBeNull();
  });

  it('두 글자부터는 띄운다', () => {
    const got = closureReason({
      requirement: { status: '완료' },
      changeLogs: [log({ new_value: '완료', comment: '확인' })],
    });
    expect(got.reason).toBe('확인');
  });

  it('사유가 비어 있으면 없다', () => {
    expect(
      closureReason({ requirement: { status: '반려' }, changeLogs: [log({ comment: '   ' })] })
    ).toBeNull();
  });

  it('지금 상태로 바꾼 로그가 없으면 없다 — 옛 데이터', () => {
    expect(
      closureReason({
        requirement: { status: '반려' },
        changeLogs: [log({ new_value: '검토중', comment: '다른 전이' })],
      })
    ).toBeNull();
  });

  it("field_name 이 status 가 아닌 로그는 보지 않는다", () => {
    expect(
      closureReason({
        requirement: { status: '반려' },
        changeLogs: [log({ field_name: 'assignee', new_value: '반려' })],
      })
    ).toBeNull();
  });

  it('작성자 이름이 없어도 죽지 않는다', () => {
    const got = closureReason({
      requirement: { status: '반려' },
      changeLogs: [log({ changer: null })],
    });
    expect(got.by).toBeNull();
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(closureReason()).toBeNull();
    expect(closureReason({ requirement: null })).toBeNull();
  });
});
