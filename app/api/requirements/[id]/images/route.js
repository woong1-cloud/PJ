import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { validateImageUpload, MAX_ATTACHMENTS_PER_COMMENT } from '@/lib/imageUpload';
import { uploadImage, toSignedImageList } from '@/lib/storage';

// 첨부 목록. commentId 가 있으면 그 코멘트의 시안만, 없으면 요구사항 첨부만.
//
// 없을 때 comment_id is null 을 반드시 건다. 안 걸면 코멘트 시안이 요구사항
// 첨부에 섞여 들어와서 둘을 나눈 이유가 사라진다 — 그리고 개수 상한(15)도
// 시안이 함께 먹는다.
async function loadImageList(supabase, requirementId, commentId = null) {
  let query = supabase
    .from('requirement_images')
    .select('id, storage_path, content_type, file_name, sort_order')
    .eq('requirement_id', requirementId);
  query = commentId ? query.eq('comment_id', commentId) : query.is('comment_id', null);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const brandId = form.get('brandId');
    // 있으면 코멘트 시안이다. 없으면 지금까지처럼 요구사항 첨부.
    const commentId = form.get('commentId') || null;
    const files = form.getAll('files').filter((f) => typeof f === 'object' && f.size !== undefined);
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (files.length === 0) throw new ApiError(400, '업로드할 파일이 없습니다.');

    const { memberId } = await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    // 남의 요구사항 코멘트에 시안을 붙일 수 없게 막는다. commentId 를 그대로
    // 믿으면 이 건의 브랜드 권한만으로 다른 건의 대화에 그림을 심을 수 있다.
    if (commentId) {
      const { data: comment, error: cmtError } = await supabase
        .from('requirement_comments')
        .select('id, requirement_id')
        .eq('id', commentId)
        .maybeSingle();
      if (cmtError) throw cmtError;
      if (!comment || comment.requirement_id !== id) {
        throw new ApiError(404, '코멘트를 찾을 수 없습니다.');
      }
    }

    const max = commentId ? MAX_ATTACHMENTS_PER_COMMENT : undefined;
    let existing = await loadImageList(supabase, id, commentId);
    let nextSort = existing.length;

    for (const file of files) {
      const check = validateImageUpload({
        contentType: file.type,
        byteSize: file.size,
        currentCount: existing.length,
        max,
      });
      if (!check.ok) throw new ApiError(400, check.error);

      const buffer = Buffer.from(await file.arrayBuffer());
      const path = await uploadImage({
        brandId,
        requirementId: id,
        buffer,
        contentType: file.type,
      });
      const { error: insError } = await supabase.from('requirement_images').insert({
        requirement_id: id,
        brand_id: brandId,
        comment_id: commentId,
        storage_path: path,
        content_type: file.type,
        // 원본 파일명. 이미지는 썸네일이면 되지만 PDF·엑셀은 이 값이 없으면
        // 화면에 보여줄 것이 없다(저장 경로는 uuid 다).
        file_name: file.name ?? null,
        byte_size: file.size,
        sort_order: nextSort,
        uploaded_by: memberId,
      });
      if (insError) throw insError;
      nextSort += 1;
      existing = await loadImageList(supabase, id, commentId);
    }

    const images = await toSignedImageList(existing);
    return Response.json({ images }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
