'use client';

import { useEffect, useRef, useState } from 'react';
import { filterMentionCandidates, findMentionQuery } from '@/lib/mentions';

// @자동완성이 달린 입력칸.
//
// 이름을 손으로 적게 두면 오타 하나로 멘션이 조용히 사라진다("김관리" vs
// "김 관리"). 목록에서 고르게 해서 적어도 존재하는 이름은 정확히 들어가게 한다.
// 물론 손으로 적어도 되고, 그때도 서버는 같은 규칙으로 이름을 찾아낸다 —
// 목록은 편의이지 관문이 아니다.
//
// props: value, onChange(next), members([{id,name}]), 나머지는 textarea 로.
export function MentionTextarea({ value, onChange, members, ...textareaProps }) {
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
