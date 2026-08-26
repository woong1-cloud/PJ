'use client';

import { useEffect } from 'react';

// 이미지 확대. 같은 페이지에서 연다.
//
// 새 탭으로 나가면 본문과 대조할 수 없다. 첨부의 9할이 화면 캡처이고 실무자가
// 그걸 보고 판단하므로, To-Be 를 읽다가 그림을 확인하고 돌아오는 왕복이
// 끊기면 안 된다.
export function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || '첨부 이미지'}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1 text-sm text-slate-700"
      >
        닫기
      </button>
    </div>
  );
}
