// 인앱 알림의 순수 로직. 서버(수신자 판정·문구 생성)와 화면(시각 표시)이
// 같은 파일을 쓴다 — 두 곳이 서로 다른 규칙을 갖게 되면 "벨에는 떴는데 왜
// 나한테 왔지" 같은 질문이 생긴다.

// 한 번에 내려주는 알림 개수. 드롭다운은 좁고, 그 아래는 아무도 안 본다.
export const NOTIFICATION_LIMIT = 30;

// 드롭다운 한 줄에 들어갈 만큼만 제목을 남긴다.
const MAX_TITLE = 40;

// requester/assignee 는 서버에서 읽으면 uuid 문자열, embed 를 걸고 읽으면
// {id, name} 이다. 한쪽 모양만 아는 함수는 다른 쪽에서 조용히 틀린다.
function memberIdOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 이 요구사항으로 알림을 받을 사람들.
//
// 범위는 "개인적으로 걸려 있는 사람"뿐이다 — 요청자와 담당자. 브랜드 전체나
// 등급으로 뿌리면 하루에 수십 개가 쌓이고, 그 순간 벨은 아무도 안 보는 장식이 된다.
//
// 두 가지 규칙이 여기 산다:
//  1) 행위자 본인은 절대 넣지 않는다. 내 건에 내가 코멘트를 달고 알림이 오면
//     사람들은 하루 만에 벨을 신뢰하지 않게 된다.
//  2) 요청자이면서 담당자인 사람은 한 사건에 하나만 받는다.
//
// actorId 를 모르면 (1)을 지킬 수 없으므로 빈 배열을 돌려준다. 알림이 안 가는
// 것보다 본인에게 가는 것이 더 나쁘다.
export function resolveRecipients(requirement, actorId) {
  if (!actorId) return [];
  const candidates = [memberIdOf(requirement?.requester), memberIdOf(requirement?.assignee)];
  const recipients = [];
  for (const id of candidates) {
    if (!id || id === actorId || recipients.includes(id)) continue;
    recipients.push(id);
  }
  return recipients;
}

// 코멘트 하나가 만드는 알림 목록.
//
// resolveRecipients(요청자·담당자)에 "본문에서 불린 사람"을 더한다. 멘션의
// 요점이 이것이다 — 요청자도 담당자도 아닌 사람을 부를 수 있어야 부르는
// 의미가 있다.
//
// 두 규칙은 그대로 지킨다:
//  1) 행위자 본인은 자기를 불러도 받지 않는다. 팀 전체를 나열하다 자기 이름을
//     넣는 일은 실제로 잦고, 그때 나에게 알림이 오면 벨은 장식이 된다.
//  2) 한 사람은 한 코멘트에 알림 하나다. 담당자를 부르는 경우가 흔한데
//     여기서 합치지 않으면 벨이 두 번 울린다.
//
// mentioned 플래그를 함께 돌려주는 이유: 불려서 온 알림과 그냥 코멘트 알림은
// 눌러야 할 이유가 다르다. 문구를 나누려면 부르는 쪽이 어느 쪽인지 알아야 한다.
//
// 반환: [{ id, mentioned }]
export function commentRecipients(requirement, actorId, mentionedIds = []) {
  if (!actorId) return [];
  const mentioned = new Set(
    (Array.isArray(mentionedIds) ? mentionedIds : []).filter((id) => id && id !== actorId)
  );

  const recipients = resolveRecipients(requirement, actorId).map((id) => ({
    id,
    mentioned: mentioned.has(id),
  }));

  const already = new Set(recipients.map((r) => r.id));
  for (const id of mentioned) {
    if (already.has(id)) continue;
    already.add(id);
    recipients.push({ id, mentioned: true });
  }
  return recipients;
}

// 조사 '로/으로'. 받침이 없거나 ㄹ 받침이면 '로', 그 밖에는 '으로'다.
// '완료으로' 같은 문구는 한 번만 봐도 앱이 대충 만들어졌다는 인상을 준다.
export function roParticle(word) {
  const last = typeof word === 'string' ? word.at(-1) : null;
  if (!last) return '로';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '로'; // 한글 음절이 아니면 기본값
  const jongseong = (code - 0xac00) % 28;
  return jongseong === 0 || jongseong === 8 ? '로' : '으로'; // 8 = ㄹ
}

export function truncateTitle(title, max = MAX_TITLE) {
  if (typeof title !== 'string' || !title) return '';
  return title.length <= max ? title : `${title.slice(0, max)}…`;
}

// 이름을 못 찾았을 때 "님이 ..." 로 시작하는 문장이 나가면 안 된다.
function actorPhrase(actorName) {
  return actorName ? `${actorName}님이` : '누군가';
}

export function commentMessage(actorName, title) {
  return `${actorPhrase(actorName)} '${truncateTitle(title)}'에 코멘트를 남겼습니다`;
}

// 코멘트에서 이름이 불렸을 때. 코멘트 알림과 문구를 나누는 이유는 벨에서
// "나를 부른 그 코멘트"가 한눈에 보여야 하기 때문이다.
export function mentionMessage(actorName, title) {
  return `${actorPhrase(actorName)} '${truncateTitle(title)}' 코멘트에서 회원님을 언급했습니다`;
}

export function statusMessage(actorName, title, status) {
  return `${actorPhrase(actorName)} '${truncateTitle(title)}' 상태를 '${status}'${roParticle(
    status
  )} 바꿨습니다`;
}

export function assigneeMessage(actorName, title, assigneeName) {
  const who = assigneeName ? ` ${assigneeName}님으로` : '';
  return `${actorPhrase(actorName)} '${truncateTitle(title)}' 담당자를${who} 지정했습니다`;
}

// 배치 대기(가입 신청) 알림.
//
// 다른 알림과 달리 요구사항이 없다. 문구가 "무엇을 해야 하는가"로 끝나야
// 하는 이유가 여기 있다 — 벨에서 이걸 본 관리자는 읽고 넘길 게 아니라
// 배치를 하러 가야 한다.
export function signupMessage(name, affiliation, brandName) {
  const who = name ? `${name}님이` : '새 사용자가';
  // 브랜드 소속이면 어느 브랜드인지가 배치 판단의 절반이다.
  const where = brandName ? `${brandName}(${affiliation ?? '브랜드'})` : (affiliation ?? '');
  const scope = where ? ` ${where} 소속으로` : '';
  return `${who}${scope} 가입했습니다 — 배치가 필요합니다`;
}

// 알림을 눌렀을 때 갈 곳.
//
// link 가 우선이다. 예전 알림에는 link 가 없으므로 requirement_id 로 떨어지고,
// 둘 다 없으면 읽음 처리만 하고 만다(null).
export function notificationHref(notification) {
  if (notification?.link) return notification.link;
  if (notification?.requirement_id) return `/requirements/${notification.requirement_id}`;
  return null;
}

// link 컬럼이 없는 DB 인지 판정한다.
//
// 이 함수가 따로 있는 이유는 여기서 실제로 사고가 났기 때문이다. 예전 코드는
// '42703' 하나만 봤는데, 그건 SELECT 로 없는 컬럼을 읽을 때 Postgres 가 내는
// 코드다. INSERT 는 PostgREST 를 지나므로 'PGRST204' 가 온다 —
//   Could not find the 'link' column of 'in_app_notifications' in the schema cache
//
// 그래서 폴백이 걸리지 않았고, insert 가 그대로 던져서 가입 알림이 인앱도
// 메일도 나가지 못했다(메일 발송이 insert 뒤에 있었다). 두 코드 다 봐야 한다.
export const MISSING_COLUMN_CODES = ['42703', 'PGRST204'];

export function shouldRetryWithoutLink(error, rows = []) {
  if (!error) return false;
  if (!MISSING_COLUMN_CODES.includes(error.code)) return false;
  return rows.some((row) => row && 'link' in row);
}

// 드롭다운의 시각 표시. 알림은 "언제"보다 "얼마나 전"이 중요해서 일주일까지는
// 상대 시간으로, 그 뒤로는 날짜로 보여준다.
export function relativeTime(iso, now = new Date()) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diffMs = now.getTime() - then.getTime();
  // 서버와 브라우저 시계가 조금 어긋나면 미래 시각이 온다. '-1분 전'은 버그로 보인다.
  const minutes = Math.floor(Math.max(diffMs, 0) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${then.getMonth() + 1}월 ${then.getDate()}일`;
}
