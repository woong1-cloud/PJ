'use client';

import { useEffect, useRef, useState } from 'react';
import { ALLOWED_ATTACHMENT_TYPES, ALLOWED_IMAGE_TYPES } from '@/lib/imageUpload';

// props:
//  - files: File[] (부모 소유)
//  - onAdd(newFiles: File[])
//  - onRemove(index: number)
function fileIdentity(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function ImageDropzone({ files, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState([]);
  // id -> blob URL. Reused across renders so adding one more file doesn't
  // regenerate (and remount) every existing thumbnail's URL.
  const urlCacheRef = useRef(new Map());

  useEffect(() => {
    const cache = urlCacheRef.current;
    const currentIds = new Set();
    const next = files.map((file) => {
      const id = fileIdentity(file);
      currentIds.add(id);
      let url = cache.get(id);
      if (!url) {
        url = URL.createObjectURL(file);
        cache.set(id, url);
      }
      return { id, url };
    });
    for (const [id, url] of cache) {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(url);
        cache.delete(id);
      }
    }
    setPreviews(next);
  }, [files]);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  function acceptFiles(list) {
    // 이미지뿐 아니라 문서도 받는다. 서버가 같은 목록으로 다시 판정하므로
    // 여기서 거르는 것은 "고를 수 없는 파일을 담지 않는다"는 편의일 뿐이다.
    const accepted = Array.from(list).filter((f) => ALLOWED_ATTACHMENT_TYPES.includes(f.type));
    if (accepted.length) onAdd(accepted);
  }

  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items ?? [];
      const imgs = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          // 붙여넣기는 화면 캡처가 대부분이라 이미지만 받는다. 문서를
          // 클립보드로 붙여넣는 경로는 브라우저마다 제각각이라 믿을 수 없다.
          if (file && ALLOWED_IMAGE_TYPES.includes(file.type)) imgs.push(file);
        }
      }
      if (imgs.length) {
        e.preventDefault();
        onAdd(imgs);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onAdd]);

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          acceptFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 text-slate-500'
        }`}
      >
        <span>파일을 드래그하거나 클릭해서 선택 · 스크린샷은 Ctrl+V로 붙여넣기</span>
        {/* 무엇을 올릴 수 있는지 안 알려주면 사람들은 이미지만 되는 줄 알고
            기획서를 메일로 보낸다. 형식을 다 적으면 길어지니 대표만 적는다. */}
        <span className="mt-1 text-xs text-slate-400">
          이미지 · PDF · 엑셀 · PPT · 워드 · 한글 (이미지 10MB, 문서 20MB)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            acceptFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map(({ id, url }, i) => (
            <div key={id} className="relative">
              <img src={url} alt="" className="h-20 w-full rounded-md border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
