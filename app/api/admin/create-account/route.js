import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

export async function POST(request) {
  try {
    await requireGlobalAdmin();

    const body = await request.json();
    const { targetMemberId, email, password } = body;
    if (!targetMemberId || !email || !password) {
      throw new ApiError(400, 'targetMemberId, email, password가 필요합니다.');
    }
    if (password.length < 8) throw new ApiError(400, '비밀번호는 8자 이상이어야 합니다.');

    const supabase = getSupabaseAdmin();

    const { data: target, error: targetError } = await supabase
      .from('team_members')
      .select('id, auth_user_id')
      .eq('id', targetMemberId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw new ApiError(404, '팀원을 찾을 수 없습니다.');
    if (target.auth_user_id) throw new ApiError(400, '이미 계정이 있는 팀원입니다.');

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw new ApiError(400, createError.message);

    // email 을 함께 적는다. auth.users 에만 두면 이 사람은 그 주소로
    // 로그인하는데 알림 메일은 못 받는다 — lib/notify.js 의 loadEmails 가
    // 보는 곳은 team_members.email 이다. 가입 라우트는 원래 둘 다 채우고
    // 있었고 여기만 빠져 있었다(0016 이 기존 계정을 메운다).
    const { data: updated, error: updateError } = await supabase
      .from('team_members')
      .update({
        email: email.trim().toLowerCase(),
        auth_user_id: created.user.id,
        must_change_password: true,
      })
      .eq('id', targetMemberId)
      .select()
      .maybeSingle();
    if (updateError || !updated) {
      // team_members 연결이 실패하면 방금 만든 auth.users 계정은 아무 팀원과도
      // 연결되지 않아 영원히 쓸 수 없는 채로 이메일만 점유하게 된다 — 되돌린다.
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
      if (updateError) throw updateError;
      throw new ApiError(404, '팀원을 찾을 수 없습니다.');
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
