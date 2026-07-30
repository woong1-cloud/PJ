// 알림 메일의 제목·본문. 순수 함수라 테스트가 붙는다.
//
// 인앱 알림 문구(lib/notifications.js)를 그대로 쓰지 않는다. 벨에서는 한 줄이
// 곧 전부지만, 메일은 제목만 보고 열지 말지 정한다 — 제목에 "무엇에 대한
// 것인지"가 들어가야 하고, 본문에는 눌러서 갈 링크가 있어야 한다.

// 메일로 내보내는 사건은 이 셋뿐이다.
//
// 인앱 알림은 상태변경·코멘트까지 넷이지만, 그걸 다 메일로 보내면 하루 수십
// 통이 되고 사람들은 규칙을 걸어 자동 분류해 버린다. 그 순간 메일 알림은
// 아무 일도 하지 않으면서 서버만 쓴다. 밀어내는 채널에는 "지금 당신이 뭘
// 해야 하는" 것만 싣는다.
export const EMAIL_EVENTS = ['배치대기', '담당자지정', '멘션'];

const APP_NAME = '모아 MOA';

// 제목 앞에 붙는 말머리. 받은편지함에서 한 덩어리로 묶여 보이고, 규칙을 걸어
// 폴더로 보내고 싶은 사람에게 걸 만한 것을 준다.
const SUBJECT_PREFIX = `[${APP_NAME}]`;

const MAX_SUBJECT_TITLE = 40;

function shorten(text, max = MAX_SUBJECT_TITLE) {
  if (typeof text !== 'string' || !text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

// 링크는 절대 URL 이어야 한다. 메일 클라이언트에는 '현재 사이트'가 없어서
// 상대 경로는 그냥 깨진 링크가 된다.
export function absoluteUrl(baseUrl, path) {
  if (!baseUrl) return null;
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = typeof path === 'string' && path.startsWith('/') ? path : `/${path ?? ''}`;
  return `${base}${suffix}`;
}

// 본문은 평문이다. HTML 메일을 만들면 사내 메일 클라이언트마다 다르게 깨지고,
// 그걸 맞추는 일이 이 앱의 본업이 아니다. 평문은 어디서나 같게 보인다.
function body({ lines, url }) {
  const parts = [...lines];
  if (url) parts.push('', url);
  parts.push('', '—', `${APP_NAME}에서 보낸 알림입니다.`);
  return parts.join('\n');
}

// 배치 대기(가입 신청) — 전체 관리자에게.
export function signupEmail({ name, affiliation, brandName, baseUrl }) {
  const who = name ?? '새 사용자';
  const where = brandName ? `${brandName}(${affiliation ?? '브랜드'})` : (affiliation ?? '');
  return {
    subject: `${SUBJECT_PREFIX} 배치 대기 — ${who}님 가입`,
    text: body({
      lines: [
        `${who}님이 ${where} 소속으로 가입했습니다.`,
        '',
        '아직 아무 브랜드에도 배치되지 않아 로그인해도 할 수 있는 일이 없습니다.',
        '팀원 관리 화면에서 배치해 주세요.',
      ],
      url: absoluteUrl(baseUrl, '/admin/members'),
    }),
  };
}

// 담당자 지정 — 새로 담당자가 된 사람에게.
//
// 인앱 알림은 요청자·담당자 모두에게 가지만 메일은 담당자 본인에게만 간다.
// 요청자에게 "누가 담당자가 됐다"는 메일까지 가면 한 사건에 두 통이 되고,
// 요청자가 지금 당장 할 일은 없다.
export function assigneeEmail({ title, assignerName, requirementId, baseUrl }) {
  const by = assignerName ? `${assignerName}님이 ` : '';
  return {
    subject: `${SUBJECT_PREFIX} 담당자 지정 — ${shorten(title)}`,
    text: body({
      lines: [`${by}회원님을 다음 요구사항의 담당자로 지정했습니다.`, '', `· ${title}`],
      url: absoluteUrl(baseUrl, `/requirements/${requirementId}`),
    }),
  };
}

// 멘션 — 코멘트에서 이름이 불린 사람에게.
export function mentionEmail({ title, actorName, requirementId, baseUrl }) {
  const by = actorName ? `${actorName}님이 ` : '누군가 ';
  return {
    subject: `${SUBJECT_PREFIX} 언급됨 — ${shorten(title)}`,
    text: body({
      lines: [`${by}코멘트에서 회원님을 언급했습니다.`, '', `· ${title}`],
      url: absoluteUrl(baseUrl, `/requirements/${requirementId}`),
    }),
  };
}
