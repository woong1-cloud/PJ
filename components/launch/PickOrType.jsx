'use client';

import { useState } from 'react';

// 목록에서 고르거나, 없으면 직접 쓴다.
//
// <input list="..."> 를 쓰면 안 된다. 브라우저가 이미 입력된 글자로 목록을
// 걸러내기 때문이다 — 칸에 'CAIO실' 이 들어 있으면 드롭다운에 'CAIO실'
// 하나만 뜬다. 다른 값을 보려면 칸을 통째로 지워야 하는데 아무도 그러지
// 않는다. 실제로 "다른 소속이 나오지 않는다"는 말이 나왔고, 하필 그 칸이
// 제일 자주 바뀌는 칸이었다(범위가 달라지면 주관이 옮겨간다).
//
// 그래서 select 로 전부 보여준다. 다만 못 박지는 않는다 — 새 역할이 생겼을
// 때 넣을 길이 없으면 사람이 다른 칸에 적어 두고, 그 순간 목록이 거짓말이
// 된다.
const CUSTOM = '__custom__';

const box =
  'h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm focus:border-indigo-400 focus:outline-none';

// props: id, value, options, onChange(next), placeholder
export function PickOrType({ id, value = '', options = [], onChange, placeholder }) {
  // 목록에 없는 값이 이미 들어 있으면 직접 입력으로 연다. 안 그러면 select 가
  // 빈칸으로 보이고, 저장하는 순간 멀쩡하던 값이 지워진다.
  const [typing, setTyping] = useState(() => Boolean(value) && !options.includes(value));

  if (typing) {
    return (
      <div className="flex items-center gap-1">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={box}
        />
        <button
          type="button"
          onClick={() => setTyping(false)}
          title="목록에서 고르기"
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50"
        >
          목록
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) {
          // 값을 비우고 직접 입력으로 넘어간다. 남겨 두면 새로 쓰려는 사람이
          // 지우는 일부터 해야 한다.
          onChange('');
          setTyping(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={box}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={CUSTOM}>직접 입력…</option>
    </select>
  );
}
