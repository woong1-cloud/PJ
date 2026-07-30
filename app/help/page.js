import { StatusGuide } from '@/components/StatusGuide';
import { TierGuide } from '@/components/TierGuide';
import { ACRONYM, APP_NAME, DESCRIPTION, TAGLINE } from '@/lib/branding';

// 로그인한 사람이면 누구나 볼 수 있다.
//
// 원래 상태 안내가 대시보드에 있었는데, 대시보드는 전체관리자 전용이다.
// 정작 "검토대기가 무슨 뜻이지?"가 궁금한 사람은 요청을 올리는 브랜드
// 담당자(4차)인데 그 화면에 들어갈 수 없었다. 설명이 필요 없는 사람에게만
// 설명이 보이던 셈이라 이리로 옮겼다.
export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 break-keep">
      <h1 className="text-lg font-semibold text-slate-900">도움말</h1>

      {/* 이 앱이 무엇인지부터 적는다. 가입 화면에서 한 번 읽고 지나간 설명을
          다시 찾을 곳이 여기밖에 없다 — 로그인 화면은 매일 보는 곳이라
          같은 글을 계속 두지 않았다. */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">{APP_NAME}</h2>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-400">{ACRONYM}</p>
        <p className="mt-2 text-sm text-slate-600">{TAGLINE}</p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-relaxed text-slate-500">
          {DESCRIPTION.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span aria-hidden className="select-none text-slate-300">
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <StatusGuide />
      <TierGuide />
    </div>
  );
}
