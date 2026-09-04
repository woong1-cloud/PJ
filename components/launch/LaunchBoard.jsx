'use client';

import { useEffect, useMemo, useState } from 'react';
import { dueDate, dDay, dDayLabel } from '@/lib/launchDate';
import { matchesItem } from '@/lib/launchSearch';
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
import { TaskEditDialog } from '@/components/launch/TaskEditDialog';
import { BlockDialog } from '@/components/launch/BlockDialog';

// 역할 문자열 하나. support_role 에 '온라인BU 광고기획 , 브랜드PM' 처럼
// 쉼표로 둘이 든 값이 5건 있다 — 정확히 같은지만 보면 그 5건이 안 잡힌다.
function splitRoles(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasRole(value, role) {
  return splitRoles(value).includes(role);
}

function roleStorageKey(launchId) {
  return `moa.launch.${launchId}.role`;
}

// 사생활 보호 모드에서 localStorage 가 던진다. 못 읽으면 안 고른 것으로 친다.
function readStoredRole(launchId) {
  if (!launchId) return '';
  try {
    return localStorage.getItem(roleStorageKey(launchId)) || '';
  } catch {
    return '';
  }
}

// 런칭 보드.
//
// 400건짜리 목록을 통째로 보여주면 아무도 안 본다. 그래서 기본은 '이번 주'다 —
// 회의에서 실제로 말하는 것이 그것이고, 나머지는 필요할 때 켠다.
//
// 색은 lib/launchTask.js 의 taskTone 하나로 정한다. 화면마다 다르게 칠하면
// 같은 항목이 여기서는 빨강, 저기서는 회색이 된다.
//
// props: launch, tasks, today, onChanged, onReload, decisions, onDecisionCreated,
//        onBlockedChanged
//
// decisions 는 BlockDialog 의 '어느 결정인가요' 드롭다운과, 막힌 줄의
// '결정 대기 · 제목' 표시가 같이 쓴다 — 결정 목록은 페이지가 갖고 있고
// (탭 건수 배지가 필요해서) 보드는 읽기만 한다.
export function LaunchBoard({
  launch, tasks = [], today, onChanged, onReload, decisions = [], onDecisionCreated, onBlockedChanged,
}) {
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
  // 막힘 사유 창을 띄운 항목. window.prompt 대신 종류를 가르는 창을 연다.
  const [blockFor, setBlockFor] = useState(null);
  // ⋯ 메뉴가 열린 항목. 마찬가지로 한 번에 하나만 연다.
  const [menuFor, setMenuFor] = useState(null);
  // 항목 편집 창. { mode: 'create' } 또는 { mode: 'edit', task } 또는 null.
  // 만들기·고치기가 같은 창(TaskEditDialog)을 쓴다 — 필드가 거의 같아서다.
  const [taskDialog, setTaskDialog] = useState(null);
  // 역할 필터. 회의에서 "물류팀 것 봅시다" 하고 고르는 사람 기준이지, 화면을
  // 띄운 사람 기준이 아니다 — 그래서 자동으로는 안 고른다.
  //
  // localStorage 읽기는 초기화 함수 안에 두면 effect 가 필요 없다.
  const [selectedRole, setSelectedRole] = useState(() => readStoredRole(launch?.id));
  const [roleTab, setRoleTab] = useState('owner');

  // 고른 역할을 런칭별로 기억한다. 서버 작업은 없다 — 이 브라우저에서 다음에
  // 같은 런칭을 열 때만 쓰는, 회의 준비용 편의다.
  useEffect(() => {
    if (!launch?.id) return;
    try {
      if (selectedRole) localStorage.setItem(roleStorageKey(launch.id), selectedRole);
      else localStorage.removeItem(roleStorageKey(launch.id));
    } catch {
      // 사생활 보호 모드 등. 기억 못 해도 화면은 그대로 동작해야 한다.
    }
  }, [selectedRole, launch?.id]);

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

  // 막힌 줄의 '결정 대기 · 제목' 표시가 쓴다.
  const decisionsById = useMemo(() => new Map(decisions.map((d) => [d.id, d])), [decisions]);

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

    // 찾는 규칙은 lib/launchSearch.js 하나다. 가이드와 같은 함수를 쓴다 —
    // 두 화면에 따로 쓰면 한쪽만 고쳐진다.
    if (q) list = list.filter((task) => matchesItem(task, q));
    return list;
  }, [tasks, view, query, openDate, today, touched]);

  // 워크스트림·역할·소속 후보. 항목 편집 창의 datalist 와 역할 필터
  // 드롭다운이 같이 쓴다 — 어차피 같은 476건에서 뽑는 값이다.
  const workstreams = useMemo(() => {
    const set = new Set(tasks.map((t) => t.workstream).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [tasks]);

  const roleOptions = useMemo(() => {
    const set = new Set();
    for (const task of tasks) {
      splitRoles(task.owner_role).forEach((r) => set.add(r));
      splitRoles(task.support_role).forEach((r) => set.add(r));
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [tasks]);

  const orgOptions = useMemo(() => {
    const set = new Set();
    for (const task of tasks) {
      if (task.decision_org) set.add(task.decision_org.trim());
      if (task.owner_org) set.add(task.owner_org.trim());
    }
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [tasks]);

  // 역할 탭 셋. 이름에 고른 역할이 들어가야 한다 — 화면 띄운 사람이
  // 브랜드PM인데 물류팀 것을 보고 있을 수 있어 '내가 할 것'은 거짓말이다.
  const roleTabs = useMemo(() => {
    if (!selectedRole) return [];
    return [
      {
        key: 'owner',
        label: `${selectedRole}이 할 것`,
        count: shown.filter((task) => hasRole(task.owner_role, selectedRole)).length,
      },
      {
        key: 'support',
        label: `${selectedRole}이 도울 것`,
        count: shown.filter((task) => hasRole(task.support_role, selectedRole)).length,
      },
      {
        key: 'all',
        label: '전부',
        count: shown.filter(
          (task) => hasRole(task.owner_role, selectedRole) || hasRole(task.support_role, selectedRole),
        ).length,
      },
    ];
  }, [shown, selectedRole]);

  // 역할 필터는 기존 보기 칩과 겹쳐 적용된다 — '물류팀이 할 것' + '이번 주'가
  // 함께 걸린다. 안 고르면 지금과 똑같이 동작해야 하니 그대로 통과시킨다.
  const roleFiltered = useMemo(() => {
    if (!selectedRole) return shown;
    if (roleTab === 'owner') return shown.filter((task) => hasRole(task.owner_role, selectedRole));
    if (roleTab === 'support') return shown.filter((task) => hasRole(task.support_role, selectedRole));
    return shown.filter(
      (task) => hasRole(task.owner_role, selectedRole) || hasRole(task.support_role, selectedRole),
    );
  }, [shown, selectedRole, roleTab]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const task of roleFiltered) {
      if (!map.has(task.workstream)) map.set(task.workstream, []);
      map.get(task.workstream).push(task);
    }
    // 기한 순으로 세운다. 워크스트림 안에서 sort_order 는 시트의 줄 순서일
    // 뿐이고, 회의에서 보는 순서는 언제까지인가다.
    for (const list of map.values()) list.sort((a, b) => a.day_offset - b.day_offset);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [roleFiltered]);

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

    // blocked_decision_id 가 바뀌었으면(막히거나 · 풀리거나 · 다른 결정으로
    // 바뀌거나) 결정 대기 목록의 waitingCount 가 그 순간 낡는다. 페이지가
    // 그 목록을 다시 받아 온다 — 탭 배지·결정 대기 화면이 보드와 어긋나면
    // "3건이 기다린다"는 말을 못 믿게 된다.
    if (resBody.task?.blocked_decision_id !== task.blocked_decision_id) onBlockedChanged?.();
  }

  // 상태를 바꾼다. 막힘으로 갈 때는 창을 띄워 종류(의사결정/그 밖)를 가른다
  // — window.prompt 로 이유만 받으면 결정 대기와 이을 길이 없다.
  async function setStatus(task, status) {
    if (status === BLOCKED_STATUS) {
      setBlockFor(task);
      return;
    }
    await patchTask(task, { status });
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
      {/* 역할 필터. 모아의 조직과 런칭의 역할은 다른 축이라 이을 데이터가
          없다 — 그래서 자동으로 안 고르고 사람이 고른다. 회의에서 화면 띄운
          사람이 "물류팀 것 봅시다" 하고 누르는 자리다. */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="role-filter" className="text-xs text-slate-500">
          역할로 보기
        </label>
        <select
          id="role-filter"
          value={selectedRole}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            // 새로 고른 역할이면 '할 것'부터 본다 — 가장 흔히 찾는 것이다.
            setRoleTab('owner');
          }}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-600 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">고르지 않음</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {selectedRole &&
          roleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setRoleTab(t.key)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                roleTab === t.key
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
              <span className="ml-1 tabular-nums text-slate-400">{t.count}</span>
            </button>
          ))}
        {selectedRole && (
          <button
            type="button"
            onClick={() => setSelectedRole('')}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            역할 해제
          </button>
        )}
      </div>

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
        <button
          type="button"
          onClick={() => setTaskDialog({ mode: 'create' })}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ＋ 항목
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(new Set());
          }}
          placeholder="항목·역할로 찾기"
          className="h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
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
          {selectedRole ? (
            `${roleTabs.find((t) => t.key === roleTab)?.label ?? selectedRole} 항목이 이 보기에 없습니다.`
          ) : (
            <>
              {view === 'week' && '이번 주에 할 것이 없습니다.'}
              {view === 'late' && '지난 항목이 없습니다.'}
              {view === 'blocked' && '막힌 항목이 없습니다.'}
              {view === 'na' && '해당없음으로 둔 항목이 없습니다.'}
              {view === 'all' && '항목이 없습니다.'}
            </>
          )}
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
                    blockedDecisionTitle={
                      task.blocked_decision_id
                        ? (decisionsById.get(task.blocked_decision_id)?.title ?? '(지워진 결정)')
                        : null
                    }
                    busy={busy === task.id}
                    checked={picked.has(task.id)}
                    onCheck={togglePick}
                    onStatus={(status) => setStatus(task, status)}
                    menuOpen={menuFor === task.id}
                    onToggleMenu={() => setMenuFor((prev) => (prev === task.id ? null : task.id))}
                    onEdit={() => {
                      setMenuFor(null);
                      setTaskDialog({ mode: 'edit', task });
                    }}
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

      <BlockDialog
        open={Boolean(blockFor)}
        task={blockFor}
        launchId={launch.id}
        decisions={decisions}
        onClose={() => setBlockFor(null)}
        onSubmit={(patch) => (blockFor ? patchTask(blockFor, { status: BLOCKED_STATUS, ...patch }) : undefined)}
        onDecisionCreated={onDecisionCreated}
      />

      <TaskEditDialog
        open={Boolean(taskDialog)}
        mode={taskDialog?.mode ?? 'edit'}
        launch={launch}
        task={taskDialog?.mode === 'edit' ? taskDialog.task : null}
        workstreams={workstreams}
        roles={roleOptions}
        orgs={orgOptions}
        onClose={() => setTaskDialog(null)}
        onSaved={(task) => {
          const wasCreate = taskDialog?.mode === 'create';
          setTaskDialog(null);
          // 고치기는 그 줄만 갈아 끼운다(onChanged) — 새로 넣기는 목록
          // 자체가 길어지므로 통째로 다시 받는다(onReload), bulkAction 과
          // 같은 규칙이다.
          if (wasCreate) onReload?.();
          else onChanged?.(task);
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
  task, tasks, openDate, today, blockedDecisionTitle, busy, checked, onCheck, onStatus, menuOpen,
  onToggleMenu, onEdit, onAskNa, onRestore, onDelete,
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
              {waiting && !done && (
                <span className="text-slate-400">선행 {task.depends_on.join(', ')} 대기</span>
              )}
              {/* 어느 결정을 기다리는지가 자유 사유보다 먼저다 — 결정이
                  풀리면 이 항목도 풀린다는 인과가 여기서 보여야 한다. */}
              {isBlocked(task) && blockedDecisionTitle && (
                <span className="text-indigo-700">결정 대기 · {blockedDecisionTitle}</span>
              )}
              {isBlocked(task) && !blockedDecisionTitle && task.blocked_reason && (
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
            <button
              type="button"
              onClick={onEdit}
              className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              내용 고치기
            </button>
            <hr className="my-1 border-slate-100" />
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
