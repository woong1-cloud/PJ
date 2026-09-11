// app/api/brand-team/route.js
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { BRAND_TIERS } from '@/lib/tiers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');

    await requireBrandAccess(brandId, '2차');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_brand_roles')
      .select('id, tier, sub_role, team_member:team_members(id, name, is_active)')
      .eq('brand_id', brandId)
      .order('tier', { ascending: false });
    if (error) throw error;

    const members = (data ?? []).map((row) => ({
      roleId: row.id,
      tier: row.tier,
      subRole: row.sub_role,
      id: row.team_member.id,
      name: row.team_member.name,
      isActive: row.team_member.is_active,
    }));
    return Response.json({ members });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { brandId, brandIds, targetMemberId, tier, subRole } = body;

    // 브랜드를 여럿 받는다. 온라인BU 기획자처럼 전 브랜드를 함께 보는 사람을
    // 다섯 번 배치하게 만들 이유가 없다. 옛 brandId 도 계속 받는다 — 이 API 를
    // 부르는 화면이 여럿이라 한꺼번에 고치면 어디가 깨졌는지 알기 어렵다.
    const targets = [...new Set((Array.isArray(brandIds) ? brandIds : [brandId]).filter(Boolean))];
    if (targets.length === 0) throw new ApiError(400, 'brandId가 필요합니다.');
    if (!targetMemberId) throw new ApiError(400, 'targetMemberId가 필요합니다.');
    // 0004에서 4차(요청자)가 생겼는데 이 검사만 따라오지 못해, 화면이 기본으로
    // 고르는 등급인 4차를 배치하면 400이 났다. DB 제약(0004)과 화면이 이미
    // 허용하는 값이라 여기만 맞춘다. 가장 낮은 등급을 받아 주는 것이므로
    // 어떤 권한도 넓어지지 않는다.
    if (!BRAND_TIERS.includes(tier)) throw new ApiError(400, '유효하지 않은 tier입니다.');
    if (subRole && !['기획', '개발', '뷰어'].includes(subRole)) {
      throw new ApiError(400, '유효하지 않은 역할입니다.');
    }

    // 브랜드마다 따로 확인한다. 스파오 관리자가 '모든 브랜드'를 눌러 미쏘까지
    // 배치하는 길이 열리면 안 된다.
    //
    // 하나라도 막히면 전부 멈춘다. 절반만 배치되면 화면에는 성공으로 보이는데
    // 실제로는 어느 브랜드가 빠졌는지 알 수 없다.
    for (const id of targets) {
      await requireBrandAccess(id, '2차');
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('user_brand_roles').insert(
      targets.map((id) => ({
        team_member_id: targetMemberId,
        brand_id: id,
        tier,
        sub_role: subRole || null,
      }))
    );
    if (error) {
      // 23505 = unique_violation. 한 브랜드만 고른 경우는 예전 문구 그대로다.
      // 여럿을 고른 경우에는 "이미 배치된 브랜드가 섞여 있다"가 실제 상황이라,
      // 무엇을 빼고 다시 눌러야 하는지를 말해 준다.
      if (error.code === '23505') {
        throw new ApiError(
          400,
          targets.length === 1
            ? '이미 이 브랜드에 배치된 팀원입니다.'
            : '이미 배치된 브랜드가 섞여 있습니다. 그 브랜드를 빼고 다시 시도해 주세요.'
        );
      }
      throw error;
    }
    return Response.json({ ok: true, assigned: targets.length }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
