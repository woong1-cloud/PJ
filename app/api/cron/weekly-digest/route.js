import { sendWeeklyDigest } from '@/lib/notify';
import { errorResponse, ApiError } from '@/lib/apiError';

// 주간 요약 메일을 쏘는 입구. 월요일 아침에 한 번 불린다.
//
// 부르는 주체를 정해 두지 않는다. 배포 플랫폼의 스케줄러든, Supabase 의
// pg_cron 이든, 당분간 사람이 직접 curl 로 치든 코드는 그대로다 — 어느 쪽이
// 될지 아직 모르는 상태에서 한쪽에 맞춰 짜면 나중에 전부 다시 만들어야 한다.
//
// 세션이 아니라 토큰으로 막는다. 스케줄러에게는 로그인 세션이 없다.
//
// GET 이 아니라 POST 인 이유: 메일을 보내는 것은 부작용이고, GET 으로 열어
// 두면 주소만 알면 브라우저 주소창으로도 눌린다. 링크 미리보기를 만드는
// 봇이 긁기만 해도 메일이 나간다.
export async function POST(request) {
  try {
    const secret = process.env.CRON_SECRET;
    // 시크릿이 없으면 아예 잠근다. 없을 때 통과시키면 "설정을 깜빡한 서버"가
    // 곧 "누구나 메일을 쏠 수 있는 서버"가 된다. 실패 문구는 관리자가 보는
    // 것이라 무엇을 해야 하는지 그대로 적는다.
    if (!secret) {
      throw new ApiError(503, 'CRON_SECRET 이 설정되지 않았습니다. 환경변수에 넣어 주세요.');
    }

    // Authorization 헤더만 받는다. 쿼리스트링(?token=)으로도 받으면 그 값이
    // 접근 로그와 리퍼러에 그대로 남는다.
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      throw new ApiError(401, '인증에 실패했습니다.');
    }

    // sendWeeklyDigest 는 던지지 않는다(lib/notify.js 규약). 결과를 돌려주므로
    // 스케줄러 로그에 몇 통이 나갔는지가 남는다 — 화면에 아무도 없는 작업이라
    // 이 응답이 유일한 단서다.
    const result = await sendWeeklyDigest();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
