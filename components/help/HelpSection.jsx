// 도움말 섹션 하나의 껍데기.
//
// 껍데기를 하나로 묶는 것이 이 파일의 존재 이유다. 예전에는 '모아 MOA' 만
// 카드(테두리+흰 배경)이고 상태·권한은 맨몸이라, 같은 층위인데 옷이 달라
// 정리가 안 된 것처럼 보였다. 내용을 더할 때도 매번 "이건 카드로 감쌌던가" 를
// 다시 판단하게 된다.
//
// scroll-mt 는 앵커로 들어왔을 때 제목이 화면 맨 위에 딱 붙지 않게 띄운다.
export function HelpSection({ id, title, summary, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-5 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{summary}</p>
      <div className="mt-4 border-t border-slate-100 pt-4">{children}</div>
    </section>
  );
}
