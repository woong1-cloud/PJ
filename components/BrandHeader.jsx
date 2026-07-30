import { ACRONYM, APP_NAME, TAGLINE } from '@/lib/branding';

// 로그인·가입 화면 위에 얹는 이름 블록. 세 줄로 끝낸다.
//
// 세 줄은 각각 다른 일을 한다.
//   모아 MOA                        이름
//   Multi-brand Objectives Alignment 무엇을 다루는가 (범위)
//   슬로건                           나에게 무엇이 달라지나
// 범위를 둘째 줄이 이미 말하므로 슬로건은 '멀티브랜드'를 다시 설명하지 않고
// 사용자가 얻는 것만 말하면 된다.
//
// 설명 세 줄은 도움말(app/help)로 옮겼다. 대문이 설명을 다 짊어질 필요가 없다 —
// 로그인은 같은 사람이 매일 여는 화면이라 긴 글이 곧 소음이 되고, 가입 화면도
// 폼이 본론인데 그 위에 문단이 쌓이면 정작 채울 칸이 아래로 밀린다.
export function BrandHeader() {
  return (
    // break-keep(word-break: keep-all) 이 없으면 좁은 화면에서 한국어가 글자
    // 단위로 끊긴다. 실제로 375px 에서 '…화면을 봅 / 니다' 로 갈라졌다.
    // CJK 기본 줄바꿈 규칙은 글자 사이 어디서나 끊는 것이라 브라우저 잘못이
    // 아니지만, 한국어는 어절 단위로 끊어야 읽힌다.
    <div className="mb-6 break-keep text-center">
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{APP_NAME}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-400">{ACRONYM}</p>
      <p className="mt-2 text-sm text-slate-500">{TAGLINE}</p>
    </div>
  );
}
