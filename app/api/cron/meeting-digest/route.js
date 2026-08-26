import { sendMeetingDigest } from '@/lib/notify';
import { errorResponse, ApiError } from '@/lib/apiError';

// 회의 안건 메일을 쏘는 입구. 수요일 오후에 한 번 불린다.
//
// weekly-digest 라우트와 인증이 같다. 헤더 이름을 둘 다 받는 이유도 같다 —
// noa-vibe 배포 플랫폼의 스케줄러는 토큰 칸이 'x-noa-token' 하나로 고정이라
// Authorization 을 보낼 방법이 없고, 그렇다고 Authorization 을 버리면 curl 로
// 직접 부르는 표준 방식이 사라진다. 둘 다 받아도 느슨해지지 않는다 — 통과
// 조건은 여전히 "같은 비밀값을 알고 있다" 하나이고 봉투만 다르다.
//
// GET 이 아니라 POST 인 이유: 메일 발송은 부작용이다. GET 으로 열어 두면
// 주소만 알면 브라우저 주소창으로도 눌리고, 링크 미리보기를 만드는 봇이
// 긁기만 해도 메일이 나간다.
export async function POST(request) {
  try {
    const secret = process.env.CRON_SECRET;
    // 시크릿이 없으면 아예 잠근다. 없을 때 통과시키면 "설정을 깜빡한 서버"가
    // 곧 "누구나 메일을 쏠 수 있는 서버"가 된다.
    if (!secret) {
      throw new ApiError(503, 'CRON_SECRET 이 설정되지 않았습니다. 환경변수에 넣어 주세요.');
    }

    const auth = request.headers.get('authorization') ?? '';
    const noaToken = request.headers.get('x-noa-token') ?? '';
    if (auth !== `Bearer ${secret}` && noaToken !== secret) {
      throw new ApiError(401, '인증에 실패했습니다.');
    }

    // sendMeetingDigest 는 던지지 않는다(lib/notify.js 규약). 결과를 돌려주므로
    // 스케줄러 로그에 몇 통이 나갔는지가 남는다 — 화면에 아무도 없는 작업이라
    // 이 응답이 유일한 단서다.
    const result = await sendMeetingDigest();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
