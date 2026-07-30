// 외부 링크 주소 검증.
//
// 여기를 통과한 값은 상세 화면에서 <a href> 로 그대로 들어간다. 그래서 스킴
// 검사가 이 파일의 존재 이유다 — javascript:alert(1) 이 저장되면 링크를 누른
// 사람의 세션에서 스크립트가 실행된다.
//
// 허용 목록으로 막는다. 금지 목록('javascript 로 시작하면 거절')은 새 스킴이
// 생기거나 파서가 공백·탭을 다르게 다룰 때마다 뚫린다.
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// 스킴이 있는지부터 본다. try { new URL(x) } 가 실패하면 https:// 를 붙여
// 다시 해보는 방식은 'https://' 하나만 들어왔을 때 'https://https://' 가
// 되어 host 가 'https' 인 멀쩡한 주소로 통과해 버린다.
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

// 정상이면 정규화된 주소 문자열을, 아니면 null 을 돌려준다.
export function normalizeUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 스킴이 없으면 https 로 본다. 이때 원문에 스킴이 없다는 것을 이미
  // 확인했으므로 javascript: 가 이 경로로 새어 들어올 수 없다.
  const candidate = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return null;
  // http:/https: 인데 host 가 비는 경우는 없지만, 있으면 링크로 쓸 수 없다.
  if (!url.hostname) return null;

  return url.toString();
}
