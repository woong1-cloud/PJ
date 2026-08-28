import { NEWS } from '@/lib/newsItems';

// 지금까지의 업데이트 소식 전부.
//
// 창(NewsDialog)은 안 본 것만 보여 주고 한 번 뜨면 사라진다. 여기는 닫아
// 버린 뒤에 "그때 뭐가 바뀐다고 했더라" 를 찾으러 오는 자리라, 본 것까지
// 전부 남긴다.
export function NewsBody() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm break-keep text-slate-600">
        새 소식은 로그인한 뒤 한 번 창으로 뜹니다. 닫은 뒤에도 여기서 다시 볼 수 있습니다.
      </p>

      <ul className="flex flex-col gap-4">
        {NEWS.map((item) => (
          <li key={item.date} className="border-l-2 border-indigo-500 pl-3">
            <p className="text-[11px] text-slate-400">{item.date}</p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed break-keep text-slate-600">{item.body}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs break-keep text-slate-400">
        큰 변화만 남깁니다. 불편한 점이나 고쳤으면 하는 것이 있으면 실무 관리자에게 알려 주세요.
      </p>
    </div>
  );
}
