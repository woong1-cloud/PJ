'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dueDate, dDay, dDayLabel } from '@/lib/launchDate';
import { matchesItem } from '@/lib/launchSearch';
import { assigneeId } from '@/lib/launchMembers';
import { GROUP_MODES, groupTasks } from '@/lib/launchGroup';
import {
  BOARD_STATUSES,
  DONE_STATUS,
  BLOCKED_STATUS,
  TODO_STATUS,
  isDone,
  isBlocked,
  isLate,
  isReady,
  readyCount,
  isThisWeek,
  isWaitingOnDep,
  isNotApplicable,
  taskTone,
  progress,
} from '@/lib/launchTask';
import { missingDeps, prevTasks, unlockCount } from '@/lib/launchDeps';
import { taskByCode } from '@/lib/launchTaskLink';
import { NotApplicableDialog } from '@/components/launch/NotApplicableDialog';
import { TaskViewDialog } from '@/components/launch/TaskViewDialog';
import { TaskEditDialog } from '@/components/launch/TaskEditDialog';
import { BlockDialog } from '@/components/launch/BlockDialog';
import { HelpRequestDialog } from '@/components/launch/HelpRequestDialog';

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

// 역할을 물어봤는지. 고른 역할과 따로 둔다 — '전체 보기'나 '나중에'를
// 고르면 역할은 빈 값인데 물어보기는 끝난 것이라, 하나로 합치면 화면을
// 열 때마다 다시 묻는다.
function askedStorageKey(launchId) {
  return `moa.launch.${launchId}.roleAsked`;
}

function readAsked(launchId) {
  if (!launchId) return false;
  try {
    return localStorage.getItem(askedStorageKey(launchId)) === '1';
  } catch {
    // 사생활 보호 모드. 기억을 못 하면 매번 묻게 되는데, 그 편이 한 번도
    // 안 묻는 것보다 낫다 — 이 띠는 무시하고 지나갈 수 있다.
    return false;
  }
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
// 400건짜리 목록을 통째로 보여주면 아무도 안 본다. 그래서 기본을 하나 건다.
//
// 기본은 '착수 가능'이다. 오래 '이번 주'였는데, 실제로 열어 보니 487건에서
// 이번 주가 4건이었고 그 4건도 여는 사람의 것이 아니었다 — 오픈이 D-119 라
// 기한이 이번 주에 몰릴 이유가 없고, 앞으로 몇 달 계속 그렇다.
//
// 어느 역할로 걸러도 마찬가지다: 브랜드PM 0 · 브랜드 0 · 개발PM 1 ·
// 서비스기획 2. 역할 필터를 아무리 잘 만들어도 '이번 주'가 기본인 한
// 첫 화면은 비어 있다.
//
// '이번 주'는 "언제까지"에 답하고 '착수 가능'은 "지금 뭐부터"에 답한다.
// 회의를 여는 순간 필요한 것은 뒤쪽이다.
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
  focusWorkstream = '', onClearFocus, members = [], canAdmin = false,
  // 화면 상태는 주소가 갖는다. 여기서 useState 로 들고 있으면 링크를 보내도
  // 받는 사람은 다른 화면을 본다 — 보기·묶기·역할·담당자·검색이 그렇다.
  view, group, role, roleInUrl, assignee, query, myMemberId, taskCode,
  onParams, onQuery, onReset,
}) {
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
  // 협조 요청 창을 띄운 항목들. id 배열이다 — 단건(항목 창의 단추)과
  // 다중(고른 줄 배너)이 같은 창을 쓴다.
  const [helpFor, setHelpFor] = useState(null);
  // 활동을 다시 받으라는 신호. 협조 요청은 그 항목에 댓글을 한 줄 남기는데,
  // 항목 창이 열린 채라면 그 창은 자기 밖에서 생긴 일을 모른다.
  const [activityKey, setActivityKey] = useState(0);
  // 항목 편집 창. { mode: 'create' } 또는 { mode: 'edit', task } 또는 null.
  // 만들기·고치기가 같은 창(TaskEditDialog)을 쓴다 — 필드가 거의 같아서다.
  const [taskDialog, setTaskDialog] = useState(null);
  // 역할 필터. 회의에서 "물류팀 것 봅시다" 하고 고르는 사람 기준이지, 화면을
  // 띄운 사람 기준이 아니다 — 그래서 자동으로는 안 고른다.
  //
  // 고른 값은 주소가 갖는다(role props). 브라우저 기억은 아래 effect 가
  // 주소로 한 번 올릴 때만 읽는다.
  const [roleTab, setRoleTab] = useState('owner');
  // 역할을 물어봤나. 한 번 답하면(고르든 넘기든) 다시 안 묻는다.
  const [roleAsked, setRoleAsked] = useState(() => readAsked(launch?.id));
  // 담당자 필터. 역할과 다른 축이라(회의에서 "물류팀 것" 과 "이 사람 것"은
  // 다른 질문이다) 따로 두고, 겹쳐 적용한다.
  const [selectedAssignee, setSelectedAssignee] = useState('');

  // 역할의 출처는 하나다. 주소에 role 키가 있으면 주소가 이기고, 없으면
  // 브라우저 기억을 읽어 곧바로 주소에 쓴다.
  //
  // 마운트 때 한 번 주소에 올리는 것이 요점이다. 안 그러면 역할을 안 건드리고
  // 보기만 바꿔 링크를 보냈을 때, 받는 사람은 자기 역할로 본다 — 링크가
  // 사람마다 다른 것을 가리키면 안 된다.
  // 한 번만 도는 것을 ref 로 못 박는다. roleInUrl 만 보면 '마운트 때 한 번'이
  // 아니라 '주소에서 role 이 사라질 때마다'가 된다 — localStorage 읽기는 되는데
  // 쓰기만 실패하는 자리(사생활 보호 모드·용량 초과)에서 「역할 전체」를 고르면
  // 기억이 안 지워진 채 이 effect 가 곧바로 되돌려, 전체를 영영 못 고른다.
  const roleHydrated = useRef(false);
  useEffect(() => {
    // launch 가 아직 안 왔으면 아무것도 정하지 않는다. ref 를 여기서 태우면
    // 첫 렌더(launch 가 null)에 한 번 태우고 끝나서, 데이터가 도착한 뒤에는
    // 이미 늦다 — 데이터가 빨리 오면 되고 늦게 오면 안 되는 화면이 된다.
    if (roleHydrated.current || !launch?.id) return;
    // 여기서부터는 정할 수 있다. 정했으니 다시 안 정한다.
    roleHydrated.current = true;
    if (roleInUrl) return;
    const stored = readStoredRole(launch.id);
    if (stored) onParams?.({ role: stored });
  }, [roleInUrl, launch?.id, onParams]);

  useEffect(() => {
    if (!launch?.id) return;
    try {
      if (roleAsked) localStorage.setItem(askedStorageKey(launch.id), '1');
      else localStorage.removeItem(askedStorageKey(launch.id));
    } catch {
      // 위와 같다.
    }
  }, [roleAsked, launch?.id]);

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
  // 착수 가능은 런칭 전체 목록에서만 셀 수 있다 — 선행이 워크스트림을
  // 넘나든다. 그래서 progress 와 따로 센다(lib/launchTask.js 참고).
  const readyTotal = useMemo(() => readyCount(tasks), [tasks]);

  // 창은 state 가 아니라 주소가 연다. 입구가 셋(줄 제목·「풀림 N」·선행 칩)인데
  // state 로 두면 링크로 들어온 사람만 다른 길을 타게 되고, 창 안에서 연계를
  // 타고 옮겨 다닌 것이 주소에 안 남아 그 화면을 남에게 못 보낸다.
  const { task: viewTask, missing: missingCode } = useMemo(
    () => taskByCode({ tasks, code: taskCode }),
    [tasks, taskCode],
  );

  // 막힌 줄의 '결정 대기 · 제목' 표시가 쓴다.
  const decisionsById = useMemo(() => new Map(decisions.map((d) => [d.id, d])), [decisions]);

  // 보기 다섯. 세는 규칙은 전부 launchTask 에서 온다.
  const views = useMemo(
    () => [
      { key: 'week', label: '이번 주', count: stat.thisWeek },
      { key: 'late', label: '지남', count: stat.late },
      { key: 'blocked', label: '막힘', count: stat.blocked },
      // '막힘'의 반대말 자리라 그 옆에 둔다. 회의에서 "막힌 것"과
      // "지금 할 수 있는 것"은 잇달아 묻는 질문이다.
      { key: 'ready', label: '착수 가능', count: readyTotal },
      { key: 'na', label: '해당없음', count: stat.notApplicable },
      { key: 'all', label: '전체', count: stat.total },
    ],
    [stat, readyTotal],
  );

  // 지금 보기의 순수 판정. shown 과 「내 담당」 건수가 같이 쓴다.
  //
  // keep(방금 건드린 줄 남기기)은 여기 안 넣는다. 칩의 숫자에 그것이 섞이면
  // 줄을 하나 건드릴 때마다 "내 담당 7"이 8이 됐다 7이 됐다 한다.
  const inView = useCallback((task) => {
    if (view === 'week') return isThisWeek({ task, openDate, today });
    if (view === 'late') return isLate({ task, openDate, today });
    if (view === 'blocked') return isBlocked(task);
    // 선행이 다 끝난 할 것. 기한 필터를 안 건다 — D-120 짜리도 지금 시작할 수
    // 있으면 여기 있어야 한다, 그게 이 보기의 쓸모다.
    if (view === 'ready') return isReady({ task, tasks });
    if (view === 'na') return isNotApplicable(task);
    // '전체'에서는 해당없음을 뺀다. 451줄 사이에 섞이면 읽기 어렵다.
    return !isNotApplicable(task);
  }, [view, openDate, today, tasks]);

  // 지금 보기 안에서 내 담당이 몇 건인가. 보기를 바꾸면 이 숫자도 바뀐다 —
  // 겹쳐 걸리는 축이라 그래야 맞다.
  const mineCount = useMemo(() => {
    if (!myMemberId) return 0;
    return tasks.filter((t) => assigneeId(t) === myMemberId && inView(t)).length;
  }, [tasks, myMemberId, inView]);

  // 무언가 걸려 있을 때만 초기화를 보여준다. 아무것도 안 걸렸는데 초기화가
  // 떠 있으면 누를 것을 찾게 된다.
  // 걸린 것이 하나라도 있나. selectedAssignee(이름 드롭다운)도 센다 — 빼면
  // 그것만 골랐을 때 '필터 초기화'가 안 떠서 되돌릴 길이 없다.
  const hasFilter =
    Boolean(role || assignee || selectedAssignee || query.trim()) || view !== 'ready';

  const shown = useMemo(() => {
    const q = query.trim();
    let list = tasks;

    // 간트에서 막대를 눌러 넘어왔다. 검색과 따로 두는 이유: 사람이 검색어를
    // 치면 그건 다른 것을 찾겠다는 뜻이라 이 걸림은 남아 있어야 한다.
    if (focusWorkstream) list = list.filter((t) => t.workstream === focusWorkstream);

    // 내 담당. 보기 칩과 겹쳐 걸리는 다른 축이라 여기서 따로 건다 —
    // "내 담당 중 이번 주"가 되어야 한다.
    if (assignee) list = list.filter((task) => assigneeId(task) === assignee);

    const keep = (task) => touched.has(task.id);
    // 해당없음 보기에서는 keep 을 안 쓴다 — 되돌린 줄이 '해당없음' 목록에
    // 남아 있을 이유가 없다. (기존 동작 그대로다.)
    list = view === 'na'
      ? list.filter(inView)
      : list.filter((task) => inView(task) || keep(task));

    // 찾는 규칙은 lib/launchSearch.js 하나다. 가이드와 같은 함수를 쓴다 —
    // 두 화면에 따로 쓰면 한쪽만 고쳐진다.
    if (q) list = list.filter((task) => matchesItem(task, q));
    return list;
  }, [tasks, inView, view, query, touched, focusWorkstream, assignee]);

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

  // 역할별로 지금 착수할 수 있는 건수.
  //
  // 고른 뒤에 실제로 보게 될 숫자와 같아야 한다. 고르면 보기는 '착수 가능'
  // (기본값)이고 역할 탭은 '할 것'(주관)이라, 여기서도 주관만 센다 —
  // 띠에 40 이라고 써 놓고 39 가 나오면 그 숫자를 다시 안 믿는다.
  //
  // 주관으로 한 번도 안 나오는 역할은 띠에 안 올린다 — 상품등록팀 ·
  // 온라인BU AI 컨텐츠는 지원으로만 있어서, 고르면 '할 것'이 0건인
  // 빈 화면으로 떨어진다. 지원만 하는 역할은 드롭다운에서 고르면 된다.
  const readyByRole = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      for (const r of splitRoles(task.owner_role)) {
        if (!map.has(r)) map.set(r, 0);
      }
    }
    for (const task of tasks) {
      if (!isReady({ task, tasks })) continue;
      for (const r of splitRoles(task.owner_role)) {
        if (map.has(r)) map.set(r, map.get(r) + 1);
      }
    }
    // 많은 쪽이 앞이다. 숫자가 보이는 목록이 그 숫자로 안 정렬돼 있으면
    // 눈이 한 번 더 훑어야 한다.
    return [...map.entries()]
      .map(([role, ready]) => ({ role, ready }))
      .sort((a, b) => b.ready - a.ready || a.role.localeCompare(b.role, 'ko'));
  }, [tasks]);

  // 역할 고르기 띠를 지금 띄우나.
  //
  // 세 조건이 다 맞아야 한다 — 아직 안 골랐고, 물어본 적 없고, 고를
  // 역할이 있다. 역할이 하나도 없는 런칭(가져오기 전)에서는 빈 띠가
  // 자리만 차지한다.
  const showRoleStrip = !role && !roleAsked && readyByRole.length > 0;

  // 사람이 고른 것만 기억한다. 링크로 들어온 역할은 이 자리를 안 지나므로
  // 남의 링크 한 번 열었다가 내 기본 역할이 바뀌는 일이 없다.
  // extra 는 role 과 같이 주소에 얹을 것. 따로 두 번 부르면 두 번째가 낡은
  // 주소를 기준으로 병합될 수 있어 한 번에 보낸다.
  function chooseRole(next, extra = {}) {
    try {
      if (next) localStorage.setItem(roleStorageKey(launch.id), next);
      else localStorage.removeItem(roleStorageKey(launch.id));
    } catch { /* 사생활 보호 모드에서 던진다. 기억을 못 해도 화면은 돌아야 한다. */ }
    onParams?.({ role: next, ...extra });
    // 새로 고른 역할이면 '할 것'부터 본다 — 가장 흔히 찾는 것이다.
    setRoleTab('owner');
  }

  function pickRole(next) {
    // 그 역할에 지금 착수할 것이 없으면 '전체'로 보낸다. 방금 자기 역할을 고른
    // 사람에게 빈 화면을 주면 "내 일이 없다"가 아니라 "잘못 골랐나"로 읽힌다.
    const ready = readyByRole.find((r) => r.role === next)?.ready ?? 0;
    chooseRole(next, ready === 0 ? { view: 'all' } : {});
    setRoleAsked(true);
  }

  // 담당자 후보. 방금 생긴 값이라 대부분 비어 있다 — 드롭다운을 보일지
  // 말지(하나라도 있을 때만) 이 길이로 정한다.
  const assigneeOptions = useMemo(() => {
    const set = new Set();
    for (const task of tasks) {
      const name = String(task.assignee_name ?? '').trim();
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [tasks]);

  // 채널은 런칭마다 다르다 — HOKA 는 공통·자사몰·외부몰·무신사·네이버 다.
  // lib/channels.js 의 고정 5종은 요구사항용이라 여기 쓰면 무신사·네이버가
  // 사라진다.
  const channelOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.channel).filter(Boolean));
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

  // 담당자 필터까지 겹친 기준선. 역할 탭 건수와 역할 필터 결과가 둘 다
  // 이걸 base 로 삼아야 "물류팀 것" 이 "이 사람 것" 과 항상 같이 걸린다.
  const assigneeFilteredShown = useMemo(() => {
    if (!selectedAssignee) return shown;
    return shown.filter((task) => task.assignee_name === selectedAssignee);
  }, [shown, selectedAssignee]);

  // 역할 탭 셋. 이름에 고른 역할이 들어가야 한다 — 화면 띄운 사람이
  // 브랜드PM인데 물류팀 것을 보고 있을 수 있어 '내가 할 것'은 거짓말이다.
  // 역할을 드롭다운으로 이미 골랐으니 라벨에 역할 이름을 반복하지 않는다.
  const roleTabs = useMemo(() => {
    if (!role) return [];
    return [
      {
        key: 'owner',
        label: '할 것',
        count: assigneeFilteredShown.filter((task) => hasRole(task.owner_role, role)).length,
      },
      {
        key: 'support',
        label: '도울 것',
        count: assigneeFilteredShown.filter((task) => hasRole(task.support_role, role)).length,
      },
      {
        key: 'all',
        label: '둘 다',
        count: assigneeFilteredShown.filter(
          (task) => hasRole(task.owner_role, role) || hasRole(task.support_role, role),
        ).length,
      },
    ];
  }, [assigneeFilteredShown, role]);

  // 역할·담당자 필터는 기존 보기 칩과 겹쳐 적용된다 — '물류팀이 할 것' +
  // '이번 주'가 함께 걸린다. 둘 다 안 고르면 지금과 똑같이 동작해야 하니
  // 그대로 통과시킨다.
  const roleFiltered = useMemo(() => {
    const base = assigneeFilteredShown;
    if (!role) return base;
    if (roleTab === 'owner') return base.filter((task) => hasRole(task.owner_role, role));
    if (roleTab === 'support') return base.filter((task) => hasRole(task.support_role, role));
    return base.filter(
      (task) => hasRole(task.owner_role, role) || hasRole(task.support_role, role),
    );
  }, [assigneeFilteredShown, role, roleTab]);

  // 묶는 기준은 여기 하나로 — lib/launchGroup.js. 워크스트림 하나만 있던
  // 자리에 담당자·주·안 묶음이 더해졌다. 세는 규칙은 그대로 launchTask.js
  // 에서 온 progress() 를 그룹별로 다시 부른다(아래).
  const groups = useMemo(
    () => groupTasks({ tasks: roleFiltered, mode: group, openDate, today }),
    [roleFiltered, group, openDate, today],
  );

  // 묶는 기준을 바꾸면 접힘·선택을 놓는다. 다른 기준의 그룹 키(예:
  // 워크스트림 이름과 담당자 이름이 우연히 같음)가 엉뚱하게 접힌 채로
  // 넘어오는 것을 막고, 안 보이게 된 줄이 '골랐다'고 남는 것도 막는다.
  // 주소에 있는 것은 훅이 지우고, 이 화면만 들고 있는 것은 여기서 지운다.
  // selectedAssignee 를 빼먹으면 '초기화'를 눌러도 이름 필터가 조용히 살아남아,
  // 왜 몇 건밖에 없는지 알 수 없는 화면이 된다.
  function resetAll() {
    setSelectedAssignee('');
    onReset?.();
  }

  function changeGroupMode(mode) {
    setClosedGroups(new Set());
    setPicked(new Set());
    // '이번 주만 보기'와 '주별로 묶어 보기'는 서로 상쇄된다 — 한 주만 남겨놓고
    // 주별로 묶으면 묶음이 하나거나 빈 화면이다. 실제로 온라인BU 서비스기획의
    // 할 일 22건은 전부 D-95~D-25 라 이번 주에 0건이고, 그대로 두면 아무것도
    // 안 보인다.
    onParams?.(mode === 'week' && view === 'week' ? { group: mode, view: 'all' } : { group: mode });
  }

  function toggleGroup(key) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      {/* 보기 칩 줄. 역할·담당자 필터가 왼쪽 끝, 보기 칩, 오른쪽 끝에
          만들기·찾기·묶기. 예전에는 역할 필터가 따로 한 줄을 차지했다 —
          그 줄과 이 줄이 결국 "무엇을 보여줄까"라는 같은 질문이라 합친다. */}
      {/* 역할 고르기 띠. 아직 역할을 안 고른 사람에게 딱 한 번.
          창(모달)이 아니라 자리를 차지하는 띠다 — 뒤가 다 보이고, 무시하고
          바로 목록을 봐도 된다. 창으로 만들면 하루 다섯 번 열 때 다섯 번
          닫아야 하고, 무엇을 고르는지 안 보이는 채로 골라야 한다.
          (docs 2026-09-04 첫 화면 목업에서 셋을 견주고 고른 안이다.) */}
      {showRoleStrip && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white px-3.5 py-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800">어느 역할로 보시겠어요?</p>
            <button
              type="button"
              onClick={() => setRoleAsked(true)}
              className="ml-auto text-xs text-slate-400 hover:text-slate-600"
            >
              나중에 ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {/* 맵 변수를 role 로 두면 이제 같은 이름의 prop 을 가린다. 지금은
                안에서 prop 을 안 써서 동작하지만, 다음에 이 블록에 "지금 고른
                역할인가"를 더하려는 사람이 조용히 맵 변수를 읽는다. */}
            {readyByRole.map(({ role: r, ready }) => (
              <button
                key={r}
                type="button"
                onClick={() => pickRole(r)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {r}
                {/* 0 은 안 쓴다. '재무팀 0' 은 고르지 말라는 말처럼 보이는데,
                    지금 착수할 것이 없을 뿐 그 역할의 일은 있다. */}
                {ready > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 tabular-nums">{ready}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRoleAsked(true)}
              className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400"
            >
              전체 보기
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-500">
            초록 숫자는 <b className="font-medium text-slate-600">지금 착수할 수 있는 것</b>입니다.
            고르면 이 브라우저에 기억하고 다시 묻지 않습니다.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* 역할 필터. 모아의 조직과 런칭의 역할은 다른 축이라 이을 데이터가
            없다 — 그래서 자동으로 안 고르고 사람이 고른다. 빈 값(역할 전체)이
            예전의 '역할 해제' 단추를 대신한다. */}
        <select
          aria-label="역할로 보기"
          value={role}
          onChange={(e) => chooseRole(e.target.value)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-600 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">역할 전체</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* 띠로 돌아가는 길. 넘긴 사람에게만, 역할 드롭다운 바로 옆에 둔다 —
            역할 이야기를 찾을 때 눈이 가는 자리가 여기다.
            드롭다운에는 없고 띠에만 있는 것이 역할별 착수 가능 건수다. */}
        {!role && roleAsked && readyByRole.length > 0 && (
          <button
            type="button"
            onClick={() => setRoleAsked(false)}
            className="text-xs text-indigo-600 hover:underline"
          >
            역할 고르기
          </button>
        )}

        {/* 담당자 필터. assignee_name 은 방금 생긴 값이라 대부분 비어
            있다 — 이름이 하나라도 있을 때만 보인다. 다 비어 있으면 자리만
            차지한다. */}
        {assigneeOptions.length > 0 && (
          <select
            aria-label="담당자로 보기"
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-600 focus:border-indigo-400 focus:outline-none"
          >
            <option value="">담당자 전체</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        {/* 내 담당은 보기 칩이 아니라 그 왼쪽이다. 이번 주·지남·막힘은 서로
            배타적인 한 축(라디오)이고, 내 담당은 겹쳐 걸리는 다른 축이라 같은
            묶음에 섞으면 "내 담당 중 이번 주"를 못 본다. 구분선 둘이 세 덩어리를
            만든다 — 누구의 것 · 내 것 · 어느 덩어리. */}
        <span className="h-4 w-px shrink-0 bg-slate-300" />
        <button
          type="button"
          onClick={() => onParams?.({ assignee: assignee ? '' : myMemberId })}
          disabled={!myMemberId}
          aria-pressed={Boolean(assignee)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 ${
            assignee
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          내 담당
          {/* 0 을 감추지 않는다. 담당자가 471건 모두 비어 있는 지금 이 칸을 숨기면
              담당자를 붙일 이유가 영영 안 보인다. */}
          <span className={`ml-1.5 text-xs tabular-nums ${
            mineCount > 0 ? 'font-semibold text-emerald-600' : 'text-slate-400'
          }`}>
            {mineCount}
          </span>
        </button>
        <span className="h-4 w-px shrink-0 bg-slate-300" />

        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              onParams?.({ view: v.key });
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
            {/* 지남만 붉게 — 완료를 눌러야 할 만큼 급한 것과 나머지를
                한눈에 가르려고. 0건이면 굳이 안 붉힌다. */}
            <span
              className={`ml-1.5 text-xs tabular-nums ${
                v.key === 'late' && v.count > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
            >
              {v.count}
            </span>
          </button>
        ))}
      </div>

      {/* 둘째 줄 = 뭐가 보이나 · 뭘 할까. 첫째 줄에 내 담당과 구분선을 더하면
          한 줄 유지 최소 폭이 1283px 이라 13″ 노트북에서 「묶기」 하나만
          둘째 줄에 홀로 떨어진다 — 우연히 생긴 둘째 줄 대신 뜻이 있는
          둘째 줄로 나눈다. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { onQuery?.(e.target.value); setPicked(new Set()); }}
          placeholder="항목·역할로 찾기"
          className="h-9 w-56 shrink-0 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
        />

        {/* 묶는 기준. 기본은 워크스트림 — 안 건드리면 예전과 똑같이
            동작한다. 담당자별·기한(주)별로 워크스트림을 넘나들며 "다음에
            뭐 하지"를 보고 싶다는 요청이 있어 추가한다. */}
        <select
          aria-label="묶는 기준"
          value={group}
          onChange={(e) => changeGroupMode(e.target.value)}
          className="h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-600 focus:border-indigo-400 focus:outline-none"
        >
          {GROUP_MODES.map((m) => (
            <option key={m.key} value={m.key}>
              묶기 · {m.label}
            </option>
          ))}
        </select>

        {/* 지금 몇 건을 보고 있나. 참여자 넣기 창의 "19명 중 4명"과 같은 규칙이다.
            해당없음 보기에서는 분모가 다르다 — stat.total 은 해당없음을 뺀 수라
            "451건 중 25건"이 되어 버린다. */}
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          <b className="font-medium text-slate-700">
            {view === 'na' ? stat.notApplicable : stat.total}건
          </b>
          {' 중 '}
          <b className="font-medium text-slate-700">{roleFiltered.length}건</b>
        </span>

        {hasFilter && (
          <button
            type="button"
            onClick={resetAll}
            className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
          >
            필터 초기화
          </button>
        )}

        {/* ml-auto 가 여기로 온다. 첫째 줄에서 ＋항목을 오른쪽으로 밀던 것이다. */}
        <button
          type="button"
          onClick={() => setTaskDialog({ mode: 'create' })}
          className="ml-auto shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ＋ 항목
        </button>
      </div>

      {/* 간트에서 넘어온 걸림. 어디서 온 것인지 말해 주지 않으면 "왜 몇 건밖에
          없지"가 된다 — 스스로 건 필터가 아니라서 더 그렇다. */}
      {focusWorkstream && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-800">
          <span>
            간트에서 고른 <b>{focusWorkstream}</b> 만 보고 있습니다
          </span>
          <button
            type="button"
            onClick={() => onClearFocus?.()}
            className="ml-auto text-indigo-700 underline hover:text-indigo-900"
          >
            전체 보기
          </button>
        </div>
      )}

      {/* 0 을 감추지 않는다. 눌러서 빈 목록을 보여주는 대신 무엇을 하면 되는지
          말한다 — 이 문구가 다음 단계(항목 창의 「나에게 맡기」)를 가리킨다. */}
      {assignee && mineCount === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          아직 <b>내 담당이 없습니다.</b> 항목을 열어 담당자에 자기 이름을 붙이면 여기 모입니다.
        </p>
      )}

      {/* 조용히 넘기지 않는다. 링크를 누른 사람은 무언가 열릴 것을 기대했다.
          주소의 task 는 안 지운다 — 지우면 왜 안 열렸는지 물을 근거가 사라진다. */}
      {missingCode && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          링크가 가리키는 항목 <b className="tabular-nums">{missingCode}</b> 를 이 런칭에서
          못 찾았습니다 — 지워졌거나 다른 런칭의 항목입니다.
        </p>
      )}

      {/* 역할을 고른 뒤에만 나오는 얇은 줄. 역할 이름은 위 드롭다운에 이미
          있으니 여기서는 반복하지 않는다(할 것/도울 것/둘 다). */}
      {role && (
        <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
          {roleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setRoleTab(t.key)}
              className={`text-xs ${
                roleTab === t.key ? 'font-medium text-indigo-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label} <span className="tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>
      )}

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
            <>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setNaFor({ ids: [...picked], title: '' })}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                해당없음으로
              </button>
              {/* 해당없음 보기에서는 안 그린다. 안 하기로 둔 것에 협조를 구할
                  일이 없어서 삼항의 else 쪽에만 둔다. */}
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setHelpFor([...picked])}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                협조 요청
              </button>
            </>
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
          {role ? (
            `${roleTabs.find((t) => t.key === roleTab)?.label ?? role} 항목이 이 보기에 없습니다.`
          ) : (
            <>
              {view === 'week' && '이번 주에 할 것이 없습니다.'}
              {view === 'late' && '지난 항목이 없습니다.'}
              {view === 'blocked' && '막힌 항목이 없습니다.'}
              {view === 'ready' && '지금 착수할 수 있는 항목이 없습니다 — 선행이 모두 남아 있습니다.'}
              {view === 'na' && '해당없음으로 둔 항목이 없습니다.'}
              {view === 'all' && '항목이 없습니다.'}
            </>
          )}
        </p>
      )}

      {/* 이 map 의 group 은 묶음 객체라 같은 이름의 prop(문자열)을 가린다.
          안에서 prop 을 쓸 일이 없고, 잘못 읽으면 group.tasks 가 undefined 라
          시끄럽게 깨진다 — 조용히 틀리지 않으므로 이름을 그대로 둔다. */}
      {groups.map((group) => {
        const closed = closedGroups.has(group.key);
        const groupStat = progress({ tasks: group.tasks, openDate, today });
        // 이 그룹의 '지금 보이는' 줄 기준. 앱 18건처럼 한 그룹에 몰린
        // 항목을 18번 클릭 대신 1번으로 고르게 하려고 있다.
        const groupIds = group.tasks.map((t) => t.id);
        const allChecked = groupIds.length > 0 && groupIds.every((id) => picked.has(id));
        const someChecked = groupIds.some((id) => picked.has(id));
        return (
          <section key={group.key} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex w-full items-center gap-2 px-4 py-2.5">
              {/* 접기 단추 안에 넣으면 클릭이 접기/펴기와 싸운다 — 밖에 둔다. */}
              <input
                type="checkbox"
                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                checked={allChecked}
                onChange={() => toggleGroupPick(group.tasks)}
                aria-label={`${group.label} 전체 고르기`}
                className="h-3.5 w-3.5 shrink-0 accent-indigo-600"
              />
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="text-xs text-slate-400">{closed ? '▸' : '▾'}</span>
                <span className="font-medium text-slate-800">{group.label}</span>
                <span className="text-xs tabular-nums text-slate-400">
                  {groupStat.done}/{groupStat.total}
                </span>
                {groupStat.late > 0 && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-700">
                    지남 {groupStat.late}
                  </span>
                )}
                {groupStat.blocked > 0 && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                    막힘 {groupStat.blocked}
                  </span>
                )}
              </button>
            </div>

            {!closed && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {group.tasks.map((task) => (
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
                    onLinks={() => {
                      setMenuFor(null);
                      onParams?.({ task: task.code });
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
                    canAdmin={canAdmin}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {/* 창을 조건부로 그린다. 닫혀도 계속 그리면 useState 초기화 함수가
          다시 안 돌아서 지난 항목의 값이 그대로 남는다 — 제목은 새 항목인데
          칸은 옛 항목인 화면이 실제로 나왔다. */}
      {naFor && (
      <NotApplicableDialog
        open
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
      )}

      {/* 조건부로 그린다. 닫혀도 그리면 창 안의 '지금 보는 코드'가 지난 항목에
          머문다 — 이 병이 네 창에 있었다.
          고치기 창이 열려 있으면 이 창은 안 그린다. 주소의 task 는 그대로라
          고치기를 닫으면 다시 보기 창으로 돌아온다. */}
      {viewTask && !taskDialog && (
        <TaskViewDialog
          open
          task={viewTask}
          tasks={tasks}
          myMemberId={myMemberId}
          launchId={launch?.id}
          memberId={myMemberId}
          launchName={launch?.name}
          openDate={openDate}
          today={today}
          busy={busy === viewTask.id}
          activityKey={activityKey}
          onNavigate={(code) => onParams?.({ task: code })}
          onAssign={(next) => patchTask(viewTask, { assignee: next })}
          onClose={() => onParams?.({ task: '' })}
          onEdit={(t) => setTaskDialog({ mode: 'edit', task: t })}
          onHelpRequest={(t) => setHelpFor([t.id])}
        />
      )}

      {/* 조건부로 그린다. 닫혀도 계속 그리면 고른 항목·역할·쓰다 만 한마디가
          그대로 남아, 다음에 다른 항목으로 열었을 때 지난 값이 보인다. */}
      {helpFor && (
        <HelpRequestDialog
          open
          launchId={launch?.id}
          launchName={launch?.name}
          tasks={tasks.filter((t) => helpFor.includes(t.id))}
          members={members}
          myMemberId={myMemberId}
          onClose={() => setHelpFor(null)}
          onSent={() => {
            // 고른 것을 놓는다. 방금 보낸 줄이 계속 체크돼 있으면 곧바로 또
            // 보내게 된다.
            setPicked(new Set());
            // 항목 창이 열려 있으면 그 활동에 방금 남은 한 줄을 받게 한다.
            setActivityKey((n) => n + 1);
          }}
        />
      )}

      {blockFor && (
        <BlockDialog
          open
          task={blockFor}
          launchId={launch.id}
          decisions={decisions}
          onClose={() => setBlockFor(null)}
          onSubmit={(patch) =>
            blockFor ? patchTask(blockFor, { status: BLOCKED_STATUS, ...patch }) : undefined
          }
          onDecisionCreated={onDecisionCreated}
        />
      )}

      {taskDialog && (
        <TaskEditDialog
          open
          mode={taskDialog.mode ?? 'edit'}
          launch={launch}
          task={taskDialog.mode === 'edit' ? taskDialog.task : null}
          tasks={tasks}
          members={members}
          workstreams={workstreams}
          roles={roleOptions}
          orgs={orgOptions}
          channels={channelOptions}
          onClose={() => setTaskDialog(null)}
          onSaved={(task) => {
            const wasCreate = taskDialog.mode === 'create';
            setTaskDialog(null);
            // 고치기는 그 줄만 갈아 끼운다(onChanged) — 새로 넣기는 목록
            // 자체가 길어지므로 통째로 다시 받는다(onReload), bulkAction 과
            // 같은 규칙이다.
            if (wasCreate) onReload?.();
            else onChanged?.(task);
          }}
        />
      )}
    </div>
  );
}

// 무엇을 기다리는지 읽을 수 있게.
//
// 'ⵈ선행 01-01 대기' 라고만 쓰면 그게 무슨 일인지·누가 하는지·언제
// 끝나는지를 알 수 없어 찾아갈 수가 없다. 312건이 선행을 갖고 있으니
// 그때마다 코드를 뒤지게 하는 것은 312번 뒤지게 하는 것이다.
//
// 한 줄을 안 넘긴다 — 제목이 길면 자른다. 여기서 두 줄이 되면 451줄이
// 통째로 길어져 목록이 안 읽힌다. 전체는 눌러서 연계 창에서 본다.
function DepChip({ task, tasks, openDate, today, onOpen }) {
  const waitingOn = prevTasks({ task, tasks }).filter(
    (node) => node.task && !isDone(node.task),
  );
  if (waitingOn.length === 0) return null;

  const [first] = waitingOn;
  const dep = first.task;
  const due = dueDate(openDate, dep.day_offset);
  const days = dDay(due, today);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${first.code} ${dep.title}`}
      className="flex min-w-0 max-w-full items-center gap-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
    >
      <span className="shrink-0">선행</span>
      <span className="shrink-0 tabular-nums text-slate-400">{first.code}</span>
      <span className="min-w-0 truncate">{dep.title}</span>
      <span className="shrink-0 text-slate-400">
        {dep.owner_role || '담당 없음'}
        {days !== null && ` · ${dDayLabel(days)}`}
      </span>
      {/* 둘 이상을 기다리는 항목은 지금 자료에 없지만 열은 text[] 이다.
          한 건만 보여주고 나머지를 감추면 그 사실을 알 방법이 없다. */}
      {waitingOn.length > 1 && (
        <span className="shrink-0 text-slate-400">외 {waitingOn.length - 1}</span>
      )}
    </button>
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
  onToggleMenu, onEdit, onLinks, onAskNa, onRestore, onDelete, canAdmin = false,
}) {
  const tone = taskTone({ task, openDate, today, tasks });
  const due = dueDate(openDate, task.day_offset);
  const days = dDay(due, today);
  const waiting = isWaitingOnDep({ task, tasks });
  const done = isDone(task);
  const na = isNotApplicable(task);
  // 이걸 끝내면 몇 건이 풀리나. 2건 이상일 때만 쓴다 — 312줄에 전부
  // 배지가 붙으면 아무것도 안 가리키는 것과 같다.
  const unlock = na || done ? 0 : unlockCount({ task, tasks });
  // 목록에 없는 선행. 대기로는 안 치지만 화면에는 나와야 한다.
  const broken = na ? [] : missingDeps({ task, tasks });

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
          {/* 제목을 누르면 그 항목을 연다. 지금까지 제목은 아무 일도 안 했고,
              항목을 열려면 ⋯ 메뉴를 거쳐야 했다. */}
          <button
            type="button"
            onClick={onLinks}
            className="text-left hover:underline hover:decoration-indigo-300"
          >
            {task.title}
          </button>
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
              {/* 담당자는 팀보다 구체적이라 팀 바로 뒤에 붙인다. 없으면
                  아무것도 안 보인다 — 빈 자리를 지키면 451줄에서 여백만
                  늘어난다. */}
              {task.assignee_name && <span className="text-slate-700">{task.assignee_name}</span>}
              {/* 이걸 끝내면 무엇이 풀리는지. 기한이 같은 두 줄 사이에서
                  무엇을 먼저 할지는 이 숫자가 정한다. */}
              {unlock >= 2 && (
                <button
                  type="button"
                  onClick={onLinks}
                  className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:border-indigo-300"
                >
                  풀림 {unlock}
                </button>
              )}
              {waiting && !done && (
                <DepChip task={task} tasks={tasks} openDate={openDate} today={today} onOpen={onLinks} />
              )}
              {broken.length > 0 && (
                <button
                  type="button"
                  onClick={onLinks}
                  className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100"
                >
                  선행 {broken.join(', ')} — 목록에 없음
                </button>
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
            <button
              type="button"
              onClick={onLinks}
              className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              연계된 항목 보기
            </button>
            <p className="px-2.5 pb-1.5 text-[11px] text-slate-400">
              무엇을 기다리고, 무엇이 이걸 기다리나.
            </p>
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
            {/* 지우기는 관리자만. 되돌릴 수 없고, 참여자에게는 위의
                '해당없음으로 두기' 가 있다 — 우리는 이미 그쪽을 권한다. */}
            {canAdmin && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
