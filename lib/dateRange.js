// 요청일 범위 필터의 계산.
//
// 기획자가 목록을 볼 때 가장 먼저 묻는 것이 "언제 들어온 요청인가" 다.
// 지금은 그 축으로 좁힐 방법이 없어서, 요청일 정렬을 눈으로 훑어야 한다.
//
// 순수 함수다. today 를 인자로 받고 Date.now() 를 부르지 않는다 — 서버는 UTC
// 라 그대로 쓰면 한국 시각으로 자정 직후에 "이번 주"가 어제로 잡힌다. 기준을
// 정하는 일은 부르는 쪽(todayInKst)이 하고, 여기는 셈만 한다.

// 아는 키만 통과시킨다. 주소를 손으로 고쳐 아무 값이나 넣는 길을 열어 두지
// 않는다 — 모르는 키는 null 이고, 부르는 쪽은 그때 필터를 안 건다.
export const REQUEST_RANGES = ['thisWeek', 'thisMonth', 'lastMonth', 'last3Months'];

export const REQUEST_RANGE_LABELS = {
  thisWeek: '이번 주',
  thisMonth: '이번 달',
  lastMonth: '지난 달',
  last3Months: '최근 3개월',
};

// 'YYYY-MM-DD' → UTC 자정 Date. 시간대를 태우지 않기 위해 UTC 로만 다룬다.
// Date('2026-08-28') 도 UTC 로 읽히지만, 여기서는 형식이 틀린 값을 걸러야 해서
// 직접 뜯는다.
function parse(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 2026-02-30 같은 값은 3월로 넘어간다. 넘어갔다는 것은 그런 날이 없다는 뜻이다.
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function fmt(dt) {
  return dt.toISOString().slice(0, 10);
}

function addDays(dt, n) {
  return new Date(dt.getTime() + n * 86400000);
}

// key + 오늘 → { from, to }. 둘 다 'YYYY-MM-DD' 이고 양끝을 포함한다
// (request_date 가 date 타입이라 gte/lte 로 그대로 건다).
export function requestDateRange(key, today) {
  const now = parse(today);
  if (!now || !REQUEST_RANGES.includes(key)) return null;

  const to = fmt(now);

  if (key === 'thisWeek') {
    // 월요일 시작이다. getUTCDay() 는 일요일이 0 이라 일요일을 7 로 바꿔서
    // 센다 — 안 그러면 일요일에 "이번 주"가 내일부터 시작한다.
    const dow = now.getUTCDay() || 7;
    return { from: fmt(addDays(now, 1 - dow)), to };
  }

  if (key === 'thisMonth') {
    return { from: `${to.slice(0, 7)}-01`, to };
  }

  if (key === 'lastMonth') {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    // 이번 달 0일 = 지난달 말일. 28·30·31 을 따로 셀 필요가 없고 윤년도 맞는다.
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    return { from: fmt(first), to: fmt(last) };
  }

  // last3Months. 달 수로 빼지 않고 90일로 센다. "3개월 전"이 5월 31일에서
  // 2월 31일이 되는 문제를 아예 만들지 않는다.
  return { from: fmt(addDays(now, -90)), to };
}
