'use client';

// 목록 화면 전용 등록 버튼.
//
// 모바일에서 헤더의 '+ 새 요구사항' 을 지웠으므로 이것이 유일한 입구다.
// 다른 화면에는 띄우지 않는다 — "여기서 뭘 등록한다는 거지"가 된다.
//
// 하단 탭바 대신 이걸 고른 이유: 브랜드 요청자에게 이 앱은 사실상 화면이
// 하나(요구사항)라 탭 세 칸 중 두 칸이 거의 안 쓰인다. 세로 56px 를 상시
// 내주는 대신, 가장 자주 하는 동작 하나를 1탭으로 만든다.
export function NewRequirementFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="새 요구사항 등록"
      className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-3xl leading-none text-white shadow-lg active:bg-indigo-700 md:hidden"
    >
      <span className="-mt-0.5">+</span>
    </button>
  );
}
