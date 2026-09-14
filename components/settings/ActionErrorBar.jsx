'use client';

// 조작이 실패했을 때 화면 아래에 뜨는 한 줄.
//
// 예전에는 페이지 맨 위의 빨간 글씨였다. 그런데 이 화면에서 실패하는 조작은
// 대부분 목록 아래쪽 줄의 '⋯' 나 오른쪽 패널에서 누른다 — 스크롤이 내려가
// 있거나 패널이 덮고 있어서, 누른 사람은 아무 일도 안 일어난 것으로 본다.
// 마지막 브랜드 관리자 강등처럼 서버가 막는 경우가 정확히 그렇다.
//
// 그래서 스크롤과 상관없이 보이는 자리에 고정한다. 패널(z-30)보다 위에 둔다.
// 저절로 사라지게 하지 않는다 — 서버가 준 문구는 왜 막혔는지 설명이라 읽을
// 시간이 필요하고, 다음 조작을 시작하면 페이지가 알아서 지운다.
//
// props:
//   message    비었으면 아무것도 안 그린다
//   onClose()
export function ActionErrorBar({ message, onClose }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-lg"
    >
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="오류 닫기"
        className="shrink-0 rounded px-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600"
      >
        ×
      </button>
    </div>
  );
}
