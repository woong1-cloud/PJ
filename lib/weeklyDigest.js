// 주간 요약 메일의 내용을 만드는 순수 로직.
//
// 왜 요약인가. 방치된 건마다 리마인더를 보내면 지금 당장 25통이 나간다. 그
// 순간 사람들은 규칙을 만들어 걸러 버리고, 그러면 접수 알림까지 같이 죽는다.
// 어제 만든 것을 스스로 무력화하는 셈이다.
//
// 접수 알림과 역할이 갈린다:
//   접수 알림  실시간  "새로 올라왔다"
//   주간 요약  주 1회  "쌓여 있다"
// 이 둘 사이에 개별 리마인더가 낄 자리가 없다.
//
// 숫자만 나열하지 않는 것이 이 파일의 요점이다. '검토대기 25건'만 적힌 메일은
// 세 주면 아무도 안 읽는다 — 어디부터 손대야 할지가 없기 때문이다. 그래서
// 오래된 순 상위 몇 건은 제목과 링크로 편다.

import { ACTION_PREDICATES } from './dashboardStats';
import { unlinkedHandoffs } from './redmineLink';
import { DONE_STATUS } from './statuses';
import { isOverdue } from './overdue';

// 한 섹션에 제목으로 펼칠 건수. 나머지는 '외 N건'으로 접는다.
//
// 다섯인 이유: 메일 한 화면에 세 섹션이 들어가야 하고, 사람이 한 번에 집어
// 드는 일의 수가 그 언저리다. 25건을 전부 펼치면 그건 목록이지 요약이 아니다.
export const TOP_N = 5;

// 지난 며칠을 '이번 주'로 볼 것인가. 월요일에 보내므로 지난 7일이다.
const PERIOD_DAYS = 7;

function daysSince(dateStr, today) {
  if (!dateStr || !today) return null;
  const from = new Date(`${dateStr}T00:00:00Z`);
  const to = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((to - from) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

function shiftDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : (value.id ?? null);
}

// 오래 기다린 순으로 정렬해 상위 몇 건만 편다.
//
// 요청일이 없는 건은 뒤로 보낸다. 정렬 키가 없다고 맨 앞에 오면, 가장 급한
// 자리를 정보가 제일 적은 건이 차지한다.
//
// seen: 앞 섹션들에 이미 들어간 요구사항 id.
//
// 섹션들이 서로 겹친다. 담당자가 없으면 예상일도 대개 없어서, 실데이터에서
// '담당자 없는 검토대기 24건'과 '예상일 없는 진행 건 26건'의 상위 다섯 건이
// 글자 하나까지 같았다. 같은 제목을 두 번 읽으면 두 번째 섹션은 새 정보가
// 없는 것으로 읽히고, 실제로도 그렇다.
//
// 그래서 개수(count)는 그대로 두고 — 대시보드와 어긋나면 안 된다 — 펼치는
// 것만 앞에 안 나온 건으로 고른다. 겹친 수는 따로 알려준다. 그러면 24와 26의
// 차이가 정확히 무엇인지가 그 줄 하나로 드러난다.
function section({ key, label, href, rows, today, seen }) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const av = a.request_date ?? '9999-12-31';
    const bv = b.request_date ?? '9999-12-31';
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  const fresh = sorted.filter((r) => !seen.has(r.id));
  for (const r of sorted) seen.add(r.id);

  return {
    key,
    label,
    href,
    count: sorted.length,
    // 앞 섹션과 겹친 건수. 0이면 화면이 이 줄을 안 그린다.
    overlap: sorted.length - fresh.length,
    items: fresh.slice(0, TOP_N).map((r) => ({
      id: r.id,
      title: r.title,
      requestDate: r.request_date ?? null,
      daysWaiting: daysSince(r.request_date, today),
    })),
    // 화면이 '외 N건'을 쓸지 말지 여기서 정해 준다. 부르는 쪽이 매번
    // 빼기를 하면 한 곳에서 틀린다. 겹친 것은 위에서 이미 말했으므로
    // 여기서는 '아직 안 보여 준 것'만 센다.
    more: Math.max(0, fresh.length - TOP_N),
  };
}

// 한 사람에게 보낼 요약 하나.
//
// 개인화가 한 겹 들어간다. 맨 위에 '회원님 담당 중 지연'을 두면 받는 사람이
// 자기 일을 먼저 보게 되고, 그러면 나머지도 남의 일로 읽히지 않는다.
//
// requirements: 그 브랜드의 요구사항 전부(종결 포함).
//   [{ id, title, status, assignee, requester, request_date, expected_release_date,
//      redmine_url, completed_at }]
// memberId: 받는 사람. null 이면 개인화 없이 브랜드 전체만 담는다.
export function buildWeeklyDigest({ requirements = [], memberId = null, today } = {}) {
  const reqs = Array.isArray(requirements) ? requirements : [];
  const since = today ? shiftDays(today, -PERIOD_DAYS) : null;

  // 지난 한 주의 흐름. 이 두 줄이 있어야 "밀린 것"이 늘고 있는지 줄고 있는지
  // 읽힌다 — 숫자 하나만 있으면 그게 좋은 건지 나쁜 건지 알 수 없다.
  const newCount = since ? reqs.filter((r) => r.request_date && r.request_date >= since).length : 0;
  const doneCount = since
    ? reqs.filter((r) => r.status === DONE_STATUS && (r.completed_at ?? '').slice(0, 10) >= since)
        .length
    : 0;

  // 내 담당 중 지연. isOverdue 가 종결 건을 걸러 내므로 여기서 또 걸지 않는다.
  const mine = memberId
    ? reqs
        .filter(
          (r) =>
            idOf(r.assignee) === memberId && isOverdue(r.expected_release_date, r.status, today)
        )
        .map((r) => ({
          id: r.id,
          title: r.title,
          expectedDate: r.expected_release_date,
          daysOver: daysSince(r.expected_release_date, today),
        }))
        .sort((a, b) => (b.daysOver ?? 0) - (a.daysOver ?? 0))
    : [];

  // 섹션 순서가 곧 우선순위다. 앞 섹션에 나온 건은 뒤 섹션에서 다시 펼치지
  // 않으므로(seen), 가장 먼저 손대야 할 것이 앞에 와야 한다.
  //
  // 담당자 지정이 맨 앞인 이유: 담당자가 없으면 예상일도 레드마인 티켓도 나올
  // 수 없다. 나머지 둘은 담당자가 정해진 뒤에야 누군가의 할 일이 된다.
  const seen = new Set();
  const sections = [
    section({
      key: 'unassignedReview',
      label: '담당자 없는 검토대기',
      href: '/requirements?status=검토대기&missing=assignee',
      rows: reqs.filter(ACTION_PREDICATES.unassignedReview),
      today,
      seen,
    }),
    section({
      key: 'noExpectedDate',
      label: '예상 배포일 없는 진행 건',
      href: '/requirements?missing=expectedDate',
      rows: reqs.filter(ACTION_PREDICATES.noExpectedDate),
      today,
      seen,
    }),
    section({
      key: 'unlinkedHandoff',
      label: '레드마인에 안 넘어간 진행 건',
      href: '/requirements?missing=redmine',
      rows: unlinkedHandoffs(reqs),
      today,
      seen,
    }),
  ].filter(Boolean);

  // 보낼 값어치가 있는가.
  //
  // 손볼 것이 하나도 없으면 안 보낸다. "이번 주 0건" 메일이 오기 시작하면
  // 그 순간부터 이 메일은 노이즈가 되고, 정작 밀린 주에도 안 열린다.
  //
  // 지난주 활동만 있는 경우(새 요구사항 4건, 손볼 것 0)도 안 보낸다. 그건
  // 보고서지 할 일이 아니고, 그 숫자는 대시보드에 늘 있다.
  const hasContent = sections.length > 0 || mine.length > 0;

  return { hasContent, newCount, doneCount, mine, sections };
}

// 활동 요약 한 줄. 메일 첫 줄과 인앱 문구가 같은 문장을 쓰도록 여기 둔다.
export function digestSummaryLine({ newCount = 0, doneCount = 0 } = {}) {
  if (newCount === 0 && doneCount === 0) return '지난 한 주 새 요구사항과 완료 건이 없었습니다.';
  return `지난 한 주 새 요구사항 ${newCount}건, 완료 ${doneCount}건.`;
}
