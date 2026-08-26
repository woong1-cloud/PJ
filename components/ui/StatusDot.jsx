'use client';

// 상태 점 + 이름.
//
// 뱃지(Badge + statusStyle)와 나란히 존재하는 이유: 뱃지는 목록에서 한 칸을
// 채우는 물건이고, 이것은 문장 안에 놓이는 물건이다. 머리 줄에서 뱃지를 쓰면
// 뒤에 오는 '20일째 멈춤'과 무게가 같아져서 어느 쪽을 먼저 읽어야 할지가
// 사라진다.
//
// tone 은 lib/headline.js 가 정한다. 상태 이름으로 색을 다시 고르지 않는다 —
// 정체 여부처럼 상태만으로는 알 수 없는 것이 색을 바꾸기 때문이다. 검토대기는
// 보통 앰버지만 20일 멈추면 붉어야 한다.
const TONES = {
  stall: { text: 'text-rose-700', dot: 'bg-rose-500' },
  wait: { text: 'text-amber-700', dot: 'bg-amber-500' },
  go: { text: 'text-indigo-700', dot: 'bg-indigo-500' },
  done: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  flat: { text: 'text-slate-500', dot: 'bg-slate-300' },
};

export function StatusDot({ status, tone = 'flat' }) {
  const t = TONES[tone] ?? TONES.flat;
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${t.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}
