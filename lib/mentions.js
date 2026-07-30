// 코멘트 @멘션의 순수 로직. 서버(누구에게 알릴지)와 화면(어디를 칠할지,
// 입력창에서 무엇을 보여줄지)이 같은 파일을 쓴다 — 규칙이 갈라지면
// "파랗게 칠해졌는데 알림은 안 왔다"가 생기고, 그때 사람들은 멘션을 못 믿게 된다.
//
// ── 왜 공백으로 자르지 않는가 ────────────────────────────────────────────
// 영어권 구현은 보통 '@' 뒤를 공백까지 잘라 이름으로 쓴다. 한국어는 조사가
// 이름에 붙어서 온다:
//
//     @김관리님이 확인해주세요   → 잘라내면 '김관리님이'
//     @박스파오도 봐주세요       → 잘라내면 '박스파오도'
//
// 둘 다 아무와도 맞지 않는 이름이라 멘션은 조용히 사라진다. 부른 사람은
// 불렀다고 믿고 기다리고, 불린 사람은 아무것도 못 받는다 — 이 기능에서
// 가장 나쁜 실패다.
//
// 그래서 반대로 간다. 본문에서 이름을 잘라내 명부에서 찾는 게 아니라,
// 명부의 이름들을 본문에 대어 본다. '@' 다음 글자부터 시작하는 이름 중
// 가장 긴 것을 고른다. 조사는 이름 뒤에 남으므로 저절로 떨어져 나가고,
// '김민'과 '김민수'가 함께 있어도 '@김민수'는 김민수에게 간다.

// 입력창 드롭다운에 한 번에 띄울 최대 인원. 그 아래는 스크롤해야 보이고,
// 스크롤해야 보이는 후보는 아무도 안 고른다.
export const MENTION_CANDIDATE_LIMIT = 8;

// '@' 앞에 올 수 있는 글자. 글자·숫자·메일 지역부 기호(._+-) 뒤의 '@'는
// 멘션이 아니다 — 본문에 적힌 'a@b.com'이 멘션으로 읽히면, 이름이 겹치는
// 순간 엉뚱한 사람에게 알림이 간다.
const NAME_CHAR = /[\p{L}\p{N}_.+-]/u;

function isMentionStart(text, index) {
  if (index === 0) return true;
  return !NAME_CHAR.test(text[index - 1]);
}

// 이름 없는(또는 이름이 빈) 멤버를 걸러내고 긴 이름부터 세운다.
//
// 빈 이름을 남기면 안 된다. ''.startsWith 는 어느 위치에서나 통과해서,
// '@' 하나가 그 사람 멘션이 되어버린다.
function usableMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .filter((m) => m && typeof m.name === 'string' && m.name.length > 0)
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
}

// 위치 pos 에서 시작하는 가장 긴 이름과, 그 이름을 가진 모든 사람.
//
// 동명이인은 이름만으로 가릴 수 없으므로 전부 돌려준다. 두 사람에게 알리는
// 것이 아무에게도 안 알리는 것보다 낫다 — 헛알림은 무시하면 그만이지만,
// 안 간 알림은 아무도 눈치채지 못한다.
function matchLongest(text, pos, sorted) {
  for (const member of sorted) {
    if (text.startsWith(member.name, pos)) {
      const name = member.name;
      return { name, members: sorted.filter((m) => m.name === name) };
    }
  }
  return null;
}

// 본문을 텍스트/멘션 조각으로 나눈다. 화면은 이 조각으로 React 노드를 만든다
// (dangerouslySetInnerHTML 을 쓰지 않는 이유: 코멘트는 사용자가 쓴 글이다).
//
// members: [{ id, name }]
// 반환: [{ type:'text', text } | { type:'mention', text:'@이름', name, members }]
export function splitMentions(body, members) {
  const text = typeof body === 'string' ? body : '';
  const sorted = usableMembers(members);
  const segments = [];
  let buffer = '';
  let i = 0;

  function flush() {
    if (buffer) {
      segments.push({ type: 'text', text: buffer });
      buffer = '';
    }
  }

  while (i < text.length) {
    if (text[i] === '@' && isMentionStart(text, i)) {
      const matched = sorted.length > 0 ? matchLongest(text, i + 1, sorted) : null;
      if (matched) {
        flush();
        segments.push({
          type: 'mention',
          text: `@${matched.name}`,
          name: matched.name,
          members: matched.members,
        });
        i += 1 + matched.name.length;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  flush();
  return segments;
}

// 이 본문이 부르는 사람들. 등장 순서, 사람(id) 기준 중복 제거.
//
// 같은 사람을 두 번 불러도 알림은 하나여야 한다. 한 번의 코멘트로 벨이 두 번
// 울리면 그 벨은 곧 신뢰를 잃는다.
export function parseMentions(body, members) {
  const seen = new Set();
  const result = [];
  for (const segment of splitMentions(body, members)) {
    if (segment.type !== 'mention') continue;
    for (const member of segment.members) {
      const key = member.id ?? member.name;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(member);
    }
  }
  return result;
}

// 입력창에서 지금 '@...'를 치고 있는가.
//
// 커서 바로 앞에서 뒤로 훑어 '@'를 찾는다. 그 사이에 공백이 있으면 이미 다
// 쓴 멘션이므로 목록을 다시 띄우지 않는다.
//
// 반환: { start, query } — start 는 '@'의 위치(고를 때 갈아끼울 구간의 시작).
export function findMentionQuery(text, caret) {
  if (typeof text !== 'string') return null;
  const pos =
    typeof caret === 'number' && Number.isFinite(caret)
      ? Math.max(0, Math.min(caret, text.length))
      : text.length;

  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '@') {
      // 메일 주소를 치는 도중(a@b)에 목록이 튀어나오면 안 된다.
      if (!isMentionStart(text, i)) return null;
      return { start: i, query: text.slice(i + 1, pos) };
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

// 드롭다운에 띄울 후보. 앞부분이 맞는 사람을 먼저 보여준다 — 사람은 자기가
// 친 글자로 시작하는 이름을 기대한다.
export function filterMentionCandidates(members, query) {
  if (!Array.isArray(members)) return [];
  const q = (query ?? '').toLowerCase();
  const matched = members.filter(
    (m) => m && typeof m.name === 'string' && m.name.toLowerCase().includes(q)
  );
  if (!q) return matched.slice(0, MENTION_CANDIDATE_LIMIT);
  const starts = matched.filter((m) => m.name.toLowerCase().startsWith(q));
  const rest = matched.filter((m) => !m.name.toLowerCase().startsWith(q));
  return [...starts, ...rest].slice(0, MENTION_CANDIDATE_LIMIT);
}

// 아무와도 맞지 않은 '@...' 들.
//
// splitMentions 는 맞은 것만 알려주고 나머지는 그냥 텍스트로 남긴다. 그래서
// 화면만 보면 "안 칠해진 @이름"이 두 가지 뜻을 갖는다 — 부를 수 없는 사람을
// 불렀거나, 하이라이트가 고장났거나. 사용자는 둘을 구분할 수 없다.
//
// 실제로 이런 일이 있었다. 미쏘 소속인 사람을 스파오 요구사항에서 '@'로
// 불렀는데(그 브랜드에서는 부를 수 없는 사람이다) 화면은 아무 말도 하지
// 않았다. 부른 사람은 불렀다고 믿고 기다린다.
//
// 그래서 맞지 않은 시도를 따로 모아 입력창에서 미리 경고한다. 등록하기 전에
// 알려주는 것이 요점이다 — 등록한 뒤에 알려주면 이미 늦었다.
//
// 반환: ['가입테스트', ...] (등장 순서, 중복 제거)
export function findUnmatchedMentions(body, members) {
  const text = typeof body === 'string' ? body : '';
  const sorted = usableMembers(members);
  const seen = new Set();
  const result = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] !== '@' || !isMentionStart(text, i)) {
      i += 1;
      continue;
    }
    // 맞는 이름이 있으면 경고할 일이 없다. 그만큼 건너뛴다.
    const matched = sorted.length > 0 ? matchLongest(text, i + 1, sorted) : null;
    if (matched) {
      i += 1 + matched.name.length;
      continue;
    }
    // 이름으로 쓰였을 만한 글자들을 그대로 걷어 온다. 조사가 섞여 들어오지만,
    // 경고는 "이 이름으로는 아무도 못 찾았다"를 말하는 것이므로 사용자가 실제로
    // 친 글자를 그대로 보여주는 편이 낫다.
    let j = i + 1;
    while (j < text.length && NAME_CHAR.test(text[j])) j += 1;
    const attempted = text.slice(i + 1, j);
    // '@' 하나만 있거나 뒤가 공백이면 아직 쓰는 중이다 — 경고하지 않는다.
    if (attempted && !seen.has(attempted)) {
      seen.add(attempted);
      result.push(attempted);
    }
    i = j > i ? j : i + 1;
  }
  return result;
}
