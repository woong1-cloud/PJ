'use client';

import { useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';
import { ImageDropzone } from '@/components/ImageDropzone';

// 첨부. 비율을 지켜 크게 보여준다.
//
// 지금은 80px 정사각형에 object-cover 로 잘린다. 가로로 긴 화면 캡처가
// 가운데 한 조각만 남아서 무엇이 찍혔는지 알 수 없다.
//
// 크게 보여도 되는 근거: 첨부가 있는 건은 44건 중 7건이고 평균 1.6장, 최대
// 3장이다. 자리를 아낄 이유가 없다. 그리고 9개가 PNG — 화면 캡처다.
//
// props: pics, docs, canEdit, onDelete(id), newFiles, onAddFiles, onRemoveFile, onUpload
export function RequirementAttachments({
  pics = [],
  docs = [],
  canEdit,
  onDelete,
  newFiles = [],
  onAddFiles,
  onRemoveFile,
  onUpload,
}) {
  const [zoom, setZoom] = useState(null);
  const single = pics.length === 1;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
        첨부 {pics.length + docs.length}
      </p>

      {pics.length > 0 && (
        <div className={single ? '' : 'grid grid-cols-2 gap-2 sm:grid-cols-3'}>
          {pics.map((img) => (
            // group 은 삭제 버튼을 올려놨을 때만 띄우기 위한 것이다. 지금은
            // 썸네일 위에 늘 떠 있어서 보려다 지울 수 있다.
            <div key={img.id} className="group relative">
              <button
                type="button"
                onClick={() => setZoom({ src: img.signedUrl, alt: img.file_name ?? '' })}
                className="block w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.signedUrl}
                  alt={img.file_name ?? ''}
                  className={`w-full rounded border border-slate-200 object-contain ${
                    single ? 'max-h-[360px]' : 'max-h-44'
                  }`}
                />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(img.id)}
                  aria-label={`${img.file_name ?? '이미지'} 삭제`}
                  className="absolute top-1 right-1 hidden rounded-full bg-slate-900/70 px-1.5 text-xs text-white group-hover:block"
                >
                  ×
                </button>
              )}
              {img.file_name && (
                <p className="mt-1 truncate text-[11px] text-slate-400">{img.file_name}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 문서는 썸네일을 만들 수 없다. 이미지 격자에 회색 네모로 섞으면 무슨
          파일인지 알 수 없으므로 파일명이 보이는 행으로 따로 뺀다. */}
      {docs.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <a
            href={f.signedUrl}
            download={f.file_name ?? undefined}
            className="flex-1 truncate text-indigo-600 hover:underline"
            title={f.file_name ?? ''}
          >
            {f.file_name || '이름 없는 파일'}
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={() => onDelete(f.id)}
              aria-label={`${f.file_name ?? '파일'} 삭제`}
              className="shrink-0 text-xs text-slate-400 hover:text-rose-600"
            >
              삭제
            </button>
          )}
        </div>
      ))}

      {pics.length === 0 && docs.length === 0 && (
        <p className="text-sm text-slate-400">첨부된 파일이 없습니다.</p>
      )}

      {canEdit && (
        <div className="mt-1">
          <ImageDropzone files={newFiles} onAdd={onAddFiles} onRemove={onRemoveFile} />
          {newFiles.length > 0 && (
            <button
              type="button"
              onClick={onUpload}
              className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
            >
              {newFiles.length}개 업로드
            </button>
          )}
        </div>
      )}

      <Lightbox src={zoom?.src} alt={zoom?.alt} onClose={() => setZoom(null)} />
    </section>
  );
}
