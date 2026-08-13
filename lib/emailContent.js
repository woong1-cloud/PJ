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

// 접수(검토 요청) — 그 브랜드의 3차 이상에게.
//
// 제목에 브랜드를 넣는다. 받는 사람이 여러 브랜드를 맡고 있으면 메일함에서
// 제목만 보고 "내가 지금 봐야 할 브랜드인가"를 판단하기 때문이다. 가입 메일은
// 전체 관리자 한 종류라 필요 없었지만 이건 브랜드마다 온다.
export function submittedEmail({ title, requesterName, brandName, requirementId, baseUrl }) {
  const who = requesterName ? `${requesterName}님이` : '누군가';
  const where = brandName ? `[${brandName}] ` : '';
  return {
    subject: `${SUBJECT_PREFIX} 검토 요청 — ${where}${shorten(title)}`,
    text: body({
      lines: [
        `${who} 새 요구사항의 검토를 요청했습니다.`,
        '',
        `· ${title}`,
        '',
        '아직 담당자가 없습니다. 확인 후 담당자를 지정해 주세요.',
      ],
      url: absoluteUrl(baseUrl, `/requirements/${requirementId}`),
    }),
  };
}

// 주간 요약 — 그 브랜드의 3차 이상에게, 사람마다 다른 내용으로.
//
// 제목에 손볼 것의 가짓수를 적는다. 메일함 목록에서 제목만 보고 "열어야 하나"를
// 판단할 수 있어야 하는데, '주간 요약'만 있으면 그 판단이 불가능하다.
//
// 본문 맨 위가 '회원님 담당'인 것이 이 메일의 요점이다. 브랜드 전체 현황부터
// 시작하면 받는 사람은 세 줄쯤 읽다가 남의 일이라고 판단한다.
export function weeklyDigestEmail({ brandName, digest, summaryLine, baseUrl }) {
  const where = brandName ? `[${brandName}] ` : '';
  const kinds = digest.sections.length + (digest.mine.length > 0 ? 1 : 0);
  const lines = [summaryLine, ''];

  if (digest.mine.length > 0) {
    lines.push(`■ 회원님 담당 중 지연 ${digest.mine.length}건`);
    for (const m of digest.mine) {
      const over = m.daysOver == null ? '' : ` — ${m.daysOver}일 초과`;
      lines.push(`   · ${m.title} (예상일 ${m.expectedDate ?? '없음'}${over})`);
      lines.push(`     ${absoluteUrl(baseUrl, `/requirements/${m.id}`)}`);
    }
    lines.push('');
  }

  for (const s of digest.sections) {
    lines.push(`■ ${s.label} ${s.count}건`);
    // 앞 섹션과 겹치는 만큼은 제목을 다시 안 편다. 대신 몇 건이 같은
    // 건인지를 말해 준다 — 24와 26의 차이가 무엇인지가 이 줄에서 드러난다.
    if (s.overlap > 0) lines.push(`   (${s.overlap}건은 위에 적은 것과 같은 건입니다)`);
    for (const item of s.items) {
      const waited = item.daysWaiting == null ? '' : ` — ${item.daysWaiting}일째`;
      lines.push(`   · ${item.title} (${item.requestDate ?? '요청일 없음'}${waited})`);
    }
    if (s.more > 0) lines.push(`   · … 외 ${s.more}건`);
    lines.push(`   전체 보기 → ${absoluteUrl(baseUrl, s.href)}`);
    lines.push('');
  }

  return {
    subject: `${SUBJECT_PREFIX} ${where}주간 요약 — 손볼 것 ${kinds}가지`,
    // body 의 url 인자를 안 쓴다. 링크가 섹션마다 따로 있어서 맨 끝에 하나를
    // 더 붙이면 어느 것을 눌러야 하는지가 흐려진다.
    text: body({ lines }),
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
