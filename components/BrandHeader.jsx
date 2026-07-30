import { ACRONYM, APP_NAME, DESCRIPTION, TAGLINE } from '@/lib/branding';

// 로그인·가입 화면 위에 얹는 이름 블록.
//
// 화면마다 얼마나 보여줄지가 다르다. 기준은 "그 화면을 몇 번 보는가" 다.
// 로그인은 같은 사람이 매일 열기 때문에 이름과 슬로건 한 줄로 끝낸다 —
// 약어 풀이와 설명을 거기 두면 100번째 로그인에는 읽지 않는 글이 화면
// 절반을 차지한다. 가입은 한 번 보는 화면이라 거기가 진짜 대문이다.
//
// props: withAcronym, withDescription
export function BrandHeader({ withAcronym = false, withDescription = false }) {
  return (
    // break-keep(word-break: keep-all) 이 없으면 좁은 화면에서 한국어가 글자
    // 단위로 끊긴다. 실제로 375px 에서 '…화면을 봅 / 니다' 로 갈라졌다.
    // CJK 기본 줄바꿈 규칙은 글자 사이 어디서나 끊는 것이라 브라우저 잘못이
    // 아니지만, 한국어는 어절 단위로 끊어야 읽힌다.
    <div className="mb-6 break-keep text-center">
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{APP_NAME}</p>
      {withAcronym && (
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-400">{ACRONYM}</p>
      )}
      <p className="mt-2 text-sm text-slate-500">{TAGLINE}</p>
      {/* 상자에 담지 않는다. 아래 폼이 이미 테두리 있는 카드라, 여기도 상자로
          만들면 카드 둘이 경쟁하고 어느 쪽이 본론인지 흐려진다. 부제처럼 둔다. */}
      {withDescription && (
        <ul className="mt-4 flex flex-col gap-1.5 text-left text-xs leading-relaxed text-slate-500">
          {DESCRIPTION.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span aria-hidden className="select-none text-slate-300">
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
