// 아무것도 안 한다. 설치 조건을 채우려고 있다.
//
// 캐싱을 넣지 않는다. 이 앱은 볼 것이 전부 서버에 있고 오프라인으로 할 일이
// 없다. 넣으면 "배포했는데 옛날 화면이 나온다"는 병이 새로 생기고, 그 병은
// 사용자가 스스로 못 고친다.
//
// 걷어내는 법(언젠가 필요하면): 같은 주소에 registration.unregister() 만
// 하는 파일을 올려 한 번 돌린다. 지금 것은 아무 응답도 가로채지 않아서
// 잘못돼도 화면을 망가뜨리지 못한다.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// 이 핸들러가 있어야 크롬이 설치 가능으로 친다. respondWith 를 안 부르므로
// 요청은 평소대로 네트워크로 간다 — 가로채는 것이 아니라 있기만 한 것이다.
self.addEventListener('fetch', () => {});
