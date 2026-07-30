import { CLOSED_STATUSES } from './statuses';

// 날짜는 'YYYY-MM-DD' 문자열이다. 이 형식은 사전순 비교가 곧 날짜순 비교라
// Date 객체로 바꾸지 않는다 — 시간대 때문에 하루가 밀리는 사고를 피할 수 있다.
export function isOverdue(expectedDate, status, todayIso) {
  if (!expectedDate) return false;
  // 종결된 건은 더 진행될 일이 없으므로 지연이 아니다. 반려된 건이 빨갛게
  // "지연"으로 뜨면 아무도 하지 않기로 한 일을 독촉하는 화면이 된다.
  if (CLOSED_STATUSES.includes(status)) return false;
  return expectedDate < todayIso;
}

// '오늘'을 지역 시간 기준으로 만든다.
//
// toISOString()을 쓰면 UTC가 나온다. 한국은 UTC+9라 자정부터 오전 9시 사이에는
// 하루 전 날짜가 잡히고, 어제가 예상일인 건이 오전 내내 '지연'으로 안 뜬다.
// 하루에 9시간씩 틀리는 지연 표시는 아무도 믿지 않게 된다.
export function toLocalDateString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
