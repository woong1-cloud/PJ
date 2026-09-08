// 주소의 코드로 항목을 찾는다.
//
// 못 찾은 것을 조용히 넘기지 않는다 — 링크를 누른 사람은 무언가 열릴 것을
// 기대했다. 왜 못 찾았는지(어떤 코드였는지)까지 돌려줘서 화면이 한 줄로
// 말할 수 있게 한다.
//
// 빈 코드와 못 찾은 코드는 다르다. 빈 것은 "창을 안 연다"이고, 못 찾은 것은
// "열려고 했는데 없다"이다. 둘을 같이 다루면 주소에 task 가 없는 평범한
// 화면에도 빨간 안내가 뜬다.
export function taskByCode({ tasks = [], code = '' } = {}) {
  const wanted = String(code ?? '').trim();
  if (!wanted) return { task: null, missing: '' };
  const found = (tasks ?? []).find((t) => t?.code === wanted);
  return found ? { task: found, missing: '' } : { task: null, missing: wanted };
}
