import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse } from '@/lib/apiError';
import { requireRequirementAccess } from '@/lib/requirementAccess';
import { loadMentionableMembers } from '@/lib/mentionable';

// 이 요구사항에서 부를 수 있는 사람 목록. 코멘트 입력창의 @자동완성이 쓴다.
//
// 관문은 코멘트와 똑같다(requireRequirementAccess, 4차). 코멘트를 쓸 수 있는
// 사람만 누구를 부를 수 있는지 알 수 있어야 한다.
//
// 브랜드는 요청이 보낸 brandId 가 아니라 검사를 통과한 requirement.brand_id 로
// 좁힌다 — 두 값은 requireRequirementAccess 에서 이미 같음을 확인했지만,
// 여기서 요청값을 다시 쓰면 나중에 그 검사가 느슨해질 때 이 목록이 남의
// 브랜드 팀을 흘리는 통로가 된다.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const supabase = getSupabaseAdmin();
    const { requirement } = await requireRequirementAccess(supabase, id, brandId, '4차');

    const members = await loadMentionableMembers(supabase, {
      brandId: requirement.brand_id,
      isConfidential: requirement.is_confidential,
    });

    return Response.json({ members });
  } catch (error) {
    return errorResponse(error);
  }
}
