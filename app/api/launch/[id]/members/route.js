import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin, requireLaunchAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 런칭 참여자 명단.
//
// 스펙: docs/superpowers/specs/2026-09-07-launch-members-step1-design.md
//
// 1단계는 권한을 안 연다 — 전부 requireGlobalAdmin 이다. 참여자는 아직
// 런칭을 못 본다. 명단만 만든다.
//
// 문을 여는 것은 3단계다. 참관은 안 만들기로 했으므로 한 단계다 —
// 명단에 있으면 보고 고칠 수 있고, 없으면 403 이다.

// FK 이름을 명시한다. 지금 launch_members 에서 team_members 로 가는 FK 는
// member_id 와 created_by 둘이라, 안 적으면 PostgREST 가 어느 관계를 타야
// 할지 못 고르고 PGRST201 로 죽는다.
const SELECT =
  'member_id, role_name, can_edit, created_at, ' +
  'member:team_members!launch_members_member_id_fkey(id, name, email, is_active, ' +
  'organization:organizations(name))';

// 이 런칭이 있는지 먼저 본다. 없는 id 로 명단을 넣으면 FK 가 막아 주지만,
// 그때 나오는 23503 은 사람이 읽을 말이 아니다.
async function requireLaunch(supabase, launchId) {
  const { data, error } = await supabase
    .from('launches')
    .select('id')
    .eq('id', launchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, '런칭을 찾을 수 없습니다.');
  return data;
}

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    // 명단 읽기는 참여자에게도 연다 — 항목 창의 담당자 후보가 이걸 쓴다.
    // 넣고 빼는 것(POST·DELETE)은 관리자다.
    await requireLaunchAccess(id, 'member');
    const supabase = getSupabaseAdmin();
    await requireLaunch(supabase, id);

    const { data, error } = await supabase
      .from('launch_members')
      .select(SELECT)
      .eq('launch_id', id);
    if (error) throw error;

    return Response.json({ members: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// 여럿을 한 번에 넣는다.
//
// 역할 줄에서 3명을 체크해 한 번에 보낸다. 한 명씩 세 번 왕복하면 중간에
// 하나가 실패했을 때 무엇이 들어갔는지 모른다.
export async function POST(request, { params }) {
  try {
    const { memberId: actor } = await requireGlobalAdmin();
    const { id } = await params;
    const body = await request.json();

    const roleName = String(body?.roleName ?? '').trim();
    if (!roleName) throw new ApiError(400, '역할을 고르세요.');

    const memberIds = Array.isArray(body?.memberIds)
      ? [...new Set(body.memberIds.filter((x) => typeof x === 'string' && x))]
      : [];
    if (memberIds.length === 0) throw new ApiError(400, '넣을 사람을 고르세요.');

    const supabase = getSupabaseAdmin();
    await requireLaunch(supabase, id);

    // 비활성 팀원은 안 받는다. 화면이 이미 활성만 보여주지만, 고르는 사이에
    // 누가 비활성이 될 수 있고 그때 명단에 남으면 메일이 죽은 주소로 간다.
    const { data: people, error: peopleError } = await supabase
      .from('team_members')
      .select('id')
      .in('id', memberIds)
      .eq('is_active', true);
    if (peopleError) throw peopleError;
    const alive = new Set((people ?? []).map((p) => p.id));
    const rows = memberIds
      .filter((memberId) => alive.has(memberId))
      .map((memberId) => ({
        launch_id: id,
        member_id: memberId,
        role_name: roleName,
        // can_edit 은 늘 참이다. 참관은 안 만든다 — 런칭에 들어오는 사람은
        // 대개 일을 할 사람이고, 경영자는 보고로 받는다(보고 화면은 따로).
        // 컬럼은 남겨 둔다. 그 보고 화면을 만들 때 다시 쓸 자리이고,
        // 지우는 마이그레이션은 되돌리기 어렵다.
        can_edit: true,
        created_by: actor,
      }));
    if (rows.length === 0) throw new ApiError(400, '활성 팀원이 아닙니다.');

    // 이미 있는 (런칭·사람·역할) 조합은 조용히 넘긴다. 셋을 넣는데 하나가
    // 이미 있다고 통째로 실패하면 안 된다.
    const { data, error } = await supabase
      .from('launch_members')
      .upsert(rows, { onConflict: 'launch_id,member_id,role_name', ignoreDuplicates: true })
      .select('member_id');
    if (error) throw error;

    return Response.json(
      { added: data?.length ?? 0, skipped: rows.length - (data?.length ?? 0) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// 한 줄을 뺀다.
//
// role_name 을 함께 받는 이유: PK 가 셋이라 한 사람이 재무팀이면서 법무팀일
// 수 있고, memberId 만으로는 어느 줄인지 못 짚는다.
export async function DELETE(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const body = await request.json();

    const memberId = String(body?.memberId ?? '');
    const roleName = String(body?.roleName ?? '').trim();
    if (!memberId || !roleName) throw new ApiError(400, '누구의 어느 역할인지가 필요합니다.');

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('launch_members')
      .delete()
      .eq('launch_id', id)
      .eq('member_id', memberId)
      .eq('role_name', roleName);
    if (error) throw error;

    // 이미 없어도 성공이다. 두 번 눌렀을 때 두 번째가 404 로 붉어지면
    // 사람은 안 지워진 줄 안다.
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
