import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';

export const IMAGE_BUCKET = 'requirement-images';

// 저장 경로의 확장자. 파일명 자체는 uuid 라 사람이 읽을 일이 없지만, 확장자가
// 맞아야 내려받았을 때 올바른 앱으로 열린다. 모르는 형식은 'bin' 이 되고
// 그래도 다운로드는 된다.
const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/x-hwp': 'hwp',
  'application/haansofthwp': 'hwp',
  'application/vnd.hancom.hwp': 'hwp',
  'text/csv': 'csv',
};

export function extForContentType(contentType) {
  return EXT_BY_TYPE[contentType] ?? 'bin';
}

// 파일 하나를 업로드하고 저장 경로를 반환한다.
export async function uploadImage({ brandId, requirementId, buffer, contentType }) {
  const supabase = getSupabaseAdmin();
  const ext = extForContentType(contentType);
  const path = `${brandId}/${requirementId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, buffer, { contentType });
  if (error) throw error;
  return path;
}

export async function removeImageObject(path) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

// storage_path 배열 → { path: signedUrl } 맵. 짧은 TTL(기본 300초).
export async function signImagePaths(paths, expiresIn = 300) {
  if (!paths.length) return {};
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const map = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

// requirement_images 행 배열 → 클라이언트용 목록.
//
// file_name 을 함께 내린다. 이미지는 썸네일이면 충분하지만 PDF·엑셀은 원본
// 이름이 없으면 화면에 보여줄 것이 없다 — 저장 경로는 uuid 다.
export async function toSignedImageList(rows) {
  const paths = (rows ?? []).map((r) => r.storage_path);
  const signed = await signImagePaths(paths);
  return (rows ?? []).map((r) => ({
    id: r.id,
    signedUrl: signed[r.storage_path] ?? null,
    content_type: r.content_type,
    file_name: r.file_name ?? null,
    sort_order: r.sort_order,
  }));
}
