'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildActivityFeed } from '@/lib/activityFeed';
import { canModifyComment } from '@/lib/comments';
import {
  filterMentionCandidates,
  findMentionQuery,
  findUnmatchedMentions,
  parseMentions,
  splitMentions,
} from '@/lib/mentions';

// 활동 — 상태 변경 이력과 코멘트를 한 줄기로 보여준다.
//
// 두 출처를 따로 놓지 않는 것이 이 화면의 요점이다. "왜 이 상태로 갔는지"(이력)와
// "그때 무슨 얘기가 오갔는지"(코멘트)는 원래 한 흐름인데, 상자를 나눠 놓으면
// 읽는 사람이 두 목록의 시각을 눈으로 짜맞춰야 한다.
//
// 저장은 여전히 따로다. 이력은 감사 기록이라 못 고치고, 코멘트는 고칠 수 있다.
// 섞는 일은 읽을 때만 일어난다(lib/activityFeed.js).
//
// props: requirementId, brandId, history(상세 API 의 change_logs), memberId(보는 사람)
export function ActivityFeed({ requirementId, brandId, history, memberId }) {
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('comment');
  // @로 부를 수 있는 사람들. 이 건의 브랜드 팀만 온다 — 열지도 못하는 사람을
  // 부르면 알림을 받고 눌러도 403 이 뜬다(서버가 같은 목록으로 다시 판정한다).
  const [mentionable, setMentionable] = useState([]);

  const load = useCallback(() => {
    // brandId 는 상세를 불러온 뒤에야 정해진다. 그 전에 요청하면 엉뚱한
    // 브랜드로 물어보게 되어 403 이 한 번 깜빡인다.
    if (!requirementId || !brandId) return;
    fetch(`/api/requirements/${requirementId}/comments?brandId=${brandId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '코멘트를 불러오지 못했습니다.');
        setComments(d.comments ?? []);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [requirementId, brandId]);

  useEffect(() => {
    load();
  }, [load]);

  // 목록을 못 받아도 코멘트는 쓸 수 있어야 한다. 자동완성은 편의이고, 실패를
  // 배너로 띄우면 "코멘트가 안 되나?"로 읽힌다. 조용히 비운다.
  useEffect(() => {
    if (!requirementId || !brandId) return undefined;
    let cancelled = false;
    fetch(`/api/requirements/${requirementId}/mentionable?brandId=${brandId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled && d) setMentionable(d.members ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [requirementId, brandId]);

  const feed = useMemo(() => buildActivityFeed(history, comments), [history, comments]);

  async function addComment(body) {
    setError('');
    const res = await fetch(`/api/requirements/${requirementId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, body }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '코멘트 등록 실패');
      return false;
    }
    load();
    return true;
  }

  async function editComment(commentId, body) {
    setError('');
    const res = await fetch(`/api/requirements/${requirementId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, body }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '코멘트 수정 실패');
      return false;
    }
    load();
    return true;
  }

  async function deleteComment(commentId) {
    // 코멘트는 그 사람이 쓴 말이다. 잘못 누른 클릭 한 번으로 지워지면 안 되고,
    // 되돌릴 방법도 없다(휴지통이 없다).
    if (!window.confirm('코멘트를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setError('');
    const res = await fetch(
      `/api/requirements/${requirementId}/comments/${commentId}?brandId=${brandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '코멘트 삭제 실패');
      return;
    }
    load();
  }

  // 기본은 코멘트만이다.
  //
  // 처음엔 이력과 코멘트를 한 줄기로 섞었는데, 상태 변경이 열댓 개 쌓인 건에서
  // 대화 두 줄을 찾으려면 스크롤을 훑어야 했다. 읽으러 오는 것(대화)과
  // 확인하러 오는 것(감사 기록)은 목적이 다르다. 섞어 보는 선택지는 남기되
  // 기본값은 대화로 둔다 — 맥락이 필요한 순간은 가끔이고, 대화를 읽으러
  // 오는 순간이 훨씬 잦다.
  const visible = tab === 'comment' ? feed.filter((e) => e.kind === 'comment') : feed;
  const commentCount = feed.filter((e) => e.kind === 'comment').length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-1">
        <TabButton active={tab === 'comment'} onClick={() => setTab('comment')}>
          코멘트{commentCount > 0 && <span className="ml-1 text-slate-400">{commentCount}</span>}
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          전체 활동
        </TabButton>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {visible.length === 0 && (
        <p className="text-sm text-slate-400">
          {tab === 'comment' ? '아직 코멘트가 없습니다.' : '기록이 없습니다.'}
        </p>
      )}
      <ul className="flex flex-col gap-2 text-sm text-slate-700">
        {visible.map((entry) =>
          entry.kind === 'comment' ? (
            <CommentEntry
              key={entry.id}
              comment={entry.data}
              mentionable={mentionable}
              // 서버도 같은 판정을 한다(작성자 본인만). 여기서 버튼을 감추는 것은
              // 편의일 뿐 권한 검사가 아니다.
              mine={canModifyComment(entry.data, memberId)}
              onEdit={(body) => editComment(entry.data.id, body)}
              onDelete={() => deleteComment(entry.data.id)}
            />
          ) : (
            <ChangeEntry key={entry.id} log={entry.data} />
          ),
        )}
      </ul>
      <CommentComposer onSubmit={addComment} mentionable={mentionable} />
    </section>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1 text-sm transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function fmt(dt) {
  return dt ? new Date(dt).toLocaleString('ko-KR') : '';
}

function Avatar({ name, tone }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${tone}`}
    >
      {(name ?? '?').slice(0, 1)}
    </span>
  );
}

// 상태 변경 등 감사 기록 한 줄. 기존 활동 목록의 문구를 그대로 옮겼다.
function ChangeEntry({ log: h }) {
  return (
    <li className="flex items-start gap-2">
      <Avatar name={h.changer?.name} tone="bg-slate-100 text-slate-500" />
      <span>
        {h.changer?.name ?? '누군가'}님이{' '}
        {h.change_type === '내용수정' || h.change_type === '중복병합' ? (
          h.comment
        ) : (
          <>
            {/* 변경 종류마다 문구가 다르다. 예전에는 모든 행에 상태변경
                문구를 붙여서 예상일 변경이 '상태를 null→2026-07-25로
                변경'으로 보였다. */}
            {h.change_type === '예상일변경'
              ? `배포예상일을 ${h.old_value ?? '미정'}→${h.new_value ?? '미정'}(으)로 변경`
              : `상태를 ${h.old_value}→${h.new_value}로 변경`}
            {/* 종결(반려·취소) 사유가 여기 들어온다. 사유를 필수로
                받아놓고 화면에 안 보여주면 저장한 의미가 없다. */}
            {h.comment && <span className="text-slate-600"> — {h.comment}</span>}
          </>
        )}
        <span className="text-slate-400"> · {fmt(h.created_at)}</span>
      </span>
    </li>
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
function CommentBody({ body, mentionable }) {
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

function CommentEntry({ comment, mentionable, mine, onEdit, onDelete }) {
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
          <CommentBody body={comment.body} mentionable={mentionable} />
        )}
      </div>
    </li>
  );
}

// 새 코멘트 입력. 피드가 오래된 것→새 것 순이라 입력칸도 맨 아래에 둔다.
// 방금 쓴 글이 바로 위에 붙는다.
function CommentComposer({ onSubmit, mentionable }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

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
    const ok = await onSubmit(body);
    setSaving(false);
    if (ok) setBody('');
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
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

// @자동완성이 달린 입력칸.
//
// 이름을 손으로 적게 두면 오타 하나로 멘션이 조용히 사라진다("김관리" vs
// "김 관리"). 목록에서 고르게 해서 적어도 존재하는 이름은 정확히 들어가게 한다.
// 물론 손으로 적어도 되고, 그때도 서버는 같은 규칙으로 이름을 찾아낸다 —
// 목록은 편의이지 관문이 아니다.
//
// props: value, onChange(next), members([{id,name}]), 나머지는 textarea 로.
function MentionTextarea({ value, onChange, members, ...textareaProps }) {
  const ref = useRef(null);
  // 지금 '@...'를 치는 중인가. { start, query } 또는 null.
  const [typing, setTyping] = useState(null);
  const [active, setActive] = useState(0);
  // Esc 로 닫았거나 방금 고른 자리. 같은 '@'에서 목록이 되살아나면 성가시다.
  const [dismissed, setDismissed] = useState(null);
  // 이름을 끼워 넣은 뒤 커서를 어디에 둘지. 그려진 다음에야 옮길 수 있어서
  // 한 박자 미뤄 두는데, state 로 두면 effect 안에서 다시 setState 하게 된다
  // (cascading render). 그릴 필요가 없는 값이므로 ref 로 들고 있는다.
  const caretAfterInsert = useRef(null);

  const candidates = typing ? filterMentionCandidates(members, typing.query) : [];
  const open = Boolean(typing) && candidates.length > 0 && dismissed !== typing.start;
  const activeIndex = Math.min(active, Math.max(candidates.length - 1, 0));

  useEffect(() => {
    const pos = caretAfterInsert.current;
    if (pos == null) return;
    caretAfterInsert.current = null;
    const el = ref.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
  }, [value]);

  function sync(el) {
    setTyping(findMentionQuery(el.value, el.selectionStart));
  }

  // 방금 '@'를 쳤다면 "닫아둔 자리" 기억을 지운다.
  //
  // 이게 없으면 Esc 로 닫은 뒤 그 자리에서 다시 '@'를 쳐도 목록이 안 열린다.
  // 코멘트를 등록하면 입력칸이 비고 다음 '@'는 또 0번 자리라, 두 번째 멘션부터
  // 자동완성이 통째로 죽는 것처럼 보인다(실제로 이 검증에서 그렇게 걸렸다).
  // 새로 친 '@'는 언제나 "이번엔 부르겠다"는 뜻이다.
  function forgetDismissIfNewAt(el, previous) {
    const caret = el.selectionStart;
    if (el.value.length > previous.length && caret > 0 && el.value[caret - 1] === '@') {
      setDismissed(null);
    }
  }

  function pick(member) {
    const el = ref.current;
    if (!el || !typing) return;
    const inserted = `@${member.name}`;
    // 뒤에 공백을 붙이지 않는다. 한국어는 이름에 조사가 바로 붙으므로
    // ('@김관리님이') 공백을 넣어주면 사람이 매번 지워야 한다.
    const next = value.slice(0, typing.start) + inserted + value.slice(el.selectionStart);
    onChange(next);
    setDismissed(typing.start);
    setTyping(null);
    setActive(0);
    caretAfterInsert.current = typing.start + inserted.length;
  }

  function onKeyDown(event) {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % candidates.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + candidates.length) % candidates.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      // 목록이 떠 있을 때의 Enter 는 줄바꿈이 아니라 '고르기'다.
      event.preventDefault();
      pick(candidates[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(typing.start);
    }
  }

  return (
    <div className="relative">
      <textarea
        {...textareaProps}
        ref={ref}
        value={value}
        onChange={(e) => {
          forgetDismissIfNewAt(e.target, value);
          onChange(e.target.value);
          sync(e.target);
        }}
        onKeyUp={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onBlur={() => setTyping(null)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="mention-listbox"
        className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-indigo-400 focus:outline-none"
      />
      {open && (
        <ul
          id="mention-listbox"
          role="listbox"
          aria-label="언급할 팀원"
          className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {candidates.map((member, i) => (
            <li key={member.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                // mousedown 을 막지 않으면 클릭 전에 blur 가 나서 목록이 사라진다.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(member)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-1.5 text-left text-sm ${
                  i === activeIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                }`}
              >
                {member.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
