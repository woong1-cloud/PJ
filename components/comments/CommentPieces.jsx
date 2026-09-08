'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';
import { findUnmatchedMentions, parseMentions, splitMentions } from '@/lib/mentions';
import { MentionTextarea } from '@/components/comments/MentionTextarea';

export function fmt(dt) {
  return dt ? new Date(dt).toLocaleString('ko-KR') : '';
}

export function Avatar({ name, tone }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${tone}`}
    >
      {(name ?? '?').slice(0, 1)}
    </span>
  );
}

// 코멘트 한 줄.
//
// 이력과 같은 목록에 있지만 배경을 살짝 깔아 구분한다 — 감사 기록과 사람이 쓴
// 말은 무게가 다르고, 섞어놓은 김에 어느 쪽인지까지 못 알아보면 곤란하다.
// 코멘트 본문. 불린 이름에 색을 입힌다.
//
// 매칭은 서버가 알림을 보낼 때와 같은 함수(splitMentions)를 쓴다. 규칙이
// 갈라지면 "파랗게 칠해졌는데 알림은 안 왔다"가 생기고, 그 순간부터 아무도
// 멘션을 믿지 않는다.
//
// dangerouslySetInnerHTML 은 쓰지 않는다. 코멘트는 사용자가 쓴 글이라,
// 문자열로 조립해 넣는 순간 남의 코멘트에 태그를 심을 수 있게 된다.
export function CommentBody({ body, mentionable }) {
  const segments = splitMentions(body, mentionable);
  return (
    <p className="whitespace-pre-wrap break-words text-slate-800">
      {segments.map((segment, i) =>
        segment.type === 'mention' ? (
          <span
            key={i}
            className="rounded bg-indigo-50 px-0.5 font-medium text-indigo-600"
            title={`${segment.name}님을 언급했습니다`}
          >
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

// 코멘트에 붙은 시안.
//
// 요구사항 첨부(RequirementAttachments)보다 작게 그린다. 저쪽은 실무자가
// 보고 판단하는 증거라 크게 보여야 하지만, 여기는 대화 한 줄에 딸린 것이라
// 크게 그리면 그 코멘트 하나가 화면을 통째로 먹는다. 자세히 볼 일은 눌러서
// 확대하면 된다 — 상세 첨부와 같은 Lightbox 다.
export function CommentImages({ images, canDelete, onDelete }) {
  const [zoom, setZoom] = useState(null);
  if (!images || images.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {images.map((img) => (
        <div key={img.id} className="group relative">
          <button
            type="button"
            onClick={() => setZoom({ src: img.signedUrl, alt: img.file_name ?? '' })}
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.signedUrl}
              alt={img.file_name ?? '시안'}
              className="max-h-32 rounded border border-slate-200 bg-white object-contain"
            />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(img.id)}
              aria-label={`${img.file_name ?? '시안'} 삭제`}
              className="absolute top-1 right-1 hidden rounded-full bg-slate-900/70 px-1.5 text-xs text-white group-hover:block"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <Lightbox src={zoom?.src} alt={zoom?.alt} onClose={() => setZoom(null)} />
    </div>
  );
}

export function CommentEntry({ comment, mentionable, mine, onEdit, onDelete, onDeleteImage }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    const ok = await onEdit(draft);
    setSaving(false);
    if (ok) setEditing(false);
  }

  function startEdit() {
    // 취소했다가 다시 열었을 때 지난번에 쓰다 만 글이 남아 있으면 안 된다.
    setDraft(comment.body);
    setEditing(true);
  }

  return (
    <li className="flex items-start gap-2 rounded-md bg-slate-50 px-2 py-1.5">
      <Avatar name={comment.author?.name} tone="bg-indigo-100 text-indigo-600" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-slate-900">{comment.author?.name ?? '누군가'}</span>
          <span className="text-xs text-slate-400">
            {fmt(comment.created_at)}
            {/* 지금 보이는 문장이 처음 쓴 그대로인지 아닌지는 읽는 사람이 알아야
                한다. 언제 고쳤는지는 title 로 넘긴다 — 한 줄이 길어지면 대화가
                안 읽힌다. */}
            {comment.edited_at && (
              <span title={`${fmt(comment.edited_at)}에 수정됨`}> · 수정됨</span>
            )}
          </span>
          {mine && !editing && (
            <span className="ml-auto flex shrink-0 gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="text-xs text-slate-400 hover:text-indigo-600"
              >
                수정
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-slate-400 hover:text-rose-600"
              >
                삭제
              </button>
            </span>
          )}
        </div>
        {editing ? (
          <form onSubmit={save} className="mt-1 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              aria-label="코멘트 수정"
              className="rounded-lg border border-slate-300 p-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                되돌리기
              </button>
              <button
                type="submit"
                disabled={saving || !draft.trim()}
                className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <CommentBody body={comment.body} mentionable={mentionable} />
            {/* 수정 중에는 감춘다. 시안은 본문 수정으로 바뀌지 않는데 함께
                보이면 지금 고치는 중인 것처럼 읽힌다. */}
            {/* onDeleteImage 가 없으면 시안을 아예 안 그린다. 시안을 뗄 수 없는
                화면이라는 것은 시안을 붙일 수도 없다는 뜻이다 — 런칭 댓글은
                이미지를 안 받는다(요구사항도 0026 으로 나중에 붙였다). */}
            {onDeleteImage && (
              <CommentImages images={comment.images} canDelete={mine} onDelete={onDeleteImage} />
            )}
          </>
        )}
      </div>
    </li>
  );
}

// 새 코멘트 입력. 피드가 오래된 것→새 것 순이라 입력칸도 맨 아래에 둔다.
// 방금 쓴 글이 바로 위에 붙는다.
//
// imageTypes 가 없으면 첨부 UI 를 안 그린다. 런칭 댓글은 이미지를 안 받는다 —
// 요구사항도 0026 으로 나중에 붙였다. 무엇을 받고 몇 장까지 받는지는 이 부품이
// 정할 일이 아니라 부르는 쪽의 정책이라, 상수를 안에 두지 않고 prop 으로 받는다.
//
// props: onSubmit(body, files), mentionable, imageTypes([mime]), maxImages(수)
export function CommentComposer({ onSubmit, mentionable, imageTypes, maxImages }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  // 등록 전까지 붙여둔 시안. 코멘트가 있어야 붙일 곳이 생기므로, 파일은
  // 여기 들고 있다가 등록될 때 함께 올라간다.
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);

  // 미리보기 blob URL. 파일 목록이 바뀔 때만 새로 만들고, 사라진 것은
  // 되돌려 준다 — 안 그러면 고르고 지우기를 반복할수록 메모리에 쌓인다.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function addFiles(picked) {
    const chosen = Array.from(picked ?? []);
    // 시안은 그림이다. 문서를 여기로 받으면 대화 칸에 파일명 줄이 쌓이는데,
    // 그건 요구사항 첨부가 할 일이다(그쪽은 20MB 까지 받는다).
    const images = chosen.filter((f) => imageTypes.includes(f.type));
    const room = maxImages - files.length;
    const next = images.slice(0, Math.max(room, 0));

    setFileError(
      images.length < chosen.length
        ? '이미지만 붙일 수 있습니다. 문서는 요구사항 첨부에 올려 주세요.'
        : next.length < images.length
          ? `시안은 한 코멘트에 ${maxImages}장까지입니다.`
          : '',
    );
    if (next.length) setFiles((prev) => [...prev, ...next]);
    // 같은 파일을 지웠다가 다시 고를 수 있게 비운다. 안 비우면 input 값이
    // 그대로라 change 가 안 걸린다.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // 등록 전에 "누구에게 갈지"와 "누가 안 걸렸는지"를 둘 다 보여준다.
  //
  // 실제로 겪은 일: 다른 브랜드 사람을 @로 부른 코멘트가 그대로 등록되고,
  // 그 이름은 파랗게 칠해지지도 알림이 가지도 않았다. 화면상으로는 성공과
  // 구별되지 않는다 — 부른 사람은 전달됐다고 믿고 기다린다.
  // 목록에서 골랐든 손으로 적었든, 서버가 알림을 보낼 때 쓰는 것과 똑같은
  // 함수로 여기서 미리 판정해서 그 차이를 눈에 보이게 만든다.
  const mentioned = useMemo(() => parseMentions(body, mentionable), [body, mentionable]);
  const unmatched = useMemo(() => findUnmatchedMentions(body, mentionable), [body, mentionable]);
  // 동명이인은 parseMentions 가 두 사람을 다 돌려준다. 이름만 늘어놓으면
  // "박스파오, 박스파오"가 되니 한 번만 적고 인원수를 붙인다.
  const mentionedNames = useMemo(() => {
    const counts = new Map();
    for (const m of mentioned) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
    return [...counts].map(([name, n]) => (n > 1 ? `${name} (${n}명)` : name));
  }, [mentioned]);

  async function submit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const ok = await onSubmit(body, files);
    setSaving(false);
    if (ok) {
      setBody('');
      setFiles([]);
      setFileError('');
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
      <MentionTextarea
        value={body}
        onChange={setBody}
        members={mentionable}
        rows={2}
        aria-label="코멘트"
        placeholder="이 요청에 대해 남길 말을 적어 주세요. @로 팀원을 부를 수 있습니다."
      />
      {mentionedNames.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <span>알림 받을 사람</span>
          {mentionedNames.map((name) => (
            <span
              key={name}
              className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-600"
            >
              @{name}
            </span>
          ))}
        </p>
      )}
      {unmatched.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          {unmatched.map((name) => `@${name}`).join(', ')} 은(는) 알림을 받지 못합니다. 이 요구사항의
          브랜드 팀이 아니거나 이름이 다릅니다 — @를 다시 입력해 목록에서 골라 보세요.
        </p>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file, i) => (
            <div key={`${file.name}:${file.size}:${file.lastModified}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i]}
                alt={file.name}
                className="h-16 w-16 rounded border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`${file.name} 빼기`}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-slate-900/80 px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {fileError && <p className="text-xs text-amber-700">{fileError}</p>}
      <div className="flex items-center justify-between">
        {/* 논의 중 나온 시안을 여기 붙인다. 요구사항 첨부로 올리면 원래 요청의
            증거와 섞여서, 나중에 어느 것이 처음 요청인지 알 수 없어진다. */}
        {imageTypes && (
          <label className="cursor-pointer text-xs text-indigo-600 hover:underline">
            ＋ 이미지
            <input
              ref={fileInputRef}
              type="file"
              accept={imageTypes.join(',')}
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />
          </label>
        )}
        {/* ml-auto 는 첨부가 꺼졌을 때 등록 단추를 오른쪽에 붙여둔다. 첨부가
            켜져 있으면 justify-between 이 이미 같은 자리에 놓으므로 아무 일도
            하지 않는다 — 요구사항 화면은 그대로다. */}
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}
