import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { normalizeRedmineUrl } from '@/lib/redmineLink';

// 레드마인 이슈 주소 연결/해제.
//
// 3차 이상만. 어느 티켓으로 넘겼는지는 실행하는 쪽이 아는 값이고, 브랜드가
// 임의로 바꾸면 인계 추적이 무너진다.
//
// 빈 문자열을 보내면 연결 해제다. 잘못 붙인 주소를 지울 방법이 없으면
// 사람들은 그냥 틀린 채로 둔다.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { brandId, redmineUrl } = await request.json();
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    const raw = typeof redmineUrl === 'string' ? redmineUrl.trim() : '';
    const url = normalizeRedmineUrl(redmineUrl);
    // 뭔가 적었는데 통과하지 못했다면 형식이 틀린 것이다. 조용히 비워 버리면
    // 사용자는 저장된 줄 알고 나간다.
    if (raw && !url) {
      throw new ApiError(400, 'http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.');
    }

    const { memberId } = await requireBrandAccess(brandId, '3차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, redmine_url')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');

    const next = url || null;
    if ((current.redmine_url ?? null) === next) {
      return Response.json({ ok: true, redmineUrl: next, unchanged: true });
    }

    const nowIso = new Date().toISOString();
    const { error: updError } = await supabase
      .from('requirements')
      .update({ redmine_url: next, updated_at: nowIso })
      .eq('id', id);
    if (updError) throw updError;

    // field_name 을 'status' 가 아닌 값으로 둔다 — 상태 구간 계산이
    // field_name === 'status' 로 거르기 때문에, 여기 섞이면 구간이 틀어진다.
    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '내용수정',
      field_name: 'redmine_url',
      old_value: current.redmine_url,
      new_value: next,
      comment: next ? '레드마인 연결' : '레드마인 연결 해제',
    });
    if (logError) throw logError;

    return Response.json({ ok: true, redmineUrl: next });
  } catch (error) {
    return errorResponse(error);
  }
}
