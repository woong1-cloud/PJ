import { STALL_DAYS } from './stalled';

// 알림 메일의 제목·본문. 순수 함수라 테스트가 붙는다.
//
// 인앱 알림 문구(lib/notifications.js)를 그대로 쓰지 않는다. 벨에서는 한 줄이
// 곧 전부지만, 메일은 제목만 보고 열지 말지 정한다 — 제목에 "무엇에 대한
// 것인지"가 들어가야 하고, 본문에는 눌러서 갈 링크가 있어야 한다.

// 메일로 내보내는 사건.
//
// 인앱 알림은 상태변경·코멘트까지 넷이지만, 그걸 다 메일로 보내면 하루 수십
// 통이 되고 사람들은 규칙을 걸어 자동 분류해 버린다. 그 순간 메일 알림은
// 아무 일도 하지 않으면서 서버만 쓴다. 밀어내는 채널에는 "지금 당신이 뭘
// 해야 하는" 것만 싣는다.
//
// 2026-08 에 둘을 의도적으로 늘렸다. 운영 2주 데이터에서 인앱 알림 110건 중
// 105건이 안 읽혔다 — 사내에서 매일 보는 통로가 메일뿐이라, 회의와 그 결과는
// 메일로 나가야 도달한다.
//   회의안건  주 1회  수요일. 브랜드당 한 통
//   회의배정  주 1회  회의를 마칠 때. 요청자당 한 통, 여러 건을 묶어서
// 둘 다 주 1회 상한이 있다. 사건마다 나가는 것이 아니라 회의라는 자리에
// 묶여 있어서, 늘어나 봐야 한 사람당 주 2통이다.
//
// '주간요약'은 여기 없다. weeklyDigestEmail 코드는 남아 있지만 회의안건이
// 같은 목록을 다루므로 스케줄을 껐다 — 같은 것을 주 2회 받으면 둘 다 안 읽는다.
export const EMAIL_EVENTS = ['배치대기', '담당자지정', '멘션', '회의안건', '회의배정'];

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
export function signupEmail({ name, organizationName, baseUrl }) {
  const who = name ?? '새 사용자';
  const where = organizationName ?? '소속 미상';
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

// 회의 안건 메일. 수요일 오후에 그 브랜드 3차 이상에게 한 통씩 나간다.
//
// 개인화하지 않는다. 주간 요약은 맨 위에 '회원님 담당 중 지연'을 두었지만,
// 이건 같은 자료를 같이 보고 논의하는 것이라 사람마다 다르면 회의에서
// "제 메일에는 그게 없는데요"가 나온다.
//
// 제목은 멈춘 것과 신규를 나눠 적는다.
//
// 실데이터로 렌더해 보고 고친 자리다. 처음에는 둘을 더해 '안건 18건'이라고
// 적었는데, 그중 6건은 이번 주 새로 들어온 것이라 회의에서 훑기만 하면 되는
// 것이었다. 논의할 것이 12건인데 18건이라고 하면 제목이 과장이 되고, 그런
// 제목이 몇 번 반복되면 숫자를 안 믿게 된다.
export function meetingDigestEmail({ brandName, meetingDate, digest, baseUrl }) {
  const where = brandName ? `[${brandName}] ` : '';
  const counts = [
    digest.stalled.count > 0 ? `멈춘 것 ${digest.stalled.count}건` : null,
    digest.incoming.count > 0 ? `신규 ${digest.incoming.count}건` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const lines = [`${meetingDate ? `${meetingDate} ` : ''}회의 전에 한 번 봐 주세요.`, ''];

  if (digest.stalled.count > 0) {
    // 담당 없는 수를 제목이 아니라 여기 붙인다. 이 한 줄이 회의의 첫 안건이다.
    const tail = digest.stalled.unassigned > 0 ? ` (담당 없음 ${digest.stalled.unassigned}건)` : '';
    lines.push(`■ ${STALL_DAYS}일 넘게 멈춘 것 ${digest.stalled.count}건${tail}`);
    for (const item of digest.stalled.items) {
      lines.push(`   · ${item.title} — ${item.stalledDays}일 멈춤${item.hasAssignee ? '' : ', 담당 없음'}`);
    }
    if (digest.stalled.more > 0) lines.push(`   · … 외 ${digest.stalled.more}건`);
    lines.push('');
  }

  if (digest.incoming.count > 0) {
    lines.push(`■ 이번 주 새로 들어온 것 ${digest.incoming.count}건`);
    for (const item of digest.incoming.items) lines.push(`   · ${item.title}`);
    if (digest.incoming.more > 0) lines.push(`   · … 외 ${digest.incoming.more}건`);
    lines.push('');
  }

  // 움직인 것은 안건이 아니라 맥락이다. 이게 있어야 "밀린 것"이 늘고 있는지
  // 줄고 있는지 읽힌다 — 멈춘 수만 있으면 그게 좋은 건지 나쁜 건지 모른다.
  if (digest.moved.count > 0) {
    lines.push(`■ 이번 주 움직인 것 ${digest.moved.count}건`);
    for (const item of digest.moved.items) lines.push(`   · ${item.title} — ${item.status}`);
    if (digest.moved.more > 0) lines.push(`   · … 외 ${digest.moved.more}건`);
    lines.push('');
  }

  return {
    subject: `${SUBJECT_PREFIX} ${where}주간회의 · ${counts}`,
    // 마지막 블록이 남긴 빈 줄을 떼고 넘긴다. body 가 url 앞에 빈 줄을 하나
    // 더 넣으므로, 안 떼면 본문 끝에 빈 줄이 둘 생긴다.
    text: body({ lines: trimTrailingBlank(lines), url: absoluteUrl(baseUrl, '/meeting') }),
  };
}

function trimTrailingBlank(lines) {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out;
}

// 회의에서 배정된 건을 요청자에게 알리는 메일.
//
// 건별이 아니라 묶어 보낸다. 한 사람이 10건을 올린 적이 있고, 그 사람이 회의
// 한 번에 10통을 받으면 그때부터 이 메일은 규칙으로 걸러진다.
//
// 이 메일이 이 앱에서 요청자에게 가는 유일한 메일이다. 운영 2주 시점에 가장
// 많이 올린 세 사람이 26일째 로그인하지 않았다 — 자기가 올린 것이 어떻게
// 됐는지 알 방법이 앱에 들어오는 것뿐이었기 때문이다.
export function assignedBatchEmail({ items, baseUrl }) {
  const lines = [`올리신 요구사항 ${items.length}건에 담당자가 정해졌습니다.`, ''];
  for (const item of items) {
    const tail = [
      item.assigneeName ? `담당 ${item.assigneeName}` : null,
      item.expectedDate ? `예상 ${item.expectedDate}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`   · ${item.title}${tail ? ` — ${tail}` : ''}`);
  }

  return {
    subject: `${SUBJECT_PREFIX} 올리신 요구사항 ${items.length}건에 담당자가 정해졌습니다`,
    text: body({ lines, url: absoluteUrl(baseUrl, '/requirements') }),
  };
}
