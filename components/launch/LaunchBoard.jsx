'use client';

import { useEffect, useMemo, useState } from 'react';
import { dueDate, dDay, dDayLabel } from '@/lib/launchDate';
import {
  BOARD_STATUSES,
  DONE_STATUS,
  BLOCKED_STATUS,
  TODO_STATUS,
  isDone,
  isBlocked,
  isLate,
  isThisWeek,
  isWaitingOnDep,
  isNotApplicable,
  taskTone,
  progress,
} from '@/lib/launchTask';
import { NotApplicableDialog } from '@/components/launch/NotApplicableDialog';

// 런칭 보드.
//
// 400건짜리 목록을 통째로 보여주면 아무도 안 본다. 그래서 기본은 '이번 주'다 —
// 회의에서 실제로 말하는 것이 그것이고, 나머지는 필요할 때 켠다.
//
// 색은 lib/launchTask.js 의 taskTone 하나로 정한다. 화면마다 다르게 칠하면
// 같은 항목이 여기서는 빨강, 저기서는 회색이 된다.
//
// props: launch, tasks, today, onChanged, onReload
export function LaunchBoard({ launch, tasks = [], today, onChanged, onReload }) {
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
  // 체크박스로 고른 항목. 18건을 한 번에 해당없음으로 보내려고 있다.
  const [picked, setPicked] = useState(() => new Set());
  // 다중 처리(해당없음/되돌리기) 중임을 표시. task.id 를 담는 busy 와
  // 섞으면 우연히 id 가 'bulk' 인 항목과 부딪힐 수 있어 따로 둔다.
  const [bulkBusy, setBulkBusy] = useState(false);
  // 해당없음 사유 창을 띄운 항목. 단건·다중 모두 { ids, title } 모양으로
  // 통일한다 — 다이얼로그 하나가 양쪽을 다 받게 하려고.
  const [naFor, setNaFor] = useState(null);
  // ⋯ 메뉴가 열린 항목. 마찬가지로 한 번에 하나만 연다.
  const [menuFor, setMenuFor] = useState(null);

  // 바깥을 누르면 열린 메뉴를 닫는다.
  useEffect(() => {
    if (!menuFor) return undefined;
    const close = () => setMenuFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuFor]);

  const openDate = launch?.open_date;
  const all = useMemo(
    () => ({ tasks, openDate, today }),
    [tasks, openDate, today],
  );

  const stat = useMemo(() => progress(all), [all]);

  // 보기 다섯. 세는 규칙은 전부 launchTask 에서 온다.
  const views = useMemo(
    () => [
      { key: 'week', label: '이번 주', count: stat.thisWeek },
      { key: 'late', label: '지남', count: stat.late },
      { key: 'blocked', label: '막힘', count: stat.blocked },
      { key: 'na', label: '해당없음', count: stat.notApplicable },
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
    else if (view === 'na') list = list.filter(isNotApplicable);
    // '전체'에서는 해당없음을 뺀다. 451줄 사이에 섞이면 읽기 어렵다 —
    // 해당없음은 'na' 보기에서만 본다.
    else list = list.filter((task) => !isNotApplicable(task) || keep(task));

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

  // PATCH 하나로 모은다. 상태 단추·해당없음·되돌리기가 전부 이걸 쓴다.
  async function patchTask(task, body) {
    setBusy(task.id);
    const res = await fetch(`/api/launch/${launch.id}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(null);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '바꾸지 못했습니다.');
      return;
    }
    const resBody = await res.json();
    setError('');
    setTouched((prev) => new Set(prev).add(task.id));
    onChanged?.(resBody.task);
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
    await patchTask(task, { status, ...(blockedReason === undefined ? {} : { blockedReason }) });
  }

  // 해당없음은 사유를 받고 나서야 보낸다. 서버도 빈 사유를 400 으로 막지만,
  // 화면에서 먼저 받는 것이 사람에게 낫다.
  async function markNotApplicable(task, reason) {
    await patchTask(task, { status: '해당없음', excludedReason: reason });
  }

  async function restore(task) {
    await patchTask(task, { status: TODO_STATUS });
  }

  // 여러 줄을 한 번에. 한 줄씩 갈아 끼울 수 없어서 목록을 다시 받는다.
  async function bulkAction(ids, action, reason) {
    setBulkBusy(true);
    const res = await fetch(`/api/launch/${launch.id}/tasks/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: ids, action, ...(reason ? { reason } : {}) }),
    }).catch(() => null);
    setBulkBusy(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '바꾸지 못했습니다.');
      return;
    }
    setError('');
    setPicked(new Set());
    onReload?.();
  }

  async function bulkRestore() {
    await bulkAction([...picked], 'restore');
  }

  // 한 줄 고르기/놓기.
  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 워크스트림 전체 고르기. 이미 다 골랐으면 전부 놓고, 아니면 전부 담는다 —
  // '지금 보이는 줄' 기준이라 접힌 그룹이나 다른 보기의 줄은 안 건드린다.
  function toggleGroupPick(list) {
    setPicked((prev) => {
      const next = new Set(prev);
      const ids = list.map((t) => t.id);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function remove(task) {
    const ok = window.confirm(
      [`${task.code} ${task.title}`, '', '지웁니다. 상태와 사유가 함께 사라집니다.',
       '이 브랜드에 안 하는 일이라면 지우기 대신 「해당없음」을 쓰세요.'].join('\n'),
    );
    if (!ok) return;
    const res = await fetch(`/api/launch/${launch.id}/tasks/${task.id}`, { method: 'DELETE' })
      .catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '지우지 못했습니다.');
      return;
    }
    onReload?.();
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
              // 안 보이는 줄이 고른 채로 남으면 "N건 골랐습니다"가 거짓말이 된다.
              setPicked(new Set());
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
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(new Set());
          }}
          placeholder="항목·역할로 찾기"
          className="ml-auto h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm text-indigo-800">{picked.size}건 골랐습니다</span>
          {view === 'na' ? (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => bulkRestore()}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              다시 해당으로
            </button>
          ) : (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setNaFor({ ids: [...picked], title: '' })}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              해당없음으로
            </button>
          )}
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700"
          >
            선택 해제
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          {view === 'week' && '이번 주에 할 것이 없습니다.'}
          {view === 'late' && '지난 항목이 없습니다.'}
          {view === 'blocked' && '막힌 항목이 없습니다.'}
          {view === 'na' && '해당없음으로 둔 항목이 없습니다.'}
          {view === 'all' && '항목이 없습니다.'}
        </p>
      )}

      {groups.map(([ws, list]) => {
        const closed = closedGroups.has(ws);
        const wsStat = progress({ tasks: list, openDate, today });
        // 이 워크스트림의 '지금 보이는' 줄 기준. 앱 18건처럼 워크스트림
        // 하나에 몰린 항목을 18번 클릭 대신 1번으로 고르게 하려고 있다.
        const groupIds = list.map((t) => t.id);
        const allChecked = groupIds.length > 0 && groupIds.every((id) => picked.has(id));
        const someChecked = groupIds.some((id) => picked.has(id));
        return (
          <section key={ws} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex w-full items-center gap-2 px-4 py-2.5">
              {/* 접기 단추 안에 넣으면 클릭이 접기/펴기와 싸운다 — 밖에 둔다. */}
              <input
                type="checkbox"
                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                checked={allChecked}
                onChange={() => toggleGroupPick(list)}
                aria-label={`${ws} 전체 고르기`}
                className="h-3.5 w-3.5 shrink-0 accent-indigo-600"
              />
              <button
                type="button"
                onClick={() => toggleGroup(ws)}
                className="flex flex-1 items-center gap-2 text-left"
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
            </div>

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
                    checked={picked.has(task.id)}
                    onCheck={togglePick}
                    onStatus={(status) => setStatus(task, status)}
                    menuOpen={menuFor === task.id}
                    onToggleMenu={() => setMenuFor((prev) => (prev === task.id ? null : task.id))}
                    onAskNa={() => {
                      setMenuFor(null);
                      setNaFor({ ids: [task.id], title: `${task.code} ${task.title}` });
                    }}
                    onRestore={() => {
                      setMenuFor(null);
                      restore(task);
                    }}
                    onDelete={() => {
                      setMenuFor(null);
                      remove(task);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <NotApplicableDialog
        open={Boolean(naFor)}
        count={naFor?.ids.length ?? 1}
        title={naFor?.title ?? ''}
        onClose={() => setNaFor(null)}
        onSubmit={(reason) => {
          if (!naFor) return undefined;
          // 단건은 PATCH 로 남긴다 — onChanged 로 그 줄만 바뀌어서 화면이
          // 안 튄다. 다중은 bulk 라우트를 쓰고 onReload 로 전체를 다시
          // 받는다. 회의 중에 스크롤이 튀면 보던 자리를 잃는다.
          if (naFor.ids.length === 1) {
            const task = tasks.find((t) => t.id === naFor.ids[0]);
            return task ? markNotApplicable(task, reason) : undefined;
          }
          return bulkAction(naFor.ids, 'not_applicable', reason);
        }}
      />
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

function TaskRow({
  task, tasks, openDate, today, busy, checked, onCheck, onStatus, menuOpen, onToggleMenu, onAskNa, onRestore, onDelete,
}) {
  const tone = taskTone({ task, openDate, today, tasks });
  const due = dueDate(openDate, task.day_offset);
  const days = dDay(due, today);
  const waiting = isWaitingOnDep({ task, tasks });
  const done = isDone(task);
  const na = isNotApplicable(task);

  return (
    <li className="relative flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
      {/* 고르는 일이 읽는 일보다 먼저 눈에 닿아야 해서 색 점 앞에 둔다. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onCheck(task.id)}
        aria-label={`${task.code} 고르기`}
        className="mt-1 h-3.5 w-3.5 shrink-0 accent-indigo-600"
      />
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_BAR[tone]}`} aria-hidden />

      <div className="min-w-0 flex-1">
        {/* 해당없음은 취소선을 안 쓴다 — 완료와 다른 이유가 화면에서도
            달라 보여야 한다. 완료는 끝난 것, 해당없음은 애초에 할 일이
            아닌 것이다. */}
        <p className={`text-sm ${done ? 'text-slate-400 line-through' : na ? 'text-slate-400' : 'text-slate-800'}`}>
          {/* ★ 는 해당없음일 때 감춘다 — 할 일이 아니니 핵심 표시가 무의미하다. */}
          {task.is_critical && !na && <span className="mr-1 text-amber-500">★</span>}
          <span className="mr-1.5 text-xs tabular-nums text-slate-400">{task.code}</span>
          {task.title}
          {na && (
            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">
              해당없음
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          {na ? (
            // 기한·역할 대신 사유를 보여준다. 이 브랜드에는 왜 없는가가
            // 기한보다 중요하다.
            <span className="text-slate-400">{task.excluded_reason || '사유 없음'}</span>
          ) : (
            <>
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
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {na ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRestore}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            되돌리기
          </button>
        ) : (
          BOARD_STATUSES.map((status) => (
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
          ))
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="더 보기"
        >
          ⋯
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-7 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {na ? (
              <button
                type="button"
                onClick={onRestore}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                다시 해당으로
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAskNa}
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  해당없음으로 두기
                </button>
                <p className="px-2.5 pb-1.5 text-[11px] text-slate-400">
                  이 브랜드에는 안 하는 일. <b>사유를 받습니다.</b>
                </p>
              </>
            )}
            <hr className="my-1 border-slate-100" />
            <button
              type="button"
              onClick={onDelete}
              className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              지우기
            </button>
            <p className="px-2.5 pt-0.5 text-[11px] text-slate-400">
              잘못 넣은 것만. 상태와 사유가 함께 사라집니다.
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
