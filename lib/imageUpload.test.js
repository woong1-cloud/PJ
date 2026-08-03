import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS_PER_REQ,
  MAX_DOC_BYTES,
  MAX_IMAGE_BYTES,
  isImageType,
  validateAttachmentUpload,
} from './imageUpload';

const ok = { contentType: 'image/png', byteSize: 1000, currentCount: 0 };

describe('validateAttachmentUpload', () => {
  it('정상 케이스는 ok', () => {
    expect(validateAttachmentUpload(ok)).toEqual({ ok: true });
  });

  it('문서도 받는다 — 브랜드가 기획서를 붙일 곳이 필요하다', () => {
    for (const type of [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
    ]) {
      expect(validateAttachmentUpload({ ...ok, contentType: type }).ok, type).toBe(true);
    }
  });

  it('한글 문서는 브라우저마다 다른 MIME 을 보내서 셋 다 받는다', () => {
    for (const type of ['application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp']) {
      expect(validateAttachmentUpload({ ...ok, contentType: type }).ok, type).toBe(true);
    }
  });

  it('zip 은 거부한다 — 안에 뭐가 있는지 아무도 모른다', () => {
    expect(validateAttachmentUpload({ ...ok, contentType: 'application/zip' }).ok).toBe(false);
    expect(validateAttachmentUpload({ ...ok, contentType: 'application/x-msdownload' }).ok).toBe(
      false
    );
  });

  it('이미지와 문서의 크기 한도가 다르다', () => {
    // PPT 한 장에 이미지 몇 개만 들어가도 10MB 를 넘는다.
    expect(validateAttachmentUpload({ ...ok, byteSize: MAX_IMAGE_BYTES + 1 }).ok).toBe(false);
    expect(
      validateAttachmentUpload({
        contentType: 'application/pdf',
        byteSize: MAX_IMAGE_BYTES + 1,
        currentCount: 0,
      }).ok
    ).toBe(true);
    expect(
      validateAttachmentUpload({
        contentType: 'application/pdf',
        byteSize: MAX_DOC_BYTES + 1,
        currentCount: 0,
      }).ok
    ).toBe(false);
  });

  it('경계값은 허용', () => {
    expect(validateAttachmentUpload({ ...ok, byteSize: MAX_IMAGE_BYTES }).ok).toBe(true);
  });

  it('개수는 이미지·문서를 합쳐 센다 — 한 테이블을 공유한다', () => {
    expect(validateAttachmentUpload({ ...ok, currentCount: MAX_ATTACHMENTS_PER_REQ }).ok).toBe(
      false
    );
    expect(validateAttachmentUpload({ ...ok, currentCount: MAX_ATTACHMENTS_PER_REQ - 1 }).ok).toBe(
      true
    );
  });
});

describe('isImageType', () => {
  it('썸네일로 보여줄 수 있는 것만 참', () => {
    expect(isImageType('image/png')).toBe(true);
    expect(isImageType('application/pdf')).toBe(false);
    expect(isImageType(undefined)).toBe(false);
  });

  it('허용 목록은 이미지 + 문서다', () => {
    expect(ALLOWED_ATTACHMENT_TYPES).toContain('image/png');
    expect(ALLOWED_ATTACHMENT_TYPES).toContain('application/pdf');
  });
});
