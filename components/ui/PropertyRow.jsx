'use client';

// 오른쪽 열의 한 줄. 아이콘 · 라벨 · 값.
//
// alert 는 "지금 잘못된 상태"에만 쓴다. 이 화면에서 색을 가진 행이 하나뿐이라야
// 그 한 줄이 눈에 박힌다 — 대개 담당자 미지정이다. 둘 이상이 색을 가지면
// 둘 다 그냥 배경이 된다.
//
// 값이 비었을 때 회색 '—' 대신 유도 문구를 받는 이유: 배포예상일은 44건 중
// 7건, 레드마인은 1건만 채워져 있다. 네 줄 중 절반이 늘 '—' 면 그 영역이 죽은
// 것처럼 보인다.
//
// children 을 주면 값 자리를 통째로 대신한다(셀렉트·날짜 입력 등).
export function PropertyRow({ icon, label, value, empty, alert = false, children }) {
  const filled = value !== null && value !== undefined && value !== '';
  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${alert ? 'bg-amber-50' : ''}`}>
      <span
        className={`w-4 shrink-0 text-center ${alert ? 'text-amber-600' : 'text-slate-400'}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className={`flex-1 ${alert ? 'text-amber-700' : 'text-slate-500'}`}>{label}</span>
      {children ?? (
        <span
          className={filled ? (alert ? 'text-amber-700' : 'text-slate-900') : 'text-indigo-600'}
        >
          {filled ? value : (empty ?? '—')}
        </span>
      )}
    </div>
  );
}
