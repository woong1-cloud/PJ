import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 런칭 가이드 — 브랜드와 무관한 지식.
//
// 지금은 하나뿐이지만 테이블로 두는 이유: '신규 브랜드 온라인 오픈' 말고 다른
// 종류(리뉴얼·해외 진출)가 생기면 그때 목록이 된다. 하나로 못 박아 두면
// 그날 스키마를 고쳐야 한다.
//
// 1단계에서는 전체 관리자만 본다. 가이드와 가져오기뿐이라 참여자가 할 일이 없다.

const GUIDE_SELECT = 'id, name, description, source_version, created_at, updated_at';

export async function GET() {
  try {
    await requireGlobalAdmin();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('launch_guides')
      .select(GUIDE_SELECT)
      .order('created_at', { ascending: true });
    if (error) throw error;

    // 항목·역할 개수를 함께 준다. 목록에서 "이 가이드가 비어 있나"를 알아야
    // 가져오기를 눌러야 할지 정할 수 있다.
    const guides = [];
    for (const guide of data ?? []) {
      const [items, roles] = await Promise.all([
        supabase
          .from('launch_guide_items')
          .select('id', { count: 'exact', head: true })
          .eq('guide_id', guide.id),
        supabase
          .from('launch_roles')
          .select('id', { count: 'exact', head: true })
          .eq('guide_id', guide.id),
      ]);
      guides.push({ ...guide, itemCount: items.count ?? 0, roleCount: roles.count ?? 0 });
    }

    return Response.json({ guides });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const { memberId } = await requireGlobalAdmin();
    const { name, description } = await request.json();

    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) throw new ApiError(400, '이름을 입력하세요.');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('launch_guides')
      .insert({ name: trimmed, description: description ?? null, created_by: memberId })
      .select(GUIDE_SELECT)
      .single();
    if (error) throw error;

    return Response.json({ guide: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
