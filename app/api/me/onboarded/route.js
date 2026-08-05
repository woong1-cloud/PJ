import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse } from '@/lib/apiError';

// 첫 로그인 안내를 닫았다고 기록한다.
//
// 실패해도 화면은 창을 닫는다. 안내를 한 번 더 보는 것보다 "닫기를 눌렀는데
// 안 닫힌다" 가 훨씬 나쁘다.
export async function POST() {
  try {
    const { memberId } = await getSessionMember();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('team_members')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', memberId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
