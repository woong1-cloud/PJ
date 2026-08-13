import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, ApiError } from '@/lib/apiError';
import { isAllowedEmail } from '@/lib/signup';
import { notifySignup } from '@/lib/notify';

// 이 라우트는 로그인하지 않은 사람이 호출한다. 다른 모든 라우트와 달리
// getSessionMember()가 없으므로 아래 입력 검증이 유일한 방어선이다.
//
// 여기서 받은 값 중 어느 것도 권한이 되지 않는다는 점이 핵심이다.
// user_brand_roles 행은 만들지 않는다 — 그건 관리자만 만든다.

// 환경변수로 빼서 계열사가 늘어도 코드를 안 고치게 한다.
const ALLOWED_DOMAINS = (process.env.SIGNUP_ALLOWED_DOMAINS ?? 'eland.co.kr')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

// 비로그인 입력이라 길이를 열어 두지 않는다.
const MAX_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 72;

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      // 본문이 JSON이 아니면 요청이 잘못된 것이지 서버가 고장난 게 아니다.
      throw new ApiError(400, '잘못된 요청입니다.');
    }
    if (!body || typeof body !== 'object') throw new ApiError(400, '잘못된 요청입니다.');

    const { name, email, password, organizationId, jobRoleId } = body;

    if (typeof name !== 'string' || !name.trim()) throw new ApiError(400, '이름을 입력해 주세요.');
    if (name.trim().length > MAX_NAME_LENGTH) {
      throw new ApiError(400, `이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`);
    }

    if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH) {
      throw new ApiError(400, '이메일을 입력해 주세요.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedEmail(normalizedEmail, ALLOWED_DOMAINS)) {
      throw new ApiError(400, `사내 이메일(@${ALLOWED_DOMAINS[0]})로만 가입할 수 있습니다.`);
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw new ApiError(400, '비밀번호는 8자 이상이어야 합니다.');
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new ApiError(400, `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`);
    }

    if (typeof organizationId !== 'string' || !organizationId) {
      throw new ApiError(400, '소속을 선택해 주세요.');
    }
    if (typeof jobRoleId !== 'string' || !jobRoleId) {
      throw new ApiError(400, '직무를 선택해 주세요.');
    }

    const supabase = getSupabaseAdmin();

    // 조직이 실재하고 활성인지 서버가 확인한다. 화면 목록은 편의일 뿐이고
    // 여기가 관문이다 — 꺼진 조직 id 를 손으로 보내 가입하는 길을 막는다.
    // 검증 없이 넣으면 FK 위반이 500 으로 튀어나오기도 한다.
    const { data: organization, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, brand_id')
      .eq('id', organizationId)
      .eq('is_active', true)
      .maybeSingle();
    if (orgErr) throw orgErr;
    if (!organization) throw new ApiError(400, '소속을 선택해 주세요.');

    // 직무도 같은 이유로 서버가 확인한다. 꺼진 직무 id 를 손으로 보내
    // 가입하는 길을 막는다.
    const { data: jobRole, error: jobErr } = await supabase
      .from('job_roles')
      .select('id, name')
      .eq('id', jobRoleId)
      .eq('is_active', true)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!jobRole) throw new ApiError(400, '직무를 선택해 주세요.');

    // 이미 가입된 이메일인지 먼저 본다. auth 계정만 만들어 놓고 team_members
    // 삽입이 실패하면 그 이메일은 영원히 쓸 수 없게 된다.
    const { data: existing, error: existErr } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existErr) throw existErr;
    if (existing) throw new ApiError(400, '이미 가입된 이메일입니다.');

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (createError) throw new ApiError(400, createError.message);

    const { error: insertError } = await supabase.from('team_members').insert({
      name: name.trim(),
      email: normalizedEmail,
      auth_user_id: created.user.id,
      // 아래 세 값은 자기 신고다. 관리자 화면에 힌트로만 쓰이고
      // 어떤 조회·권한 판단에도 쓰이지 않는다.
      organization_id: organization.id,
      job_role_id: jobRole.id,
      // 이름도 함께 남긴다. 직무 이름을 나중에 바꿔도 "가입 당시 무엇으로
      // 신청했는지"가 사라지지 않는다(affiliation 을 남긴 것과 같은 이유).
      job_role: jobRole.name,
      // 조직이 브랜드면 배치 화면이 그 브랜드를 미리 채울 수 있도록 남긴다.
      // 법무팀처럼 브랜드가 없는 조직이면 null 이고, 그때는 관리자가 고른다.
      requested_brand_id: organization.brand_id,
      signed_up_at: new Date().toISOString(),
      is_active: true,
      // 전체관리자는 가입으로 얻을 수 있는 것이 아니다.
      is_global_admin: false,
      // 본인이 정한 비밀번호라 변경을 강제할 이유가 없다.
      must_change_password: false,
    });
    if (insertError) {
      // 연결이 실패하면 방금 만든 auth 계정은 아무와도 이어지지 않은 채
      // 이메일만 점유한다 — 되돌린다. (create-account 라우트와 같은 패턴)
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw insertError;
    }

    // 배치 대기는 사람이 기다리는 대기열인데, 지금까지는 관리자가 /admin/members
    // 를 열어봐야만 알 수 있었다. 가입은 드문 사건이라 더 잘 놓친다 — 매일
    // 확인할 이유가 없는 화면이기 때문이다.
    //
    // 가입 자체는 이미 끝났으므로 알림 실패가 응답을 바꾸면 안 된다.
    // notifySignup 은 throw 하지 않는다(lib/notify.js 규약).
    // 어느 조직 사람이 기다리는지가 배치 판단의 절반이다. 예전에는 '브랜드'
    // /'본부' 두 값뿐이라 이 자리가 사실상 비어 있었다.
    await notifySignup({ name: name.trim(), organizationName: organization.name });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
