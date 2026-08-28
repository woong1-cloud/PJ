import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionMember } from '@/lib/auth';
import { errorResponse } from '@/lib/apiError';
import { NEWS, latestNewsDate } from '@/lib/newsItems';

// 업데이트 소식을 봤다고 기록한다.
//
// 실패해도 화면은 창을 닫는다. 소식을 한 번 더 보는 것보다 "닫기를 눌렀는데
// 안 닫힌다" 가 훨씬 나쁘다.
export async function POST() {
  try {
    const { memberId } = await getSessionMember();

    // '지금'이 아니라 '가장 새 소식의 날짜'를 찍는다.
    //
    // 지금 시각으로 찍었더니, 오늘 나간 배포에 내일 날짜 항목이 섞여서 그
    // 항목이 내일까지 매 로그인마다 다시 떴다. 읽은 지점을 달력이 아니라
    // 목록 자체로 재면 그 어긋남이 없다.
    //
    // 정오로 맞춘다. 자정으로 두면 시간대에 따라 하루 앞뒤로 밀려 읽힌다.
    const latest = latestNewsDate(NEWS);
    if (!latest) return Response.json({ ok: true });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('team_members')
      .update({ news_seen_at: `${latest}T12:00:00Z` })
      .eq('id', memberId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
