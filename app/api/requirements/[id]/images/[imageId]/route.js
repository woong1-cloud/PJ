import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { removeImageObject } from '@/lib/storage';

export async function DELETE(request, { params }) {
  try {
    const { id, imageId } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const { memberId } = await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: image, error: imgError } = await supabase
      .from('requirement_images')
      .select('id, requirement_id, brand_id, storage_path, comment_id')
      .eq('id', imageId)
      .maybeSingle();
    if (imgError) throw imgError;
    if (!image || image.requirement_id !== id) {
      throw new ApiError(404, '이미지를 찾을 수 없습니다.');
    }
    if (image.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    // 코멘트에 붙은 시안은 그 코멘트를 쓴 사람만 지운다. 코멘트 삭제 규칙을
    // 그대로 따르는 것이다 — 남의 말에 붙은 그림을 브랜드 팀원이면 누구나
    // 뗄 수 있으면, 지운 사람은 왜 사라졌는지 알 방법이 없다.
    //
    // 요구사항 첨부(comment_id 가 null)는 지금까지대로 브랜드 4차면 된다.
    if (image.comment_id) {
      const { data: comment, error: cmtError } = await supabase
        .from('requirement_comments')
        .select('id, author')
        .eq('id', image.comment_id)
        .maybeSingle();
      if (cmtError) throw cmtError;
      if (!comment || comment.author !== memberId) {
        throw new ApiError(403, '본인이 올린 시안만 삭제할 수 있습니다.');
      }
    }

    await removeImageObject(image.storage_path);
    const { error: delError } = await supabase
      .from('requirement_images')
      .delete()
      .eq('id', imageId);
    if (delError) throw delError;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
