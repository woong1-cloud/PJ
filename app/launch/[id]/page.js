'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { LaunchBoard } from '@/components/launch/LaunchBoard';
import { LaunchContextButton, LaunchContextPanel } from '@/components/launch/LaunchContext';
import { LaunchContextDialog } from '@/components/launch/LaunchContextDialog';
import { ImportDialog } from '@/components/launch/ImportDialog';
import { DecisionList } from '@/components/launch/DecisionList';
import { WeeklyProgress } from '@/components/launch/WeeklyProgress';
import { GanttView } from '@/components/launch/GanttView';
import { MembersView } from '@/components/launch/MembersView';
import { dDay, dDayLabel } from '@/lib/launchDate';
import { progress } from '@/lib/launchTask';
import { todayInKst } from '@/lib/overdue';

// 런칭 하나 — 머리에 요약, 아래에 보드.
//
// 항목 전부를 한 번에 받아 브라우저에서 센다. 400건은 그러기에 작고, 서버를
// 다시 부르지 않으니 보기를 바꿔도 숫자가 안 갈린다.
export default function LaunchDetailPage({ params }) {
  const { id } = use(params);
  const { identity } = useIdentity();
  const admin = isGlobalAdmin(identity);

  const [launch, setLaunch] = useState(null);
  const [tasks, setTasks] = useState([]);
  // 결정 대기 목록. 탭(결정 대기·주간 진척) 배지 건수와 보드의 '결정 대기 ·
  // 제목' 표시가 같이 쓰기 때문에 페이지가 갖는다 — LaunchBoard 만 갖고
  // 있으면 탭 줄에서 건수를 못 본다.
  const [decisions, setDecisions] = useState([]);
  // 참여자 명단과 넣을 수 있는 사람들. 참여자 탭을 처음 열 때 받는다 —
  // 보드만 보는 사람에게 미리 실어 보낼 이유가 없다.
  const [members, setMembers] = useState([]);
  const [people, setPeople] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [memberBusy, setMemberBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  // 탭 셋. 기본은 보드다 — 지금까지 보드가 바로 나오던 화면이라 습관을
  // 안 바꾼다.
  const [tab, setTab] = useState('board');
  // 간트에서 막대를 눌러 넘어올 때 보드가 걸 워크스트림. 보드 안에 두지
  // 않는 이유는 간트가 그것을 정하기 때문이다 — 탭을 넘나드는 값이라
  // 페이지가 갖는다.
  const [boardFocus, setBoardFocus] = useState('');
  // 가져오기 결과. 476건을 올렸는데 아무 숫자도 안 뜨면 무엇이 들어갔는지
  // 알 길이 없다 — 특히 시트에서 빠진 것과 진행 중이라 안 바꾼 것은
  // 여기서만 보인다.
  const [done, setDone] = useState(null);
  // 전제 고치기 창. 읽기 전용이던 LaunchContext 에 고치기가 붙으며 필요해졌다.
  const [contextOpen, setContextOpen] = useState(false);
  // 전제 펼침 여부. 제목 줄의 '전제 N' 단추가 이걸 토글한다 — 매일 볼
  // 것은 아니지만 찾을 때 반드시 있어야 해서 접어 둔다.
  const [contextExpanded, setContextExpanded] = useState(false);
  // 제목 줄의 드롭다운 둘(내보내기·⋯). 한 번에 하나만 연다 — 이름은
  // LaunchBoard 의 menuFor 와 같은 뜻이다.
  const [openMenu, setOpenMenu] = useState(null);
  // 가져오기(엑셀) · 지우기 뒤에 다시 부르는 손잡이. app/launch/guide/page.js 와
  // 같은 방식이다 — effect 밖의 함수를 effect 에서 부르면 그 안의 setState 가
  // 동기 호출로 보여 cascading render 경고가 난다.
  const [reloadToken, setReloadToken] = useState(0);

  // 오늘은 화면 하나에서 한 번만 정한다. 아래로 그대로 내려보내 머리의
  // D-N 과 보드의 '이번 주'가 같은 날을 본다.
  const today = useMemo(() => todayInKst(), []);

  // 바깥을 누르면 열린 드롭다운을 닫는다. LaunchBoard 의 ⋯ 메뉴와 같은 방식.
  useEffect(() => {
    if (!openMenu) return undefined;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  useEffect(() => {
    if (!admin) return undefined;
    let cancelled = false;

    async function load() {
      try {
        // 함께 받는다. 결정 목록은 작아서(14건 안팎) 따로 불러도 비용은
        // 작지만, 같은 reloadToken 을 쓰는 자리이니 한 번에 묶는다 —
        // 지우기·가져오기처럼 목록 길이가 바뀌는 일 뒤에는 결정 쪽의
        // waitingCount 도 같이 낡아 있을 수 있어서다.
        const [res, decRes] = await Promise.all([
          fetch(`/api/launch/${id}`),
          fetch(`/api/launch/${id}/decisions`),
        ]);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');
        const decBody = await decRes.json().catch(() => ({}));
        if (cancelled) return;
        setLaunch(body.launch);
        setTasks(body.tasks ?? []);
        if (decRes.ok) setDecisions(decBody.decisions ?? []);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [admin, id, reloadToken]);

  // 결정 목록만 다시 받는다. 항목 하나가 막히거나 풀리면 결정 쪽
  // waitingCount 가 그 순간 낡는다 — 보드 전체를 다시 받으면(reloadToken)
  // 회의 중 스크롤이 튀니, 여기는 결정만 가볍게 새로 받는다.
  async function refreshDecisions() {
    const res = await fetch(`/api/launch/${id}/decisions`).catch(() => null);
    if (!res?.ok) return;
    const body = await res.json();
    setDecisions(body.decisions ?? []);
  }

  // 결정 기록·추가·(BlockDialog 의) 새 결정 올리기가 전부 이 하나로 온다.
  // id 가 이미 있으면 갈아 끼우고, 없으면 붙인다.
  function saveDecision(decision) {
    setDecisions((prev) => {
      const exists = prev.some((d) => d.id === decision.id);
      if (exists) return prev.map((d) => (d.id === decision.id ? { ...d, ...decision } : d));
      return [...prev, decision].sort((a, b) => a.seq - b.seq);
    });
  }

  const stat = useMemo(
    () => progress({ tasks, openDate: launch?.open_date, today }),
    [tasks, launch, today],
  );

  const pendingDecisionCount = useMemo(
    () => decisions.filter((d) => d.status === '대기').length,
    [decisions],
  );

  const memberHeads = useMemo(
    () => new Set(members.map((m) => m.member_id)).size,
    [members],
  );

  // 참여자 탭을 열 때 한 번 받는다. 넣고 빼는 것은 화면 상태만 고치고
  // 다시 안 받는다 — 명단이 짧아 통째로 다시 받을 이유가 없고, 회의 중에
  // 화면이 튀는 것이 더 나쁘다.
  useEffect(() => {
    if (tab !== 'members' || membersLoaded || !admin) return undefined;
    let cancelled = false;
    (async () => {
      const [mRes, pRes] = await Promise.all([
        fetch(`/api/launch/${id}/members`).catch(() => null),
        fetch('/api/team-members').catch(() => null),
      ]);
      if (cancelled) return;
      if (mRes?.ok) setMembers((await mRes.json()).members ?? []);
      if (pRes?.ok) {
        const body = await pRes.json();
        // /api/team-members 는 기본으로 활성만 준다(includeInactive 를 안 붙임).
        // 그래도 한 번 더 거른다 — 이 목록이 명단에 들어갈 사람을 정한다.
        setPeople((body.teamMembers ?? []).filter((p) => p.is_active !== false));
      }
      setMembersLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, membersLoaded, admin, id]);

  async function memberFetch(method, body) {
    setMemberBusy(true);
    try {
      const res = await fetch(`/api/launch/${id}/members`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? '처리하지 못했습니다.');
      return payload;
    } finally {
      setMemberBusy(false);
    }
  }

  // 넣은 뒤에는 명단만 다시 받는다. 몇 명이 실제로 들어갔는지(이미 있던
  // 사람은 넘어간다) 서버가 알고 있어서, 화면에서 짐작해 붙이면 어긋난다.
  async function addMembers({ roleName, memberIds, canEdit }) {
    await memberFetch('POST', { roleName, memberIds, canEdit });
    const res = await fetch(`/api/launch/${id}/members`);
    if (res.ok) setMembers((await res.json()).members ?? []);
  }

  async function removeMember(m) {
    await memberFetch('DELETE', { memberId: m.member_id, roleName: m.role_name });
    setMembers((prev) =>
      prev.filter((x) => !(x.member_id === m.member_id && x.role_name === m.role_name)),
    );
  }

  async function toggleMemberEdit(m, canEdit) {
    await memberFetch('PATCH', { memberId: m.member_id, roleName: m.role_name, canEdit });
    setMembers((prev) =>
      prev.map((x) =>
        x.member_id === m.member_id && x.role_name === m.role_name
          ? { ...x, can_edit: canEdit }
          : x,
      ),
    );
  }

  // 탭 셋. 건수를 붙이는 이유: 안 열어봐도 몇 건인지 보여야 한다. 주간
  // 진척은 다섯 칸을 합치면 뜻이 겹치는 숫자라 배지를 안 단다.
  const tabs = useMemo(
    () => [
      { key: 'board', label: '보드', count: stat.total },
      { key: 'decisions', label: '결정 대기', count: pendingDecisionCount },
      { key: 'weekly', label: '주간 진척', count: null },
      // 간트는 건수를 안 단다 — 워크스트림 19줄이라 '19' 는 아무 말도 안 한다.
      { key: 'gantt', label: '간트', count: null },
      // 사람 수를 센다(역할 자리 수가 아니라) — 한 사람이 두 역할일 수 있다.
      { key: 'members', label: '참여자', count: memberHeads },
    ],
    [stat.total, pendingDecisionCount, memberHeads],
  );

  // 준비 ↔ 진행 중 — 엑셀 문의 열쇠. app/api/launch/[id]/route.js PATCH 참고.
  async function setStatus(next) {
    const res = await fetch(`/api/launch/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '바꾸지 못했습니다.');
      return;
    }
    const body = await res.json();
    setLaunch(body.launch);
  }

  if (!admin) {
    return <p className="text-sm text-slate-500">전체 관리자만 볼 수 있는 화면입니다.</p>;
  }
  if (loading) return <p className="text-sm text-slate-500">불러오는 중...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!launch) return null;

  const days = dDay(launch.open_date, today);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* 제목 줄 하나 — 예전에는 '← 목록'과 제목이 두 줄이었다. 첫 항목이
          나오기까지 여섯 줄이던 것을 세 줄로 줄이려면 여기부터 합쳐야 한다. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link href="/launch" className="shrink-0 text-xs text-slate-500 hover:text-slate-700">
          ← 목록
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">{launch.name}</h1>
        {launch.kind && <span className="text-xs text-slate-400">{launch.kind}</span>}
        <span className="text-sm tabular-nums text-slate-500">
          오픈 {launch.open_date}
          {days !== null && (
            <b className={days < 0 ? 'ml-2 text-rose-600' : 'ml-2 text-slate-700'}>
              {dDayLabel(days)}
            </b>
          )}
        </span>

        {/* 전제·내보내기·⋯ — 예전에는 상태 배너 안에 흩어져 있던 단추들과
            전제 접기 상자가 여기 한 줄로 모인다. */}
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          <LaunchContextButton
            context={launch.context}
            open={contextExpanded}
            onToggle={() => setContextExpanded((v) => !v)}
            onAdd={() => setContextOpen(true)}
          />
          <ExportMenu
            id={id}
            open={openMenu === 'export'}
            onToggle={(e) => {
              e.stopPropagation();
              setOpenMenu((prev) => (prev === 'export' ? null : 'export'));
            }}
          />
          <MoreMenu
            open={openMenu === 'more'}
            onToggle={(e) => {
              e.stopPropagation();
              setOpenMenu((prev) => (prev === 'more' ? null : 'more'));
            }}
            // 서버는 '준비' 가 아니면 400 을 낸다
            // (app/api/launch/[id]/import/route.js). 화면이 그보다 넓게
            // 열어 두면 완료·중단 런칭에서 누르고 오류를 보게 된다.
            importLocked={launch.status !== '준비'}
            showRevert={launch.status !== '준비'}
            onImport={() => {
              setOpenMenu(null);
              setImportOpen(true);
            }}
            onRevert={() => {
              setOpenMenu(null);
              setStatus('준비');
            }}
          />
        </div>
      </div>

      {contextExpanded && (
        <LaunchContextPanel context={launch.context} onEdit={() => setContextOpen(true)} />
      )}

      {/* 준비 상태의 배너만 남는다 — "엑셀로 정리해 올린 뒤 시작하세요"가
          실제로 할 일을 알려준다. 진행 중일 때의 배너("이제부터 모아에서
          관리합니다")는 상태가 안 바뀌는 한 매번 같은 말이라 정보가 0이라
          없앴다 — 그 단추 셋(양식·가져오기·되돌리기)은 위 제목 줄로 옮겼다. */}
      {launch.status === '준비' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>📋</span>
          <div>
            <b>아직 준비 단계입니다.</b> 엑셀로 요건을 정리해 올린 뒤 시작합니다.
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <TemplateLink id={id} tone="amber" />
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              엑셀에서 가져오기
            </button>
            <button
              type="button"
              onClick={() => setStatus('진행 중')}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              시작하기
            </button>
          </div>
        </div>
      )}

      <ImportReport report={done} onClose={() => setDone(null)} />

      {/* 탭 셋(보드 · 결정 대기 · 주간 진척)과 완료 통계를 한 줄로 —
          이번 주·지남·막힘·해당없음은 여기서 뺐다. 보드의 보기 칩이 이미
          같은 숫자를 말하고 있어서(views), 두 자리에서 같은 넷을 말하는
          게 이 페이지가 여섯 줄이던 이유 중 하나였다. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              tab === t.key
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.count !== null && (
              <span className="ml-1.5 text-xs tabular-nums text-slate-400">{t.count}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums text-slate-800">
            완료 {stat.done}/{stat.total}
            <span className="ml-1.5 text-xs font-normal text-slate-400">{stat.percent}%</span>
          </span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${stat.percent}%` }}
              aria-hidden
            />
          </div>
        </div>
      </div>

      {tab === 'board' && (
        <LaunchBoard
          launch={launch}
          tasks={tasks}
          today={today}
          decisions={decisions}
          // 서버가 돌려준 한 줄만 갈아 끼운다. 통째로 다시 부르면 스크롤이
          // 튀고, 회의 중에 그러면 보던 자리를 잃는다.
          onChanged={(task) =>
            setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...task } : t)))
          }
          // 지우기는 한 줄만 갈아 끼울 수 없다 — 목록 자체가 짧아지므로
          // 통째로 다시 부른다.
          onReload={() => setReloadToken((t) => t + 1)}
          onDecisionCreated={saveDecision}
          onBlockedChanged={refreshDecisions}
          focusWorkstream={boardFocus}
          onClearFocus={() => setBoardFocus('')}
        />
      )}

      {tab === 'decisions' && (
        <DecisionList launchId={id} decisions={decisions} onSaved={saveDecision} />
      )}

      {tab === 'weekly' && (
        <WeeklyProgress launch={launch} tasks={tasks} decisions={decisions} today={today} />
      )}

      {tab === 'gantt' && (
        <GanttView
          launch={launch}
          tasks={tasks}
          today={today}
          // 막대를 누르면 보드로 넘어가 그 워크스트림만 건다. 간트는
          // "언제 몰리나"를 보는 자리고, 답이 보이면 바로 그 줄들을 열어보게
          // 된다 — 탭을 손으로 다시 누르게 하면 그 흐름이 끊긴다.
          onPick={(workstream) => {
            setBoardFocus(workstream);
            setTab('board');
          }}
        />
      )}

      {tab === 'members' && (
        <MembersView
          launch={launch}
          tasks={tasks}
          members={members}
          people={people}
          busy={memberBusy}
          onAdd={addMembers}
          onRemove={removeMember}
          onToggleEdit={toggleMemberEdit}
        />
      )}

      <ImportDialog
        open={importOpen}
        target={{ kind: 'launch', id }}
        onClose={() => setImportOpen(false)}
        onDone={(body) => {
          setDone(body);
          setReloadToken((t) => t + 1);
        }}
      />

      {/* 닫히면 언마운트시킨다. 계속 그리면 useState 초기화 함수가 다시 안
          돌아서 지난 값이 남는다 — 가져오기로 전제가 바뀌어도 창에는 옛
          줄이 뜬다. */}
      {contextOpen && (
        <LaunchContextDialog
          open
          launchId={id}
          context={launch.context ?? []}
          onClose={() => setContextOpen(false)}
          // 한 줄만 온 status 갱신과 달리 launch 전체를 돌려받는다 — PATCH 가
          // context 를 포함한 launches 행 전체를 select 하기 때문이다.
          onSaved={(next) => setLaunch(next)}
        />
      )}
    </div>
  );
}

// 가져오기가 무엇을 했는지.
//
// 476건이 말없이 들어가면 무섭다. 그리고 이 화면이 아니면 다음 셋을 볼 자리가
// 아예 없다 — 시트에서 빠져 해당없음이 된 것, 양식이 해당없음이라는데 사람이
// 이미 붙어 있어 안 바꾼 것, 손대지 않은 것.
//
// updated 는 이제 숫자가 아니라 실제로 값이 다른 항목의 배열이다
// (lib/launchReimport.js planReimport). "같은 것 N건 — 손대지 않습니다"가
// 요점이다 — 476건을 올렸는데 2건만 바뀐다는 걸 알면 확인이 도박이 아니라
// 검토가 된다.
//
// 사람이 닫을 때까지 남긴다. 몇 초 뒤 사라지면 회의 중에 놓친다.
function ImportReport({ report, onClose }) {
  if (!report) return null;

  const excluded = report.excluded ?? [];
  const busy = report.busy ?? [];
  const untouched = report.untouched ?? [];
  const updated = report.updated ?? [];
  const shown = updated.slice(0, MAX_CHANGES_SHOWN);
  const hiddenCount = updated.length - shown.length;

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 text-sm text-emerald-900">
          <p>
            새로 <b className="tabular-nums">{report.created ?? 0}</b>건 · 바뀌는 것{' '}
            <b className="tabular-nums">{updated.length}</b>건 · 같은 것{' '}
            <b className="tabular-nums">{report.unchanged ?? 0}</b>건 — 손대지 않습니다
            {report.markedNa > 0 && (
              <>
                {' · '}양식이 해당없음으로 표시한 <b className="tabular-nums">{report.markedNa}</b>건
              </>
            )}
            {report.restored > 0 && (
              <>
                {' · '}되살림 <b className="tabular-nums">{report.restored}</b>건
              </>
            )}
          </p>

          {/* 전제는 이미 있으면 시트가 안 덮는다. 조용히 건너뛰면 "왜 시트를
              고쳤는데 안 바뀌지"가 되므로 말해 준다. */}
          {report.contextFilled && (
            <p className="mt-1.5 text-[13px] text-emerald-800">전제를 시트에서 가져왔습니다.</p>
          )}
          {report.contextKept && (
            <p className="mt-1.5 text-[13px] text-emerald-800">
              전제는 이미 있어 그대로 뒀습니다 — 시트 것으로 되돌리려면 전제를 비우고 다시
              올리세요.
            </p>
          )}

          {/* 바뀐 항목은 열 이름과 전후 값을 보여준다 — "갱신 476건"은
              아무 말도 안 하지만 "D-day -60 → -75"는 엑셀을 열지 않아도
              무엇을 확인해야 하는지 알려준다. */}
          {shown.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1.5 text-[13px]">
              {shown.map((u) => (
                <div key={u.code}>
                  <p className="text-emerald-900">
                    <b className="tabular-nums">{u.code}</b>{' '}
                    <span>{truncate(u.title, 40)}</span>
                  </p>
                  <ul className="ml-4 list-disc text-emerald-700">
                    {u.changes.map((c) => (
                      <li key={c.field}>
                        {c.label} {formatChangeValue(c.field, c.from)} →{' '}
                        {formatChangeValue(c.field, c.to)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-emerald-700">외 {hiddenCount}건</p>
              )}
            </div>
          )}

          {excluded.length > 0 && (
            <p className="mt-1.5 text-[13px] text-amber-800">
              시트에서 사라져 해당없음으로 둔 <b className="tabular-nums">{excluded.length}</b>건 —{' '}
              <span className="tabular-nums">{excluded.slice(0, 6).map((e) => e.code).join(', ')}</span>
              {excluded.length > 6 && ` 외 ${excluded.length - 6}건`}
            </p>
          )}

          {/* 사람이 이미 붙어 있는 일은 파일이 못 지운다. 대신 반드시 알린다 —
              양식과 실제가 어긋난 지점이라 회의에서 확인할 것이다. */}
          {busy.length > 0 && (
            <p className="mt-1.5 text-[13px] text-amber-800">
              양식은 해당없음이라는데 <b>진행 중</b>이라 그대로 둔{' '}
              <b className="tabular-nums">{busy.length}</b>건 —{' '}
              <span className="tabular-nums">
                {busy.slice(0, 6).map((b) => `${b.code}(${b.status})`).join(', ')}
              </span>
              {busy.length > 6 && ` 외 ${busy.length - 6}건`}
            </p>
          )}

          {untouched.length > 0 && (
            <p className="mt-1.5 text-[13px] text-emerald-800">
              손대지 않음 <b className="tabular-nums">{untouched.length}</b>건 —{' '}
              {UNTOUCHED_LABELS.map(([why, label]) => {
                const n = untouched.filter((u) => u.why === why).length;
                return n > 0 ? `${label} ${n}` : null;
              })
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs text-emerald-700 hover:text-emerald-900"
        >
          닫기
        </button>
      </div>
    </section>
  );
}

// planReimport 의 why 값. 사람이 읽는 말로 바꾼다.
const UNTOUCHED_LABELS = [
  ['done', '이미 완료'],
  ['already', '이미 해당없음'],
  ['manual', '손으로 넣은 것'],
];

// 바뀐 항목을 20건 넘게 늘어놓으면 화면이 통째로 목록이 된다. 476건 중
// 100건이 바뀌어도 앞 20건만 보고 나머지는 "외 N건"으로 접는다.
const MAX_CHANGES_SHOWN = 20;

function truncate(value, max) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// changes[].from / to 를 사람이 읽는 모양으로 바꾼다.
//
// depends_on 은 배열이라 join 하지 않으면 "01-01,01-02"가 아니라
// "[object Object]" 근처의 것이 찍힌다. is_critical 은 불리언이라 true/false
// 그대로 보이면 무슨 뜻인지 한 번 더 생각해야 한다.
function formatChangeValue(field, value) {
  if (field === 'depends_on') {
    const arr = Array.isArray(value) ? value : [];
    return arr.length > 0 ? arr.join(', ') : '—';
  }
  if (field === 'is_critical') return value ? '★ 있음' : '★ 없음';
  if (value === null || value === undefined || value === '') return '—';
  // 제목·비고처럼 긴 열은 40자로 자른다 — 짧은 열(D-day, 주관 등)은
  // 40자를 넘지 않으니 그대로 나온다.
  return truncate(value, 40);
}

const TEMPLATE_TONE = {
  amber: 'border-amber-300 text-amber-800 hover:bg-amber-100',
};

// 브랜드에게 줄 엑셀 양식 단추. GET 이 xlsx 를 Content-Disposition: attachment
// 로 내려주므로 fetch 로 blob 을 만들 필요 없이 <a download> 로 충분하다.
// 준비 배너에서만 쓴다 — 제목 줄의 내보내기 메뉴에는 같은 링크가 다른
// 모양(ExportMenu 의 메뉴 항목)으로 또 있다.
function TemplateLink({ id, tone }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <a
        href={`/api/launch/${id}/template`}
        download
        className={`rounded-lg border bg-white px-3 py-1.5 text-xs font-medium ${TEMPLATE_TONE[tone]}`}
      >
        양식 받기
      </a>
      <span className="text-[11px] text-slate-500">
        브랜드가 채울 양식입니다. 첫 시트에 꼭 볼 57줄만 있습니다.
      </span>
    </div>
  );
}

// 제목 줄의 '내보내기 ▾' — 브랜드 양식과 현황 내보내기 둘.
//
// 현황 내보내기(export)는 다른 에이전트가 lib/launchTemplate.js 근처에서
// 만드는 중이다 — 여기서는 GET 링크만 걸어 둔다. 라우트가 아직 없어도
// 이 화면은 그대로 동작해야 하니 fetch 로 존재를 확인하지 않는다.
function ExportMenu({ id, open, onToggle }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
      >
        내보내기 ▾
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={`/api/launch/${id}/template`}
            download
            className="block rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            브랜드 양식
          </a>
          <p className="px-2.5 pb-1.5 text-[11px] text-slate-400">
            브랜드가 채울 엑셀. 첫 시트에 꼭 볼 57줄만.
          </p>
          <hr className="my-1 border-slate-100" />
          <a
            href={`/api/launch/${id}/export`}
            download
            className="block rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            현황 내보내기
          </a>
        </div>
      )}
    </div>
  );
}

// 제목 줄의 '⋯' — 엑셀에서 가져오기 · 준비로 되돌리기.
//
// 예전에는 이 둘이 상태별 배너 안에 있었다. 배너를 없앤(진행 중) 뒤에도
// 손잡이는 남아야 해서 여기로 옮긴다.
function MoreMenu({ open, onToggle, importLocked, showRevert, onImport, onRevert }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label="더 보기"
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={importLocked}
            onClick={onImport}
            title={importLocked ? '진행 중 런칭은 엑셀로 덮어쓸 수 없습니다' : undefined}
            className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            엑셀에서 가져오기 {importLocked && '🔒'}
          </button>
          {showRevert && (
            <>
              <hr className="my-1 border-slate-100" />
              <button
                type="button"
                onClick={onRevert}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                준비로 되돌리기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
