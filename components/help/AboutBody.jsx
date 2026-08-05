import { ACRONYM, DESCRIPTION, TAGLINE } from '@/lib/branding';

// 이 앱이 무엇인지. 가입 화면에서 한 번 읽고 지나간 설명을 다시 찾을 곳이
// 여기밖에 없다 — 로그인 화면은 매일 보는 곳이라 같은 글을 계속 두지 않았다.
export function AboutBody() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-base text-slate-900">{TAGLINE}</p>
        <p className="mt-1 text-[11px] tracking-[0.12em] text-slate-400 uppercase">{ACRONYM}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600">
        {DESCRIPTION.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
