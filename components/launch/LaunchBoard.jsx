'use client';

import { useMemo, useState } from 'react';
import { dueDate, dDay, dDayLabel } from '@/lib/launchDate';
import {
  LAUNCH_STATUSES,
  DONE_STATUS,
  BLOCKED_STATUS,
  isDone,
  isBlocked,
  isLate,
  isThisWeek,
  isWaitingOnDep,
  taskTone,
  progress,
} from '@/lib/launchTask';

// 런칭 보드.
//
// 400건짜리 목록을 통째로 보여주면 아무도 안 본다. 그래서 기본은 '이번 주'다 —
// 회의에서 실제로 말하는 것이 그것이고, 나머지는 필요할 때 켠다.
//
// 색은 lib/launchTask.js 의 taskTone 하나로 정한다. 화면마다 다르게 칠하면
// 같은 항목이 여기서는 빨강, 저기서는 회색이 된다.
//
// props: launch, tasks, today, onChanged
export function LaunchBoard({ launch, tasks = [], today, onChanged }) {
  const [view, setView] = useState('week');
  const [query, setQuery] = useState('');
  const [closedGroups, setClosedGroups] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  // 이 화면에서 방금 상태를 바꾼 것들.
  //
  // '이번 주'와 '지남'은 완료를 안 센다(launchTask.js). 그래서 완료를 누르면
  // 줄이 사라지는데, 잘못 눌렀을 때 되돌릴 자리가 없어진다. 새로고침 전까지는
  // 남겨 둔다 — 숫자(위 칩)는 진짜 상태 그대로다.
  const [touched, setTouched] = useState(() => new Set());

  const openDate = launch?.open_date;
  const all = useMemo(
    () => ({ tasks, openDate, today }),
    [tasks, openDate, today],
  );

  const stat = useMemo(() => progress(all), [all]);

  // 보기 넷. 세는 규칙은 전부 launchTask 에서 온다.
  const views = useMemo(
    () => [
      { key: 'week', label: '이번 주', count: stat.thisWeek },
      { key: 'late', label: '지남', count: stat.late },
      { key: 'blocked', label: '막힘', count: stat.blocked },
      { key: 'all', label: '전체', count: stat.total },
    ],
    [stat],
  );

  const shown = useMemo(() => {
    const q = query.trim();
    let list = tasks;

    const keep = (task) => touched.has(task.id);
    if (view === 'week')
      list = list.filter((task) => isThisWeek({ task, openDate, today }) || keep(task));
    else if (view === 'late')
      list = list.filter((task) => isLate({ task, openDate, today }) || keep(task));
    else if (view === 'blocked') list = list.filter((task) => isBlocked(task) || keep(task));

    if (q) {
      list = list.filter((task) =>
        [task.code, task.title, task.note, task.deliverable, task.owner_role, task.category]
          .filter(Boolean)
          .join(' ')
          .includes(q),
      );
    }
    return list;
  }, [tasks, view, query, openDate, today, touched]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const task of shown) {
      if (!map.has(task.workstream)) map.set(task.workstream, []);
      map.get(task.workstream).push(task);
    }
    // 기한 순으로 세운다. 워크스트림 안에서 sort_order 는 시트의 줄 순서일
    // 뿐이고, 회의에서 보는 순서는 언제까지인가다.
    for (const list of map.values()) list.sort((a, b) => a.day_offset - b.day_offset);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [shown]);

  function toggleGroup(ws) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(ws)) next.delete(ws);
      else next.add(ws);
      return next;
    });
  }

  // 상태를 바꾼다. 막힘으로 갈 때만 이유를 묻는다 — 이유 없는 막힘은
  // 회의에서 "그래서 뭐가 문제죠"로 시작하게 만든다.
  async function setStatus(task, status) {
    let blockedReason;
    if (status === BLOCKED_STATUS) {
      const answer = window.prompt(`${task.code} ${task.title}\n\n무엇에 막혔나요?`, '');
      // 취소는 취소다. 빈 문자열(그냥 확인)은 이유 없이 막힘으로 둔다.
      if (answer === null) return;
      blockedReason = answer;
    }

    setBusy(task.id);
    const res = await fetch(`/api/launch/${launch.id}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(blockedReason === undefined ? {} : { blockedReason }) }),
    }).catch(() => null);
    setBusy(null);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '바꾸지 못했습니다.');
      return;
    }
    const body = await res.json();
    setError('');
    setTouched((prev) => new Set(prev).add(task.id));
    onChanged?.(body.task);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              setView(v.key);
              // 보기를 옮기면 남겨 두던 것을 놓는다. 안 그러면 '이번 주'에서
              // 완료한 줄이 '막힘' 목록에 따라 들어온다.
              setTouched(new Set());
            }}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              view === v.key
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {v.label}
            <span className="ml-1.5 text-xs tabular-nums text-slate-400">{v.count}</span>
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="항목·역할로 찾기"
          className="ml-auto h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          {view === 'week' && '이번 주에 할 것이 없습니다.'}
          {view === 'late' && '지난 항목이 없습니다.'}
          {view === 'blocked' && '막힌 항목이 없습니다.'}
          {view === 'all' && '항목이 없습니다.'}
        </p>
      )}

      {groups.map(([ws, list]) => {
        const closed = closedGroups.has(ws);
        const wsStat = progress({ tasks: list, openDate, today });
        return (
          <section key={ws} className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggleGroup(ws)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
            >
              <span className="text-xs text-slate-400">{closed ? '▸' : '▾'}</span>
              <span className="font-medium text-slate-800">{ws}</span>
              <span className="text-xs tabular-nums text-slate-400">
                {wsStat.done}/{wsStat.total}
              </span>
              {wsStat.late > 0 && (
                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-700">
                  지남 {wsStat.late}
                </span>
              )}
              {wsStat.blocked > 0 && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                  막힘 {wsStat.blocked}
                </span>
              )}
            </button>

            {!closed && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {list.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    openDate={openDate}
                    today={today}
                    busy={busy === task.id}
                    onStatus={(status) => setStatus(task, status)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

const TONE_BAR = {
  done: 'bg-emerald-400',
  blocked: 'bg-amber-500',
  late: 'bg-rose-500',
  soon: 'bg-indigo-400',
  waiting: 'bg-slate-300',
  flat: 'bg-transparent',
};

function TaskRow({ task, tasks, openDate, today, busy, onStatus }) {
  const tone = taskTone({ task, openDate, today, tasks });
  const due = dueDate(openDate, task.day_offset);
  const days = dDay(due, today);
  const waiting = isWaitingOnDep({ task, tasks });
  const done = isDone(task);

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_BAR[tone]}`} aria-hidden />

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {task.is_critical && <span className="mr-1 text-amber-500">★</span>}
          <span className="mr-1.5 text-xs tabular-nums text-slate-400">{task.code}</span>
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          {due && (
            <span className="tabular-nums">
              {due}
              {!done && days !== null && (
                <span className={days < 0 ? 'ml-1 text-rose-600' : 'ml-1 text-slate-400'}>
                  {dDayLabel(days)}
                </span>
              )}
            </span>
          )}
          {task.owner_role && <span>{task.owner_role}</span>}
          {task.decision_org && <span className="text-slate-400">결정 {task.decision_org}</span>}
          {waiting && !done && (
            <span className="text-slate-400">선행 {task.depends_on.join(', ')} 대기</span>
          )}
          {isBlocked(task) && task.blocked_reason && (
            <span className="text-amber-700">막힘 — {task.blocked_reason}</span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        {LAUNCH_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            onClick={() => onStatus(status)}
            className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
              task.status === status
                ? status === DONE_STATUS
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : status === BLOCKED_STATUS
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>
    </li>
  );
}
