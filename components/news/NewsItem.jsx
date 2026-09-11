import Link from 'next/link';

// 소식 한 줄. 세 곳이 함께 쓴다 — 팝업(NewsDialog) · 팝오버(NewsMenu) ·
// 기록(help/NewsBody).
//
// 부품으로 뽑은 이유: 링크와 그림을 세 곳에 따로 넣으면 언젠가 한 곳만
// 고친다. 그리고 그 실패는 조용하다 — 팝업에서는 단추가 보이는데 기록에는
// 없는 식이라 아무도 오류로 안 본다.
//
// item: { date, title, body, href?, cta?, image? }
//   href·cta — 그 소식이 시키는 일이 있을 때. 팝업·팝오버·기록 다 그린다
//   image    — 팝업에서만 그린다. 팝오버(320px)는 좁고, 기록은 훑는 자리다
//
// compact 는 팝오버다. 폭이 320px 이라 글자를 한 단계 줄인다.
export function NewsItem({ item, compact = false }) {
  return (
    <li className={`border-l-2 border-indigo-500 ${compact ? 'pl-2.5' : 'pl-3'}`}>
      <p className="text-[11px] text-slate-400">{item.date}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{item.title}</p>
      <p
        className={`break-keep leading-relaxed text-slate-600 ${
          compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'
        }`}
      >
        {item.body}
      </p>

      {/* 그림은 팝업에서만. 여기가 "읽고 나중에" 를 "지금" 으로 바꾸는
          자리다 — QR 이 눈앞에 있으면 폰을 그 자리에서 든다. */}
      {item.image && !compact && (
        {/* next/image 를 안 쓴다. QR 은 다시 샘플링되면 안 되는 그림이고,
            크기가 고정이라 최적화가 보탤 것이 없다. 이 경고는 그래서 끈다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt=""
          className="mt-2 h-40 w-40 rounded-lg border border-slate-200 bg-white p-1.5"
        />
      )}

      {item.href && item.cta && (
        <Link
          href={item.href}
          className={`mt-2 inline-block font-medium text-indigo-700 hover:underline ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {item.cta} →
        </Link>
      )}
    </li>
  );
}
