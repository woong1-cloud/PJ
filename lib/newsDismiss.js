// 소식 팝업을 띄울지.
//
// 이 파일이 있는 이유: "닫았다"에는 두 가지가 있다.
//
//   확인했습니다  — 읽었다. 안 읽음 표시(점)까지 없어져야 한다.
//   X · Esc · 바깥 — 지금은 안 읽겠다. 팝업만 멈추고 점은 남아야 한다.
//
// 예전에는 둘을 구분하지 않고 똑같이 news_seen_at 을 찍었다. 그래서 반사적으로
// X 를 누른 사람은 팝업도 점도 함께 잃었고, 무엇이 바뀌었는지 알 길이 통째로
// 없어졌다 — 소식을 만든 이유가 그 자리에서 사라진 셈이다.
//
// 서버 컬럼을 늘리지 않는다. 점은 여전히 news_seen_at 하나로 정하고, 팝업
// 억제만 브라우저에 둔다. 브라우저마다 다르게 기억되지만 그래도 된다 — 잘못
// 되는 쪽이 "팝업을 한 번 더 본다" 이고, 그건 가볍다.
export const NEWS_DISMISS_KEY = 'moa.news.dismissed';

// 저장하는 값이 불린이 아니라 날짜인 것이 요점이다.
//
// 불린으로 두면 한 번 X 한 사람에게 다음 배포의 팝업도 영영 안 뜬다. 날짜로
// 두면 "그때까지는 됐다"는 뜻이 되어, 그보다 새 소식이 나오면 다시 뜬다.
//
// unseen: unseenNews() 결과(날짜 내림차순)
// dismissedDate: 'YYYY-MM-DD' 또는 null
export function shouldOpenDialog(unseen, dismissedDate) {
  const items = Array.isArray(unseen) ? unseen : [];
  if (items.length === 0) return false;
  // 읽을 수 없는 값은 안 닫힌 것으로 본다. 한 번 더 보는 쪽이 영영 못 보는
  // 쪽보다 가볍다.
  if (typeof dismissedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dismissedDate)) return true;
  return items[0].date > dismissedDate;
}

// 아래 둘은 localStorage 를 감싼 얇은 래퍼다. 사생활 보호 모드처럼 접근
// 자체가 던지는 환경이 있어서 try/catch 가 필요하고, 그 때문에 순수 함수와
// 섞이지 않게 따로 둔다.
export function readDismissed() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(NEWS_DISMISS_KEY);
  } catch {
    return null;
  }
}

export function writeDismissed(date) {
  if (typeof window === 'undefined' || !date) return;
  try {
    window.localStorage.setItem(NEWS_DISMISS_KEY, date);
  } catch {
    // 저장 못 해도 그만이다. 다음에 팝업을 한 번 더 볼 뿐이다.
  }
}
