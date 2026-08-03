// 첨부 파일 규칙.
//
// 파일 이름이 imageUpload 인 것은 예전에 이미지만 받았기 때문이다(0002).
// 지금은 문서도 받는다 — 브랜드가 기획서·요건 엑셀을 붙일 곳이 없어서
// 실제로 막혀 있었다. 파일·테이블 이름을 바꾸는 대신 여기 규칙만 넓힌다.

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// 문서 첨부. 브랜드가 실제로 올리는 것들이다.
//
// zip 은 넣지 않는다. 안에 무엇이 있는지 아무도 모르고, 사내 배포 앱에서
// 임의 압축파일을 주고받는 통로를 여는 것은 이 기능이 필요한 이유와 무관하다.
export const ALLOWED_DOC_TYPES = [
  'application/pdf',
  // 엑셀
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // 파워포인트
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 워드
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // 한글. 브라우저마다 다르게 보내서 세 가지를 다 받는다.
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
  'text/csv',
];

export const ALLOWED_ATTACHMENT_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
// 문서는 더 크게 잡는다. PPT 한 장에 이미지가 몇 개만 들어가도 10MB 를 넘는다.
export const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20MB
// 이미지와 문서가 한 테이블을 공유하므로 개수 상한도 합쳐서 센다.
export const MAX_ATTACHMENTS_PER_REQ = 15;

export function isImageType(contentType) {
  return ALLOWED_IMAGE_TYPES.includes(contentType);
}

function mb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

// 첨부 1개 기준 판정(순수 함수).
export function validateAttachmentUpload({ contentType, byteSize, currentCount }) {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(contentType)) {
    return { ok: false, error: '지원하지 않는 파일 형식입니다.' };
  }
  const limit = isImageType(contentType) ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
  if (byteSize > limit) {
    return { ok: false, error: `파일 크기는 ${mb(limit)}MB 이하여야 합니다.` };
  }
  if (currentCount >= MAX_ATTACHMENTS_PER_REQ) {
    return { ok: false, error: `첨부는 최대 ${MAX_ATTACHMENTS_PER_REQ}개까지 가능합니다.` };
  }
  return { ok: true };
}

// 예전 이름. 업로드 라우트가 아직 이 이름으로 부르고 있어 남겨 둔다 —
// 동작은 위와 같다(이미지든 문서든 같은 규칙을 탄다).
export const validateImageUpload = validateAttachmentUpload;
