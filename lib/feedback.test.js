import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_STATUSES,
  MAX_FEEDBACK_BODY,
  NEW_FEEDBACK_STATUS,
  RESOLVED_FEEDBACK_STATUS,
  normalizeFeedbackBody,
  validateStatusChange,
} from './feedback';

describe('normalizeFeedbackBody', () => {
  it('앞뒤 공백을 턴다', () => {
    expect(normalizeFeedbackBody('  목록에서 제목이 잘려요  ')).toBe('목록에서 제목이 잘려요');
  });

  it('공백뿐이면 빈 문자열 — 부르는 쪽이 400 으로 돌린다', () => {
    expect(normalizeFeedbackBody('   ')).toBe('');
    expect(normalizeFeedbackBody('\n\t')).toBe('');
  });

  it('문자열이 아니면 빈 문자열', () => {
    expect(normalizeFeedbackBody(null)).toBe('');
    expect(normalizeFeedbackBody(undefined)).toBe('');
    expect(normalizeFeedbackBody(42)).toBe('');
    expect(normalizeFeedbackBody({})).toBe('');
  });
});

describe('MAX_FEEDBACK_BODY', () => {
  it('코멘트보다 짧다 — 그보다 긴 것은 요구사항으로 올릴 이야기다', () => {
    expect(MAX_FEEDBACK_BODY).toBeLessThan(4000);
    expect(MAX_FEEDBACK_BODY).toBeGreaterThan(0);
  });
});

describe('validateStatusChange', () => {
  it("'반영함' 은 메모가 있어야 한다", () => {
    // 그 한 줄이 그대로 낸 사람에게 가는 문장이다. 비어 있으면 보낼 것이 없다.
    expect(validateStatusChange({ status: '반영함', note: '제목이 안 잘리게 했습니다' }).ok).toBe(
      true,
    );
    expect(validateStatusChange({ status: '반영함' }).ok).toBe(false);
    expect(validateStatusChange({ status: '반영함', note: '   ' }).ok).toBe(false);
  });

  it("'확인함' 은 메모 없이도 된다", () => {
    // "읽었고 지금은 안 함"이라 할 말이 없는 것이 정상이다. 여기서까지 한 줄을
    // 요구하면 관리자가 상태를 안 바꾼다.
    expect(validateStatusChange({ status: '확인함' }).ok).toBe(true);
  });

  it('처음 상태로 되돌릴 수 있다', () => {
    expect(validateStatusChange({ status: NEW_FEEDBACK_STATUS }).ok).toBe(true);
  });

  it('모르는 상태는 거부한다', () => {
    expect(validateStatusChange({ status: '보류' }).ok).toBe(false);
    expect(validateStatusChange({ status: '' }).ok).toBe(false);
    expect(validateStatusChange({}).ok).toBe(false);
    expect(validateStatusChange().ok).toBe(false);
  });

  it('거부할 때는 사람이 읽을 이유를 준다', () => {
    expect(validateStatusChange({ status: RESOLVED_FEEDBACK_STATUS }).error).toBeTruthy();
  });
});

describe('FEEDBACK_STATUSES', () => {
  it('셋이다 — DB CHECK 와 같아야 한다(0028)', () => {
    expect(FEEDBACK_STATUSES).toEqual(['새로 옴', '확인함', '반영함']);
  });
});
