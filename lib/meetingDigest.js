import { STALL_DAYS, groupByRequirement, stalledDays } from './stalled';

// 한 블록에 제목으로 펼칠 건수. 나머지는 '외 N건'으로 접는다.
//
// weeklyDigest 의 TOP_N 과 같은 값이고 같은 이유다 — 25건을 전부 펴면 그건
// 목록이지 안건이 아니다. 사람이 한 번에 집어 드는 일의 수가 그 언저리다.
export const TOP_N = 5;

// '이번 주'의 길이. 회의가 주 1회라 지난 한 주다.
const PERIOD_DAYS = 7;

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

function block(rows, mapper) {
  return {
    count: rows.length,
    items: rows.slice(0, TOP_N).map(mapper),
    // 화면이 '외 N건'을 쓸지 여기서 정해 준다. 부르는 쪽이 매번 빼기를 하면
    // 한 곳에서 틀린다.
    more: Math.max(0, rows.length - TOP_N),
  };
}

// 회의 안건 하나를 만든다.
//
// requirements: 그 브랜드의 요구사항 전부(종결 포함). 종결 여부는 stalledDays 가
//   본다 — 여기서 미리 거르면 '이번 주 움직인 것'에서 완료 건이 사라진다.
// changeLogs / comments: 그 브랜드 전체 것. 건별로 나누는 일은 이 함수가 한다.
// now: ISO 문자열.
//
// 블록 간 중복 제거를 하지 않는다. weeklyDigest 에서는 세 섹션의 상위 5건이
// 글자까지 같아지는 문제가 있어 seen 으로 걸렀는데, 여기서는 세 블록이 성격상
// 겹치지 않는다 — 이번 주 들어온 건이 14일 멈춰 있을 수 없다.
export function buildMeetingDigest({
  requirements = [],
  changeLogs = [],
  comments = [],
  now,
} = {}) {
  const reqs = Array.isArray(requirements) ? requirements : [];
  const logsBy = groupByRequirement(changeLogs);
  const commentsBy = groupByRequirement(comments);

  const nowMs = Date.parse(now ?? '');
  const sinceMs = Number.isFinite(nowMs) ? nowMs - PERIOD_DAYS * 86400000 : null;

  // ① 멈춘 것.
  //
  // 담당 없는 것을 앞에 두는 이유: 담당이 없으면 예상일도 티켓도 나올 수 없다.
  // 회의가 먼저 손대야 할 것이 그쪽이고, 나머지는 담당자가 정해진 뒤에야
  // 누군가의 할 일이 된다. weeklyDigest 가 '담당자 없는 검토대기'를 맨 앞
  // 섹션으로 둔 것과 같은 판단이다.
  const stalledRows = reqs
    .map((r) => ({
      r,
      days: stalledDays({
        requirement: r,
        changeLogs: logsBy.get(r.id) ?? [],
        comments: commentsBy.get(r.id) ?? [],
        now,
      }),
    }))
    .filter((x) => x.days !== null && x.days >= STALL_DAYS)
    .sort((a, b) => {
      const av = idOf(a.r.assignee) ? 1 : 0;
      const bv = idOf(b.r.assignee) ? 1 : 0;
      if (av !== bv) return av - bv;
      return b.days - a.days;
    });

  const stalled = block(stalledRows, (x) => ({
    id: x.r.id,
    title: x.r.title,
    status: x.r.status,
    stalledDays: x.days,
    hasAssignee: Boolean(idOf(x.r.assignee)),
  }));
  // 접힌 것까지 포함한 전체 수다. 메일 제목 옆에 "(담당 없음 N건)"으로 붙는데,
  // 펼친 다섯 건만 세면 그 숫자가 화면과 어긋난다.
  stalled.unassigned = stalledRows.filter((x) => !idOf(x.r.assignee)).length;

  // ② 이번 주 새로 들어온 것.
  const incomingRows =
    sinceMs === null
      ? []
      : reqs.filter((r) => {
          const ms = Date.parse(r.created_at ?? '');
          return Number.isFinite(ms) && ms >= sinceMs;
        });
  const incoming = block(incomingRows, (r) => ({ id: r.id, title: r.title, status: r.status }));

  // ③ 이번 주 움직인 것.
  //
  // field_name 으로 거른다. change_type 으로 거르면 안 된다 — 상태 변경은
  // '상태변경'과 '중복병합' 두 종류를 쓴다(lib/statusDurations.js 의 같은
  // 주석). change_type='상태변경'만 보면 병합된 건이 통째로 빠진다.
  const movedIds = new Set();
  if (sinceMs !== null) {
    for (const log of changeLogs ?? []) {
      if (log?.field_name !== 'status') continue;
      const ms = Date.parse(log.created_at ?? '');
      if (Number.isFinite(ms) && ms >= sinceMs) movedIds.add(log.requirement_id);
    }
  }
  const movedRows = reqs.filter((r) => movedIds.has(r.id));
  const moved = block(movedRows, (r) => ({ id: r.id, title: r.title, status: r.status }));

  // 보낼 값어치가 있는가.
  //
  // ③만 있는 주는 잘 굴러간 주라서 안건이 없다. 안건 없는 메일이 오기
  // 시작하면 정작 밀린 주에도 안 열린다.
  const hasContent = stalled.count > 0 || incoming.count > 0;

  return { hasContent, stalled, incoming, moved };
}
