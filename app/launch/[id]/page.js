'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { LaunchBoard } from '@/components/launch/LaunchBoard';
import { LaunchContext } from '@/components/launch/LaunchContext';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 오늘은 화면 하나에서 한 번만 정한다. 아래로 그대로 내려보내 머리의
  // D-N 과 보드의 '이번 주'가 같은 날을 본다.
  const today = useMemo(() => todayInKst(), []);

  useEffect(() => {
    if (!admin) return undefined;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/launch/${id}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');
        if (cancelled) return;
        setLaunch(body.launch);
        setTasks(body.tasks ?? []);
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
  }, [admin, id]);

  const stat = useMemo(
    () => progress({ tasks, openDate: launch?.open_date, today }),
    [tasks, launch, today],
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
      <div>
        <Link href="/launch" className="text-xs text-slate-500 hover:text-slate-700">
          ← 런칭 목록
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
        </div>
      </div>

      {launch.status === '준비' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>📋</span>
          <div>
            <b>아직 준비 단계입니다.</b> 엑셀로 요건을 정리해 올린 뒤 시작합니다.
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setStatus('진행 중')}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              시작하기
            </button>
          </div>
        </div>
      ) : launch.status === '진행 중' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>🚀</span>
          <div>
            <b>진행 중입니다.</b> 이제부터는 모아에서 관리합니다 — 엑셀 문은 닫혔습니다.
          </div>
          <button
            type="button"
            onClick={() => setStatus('준비')}
            className="ml-auto text-xs text-emerald-700 underline hover:text-emerald-900"
          >
            준비로 되돌리기
          </button>
        </div>
      ) : null}

      <LaunchContext context={launch.context} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Stat label="완료" value={`${stat.done}/${stat.total}`} sub={`${stat.percent}%`} />
        <Stat label="이번 주" value={stat.thisWeek} />
        {/* 지남과 막힘은 0 이어도 자리를 지킨다. 사라지면 "0인가 안 세는가"를
            구분할 수 없다. */}
        <Stat label="지남" value={stat.late} tone={stat.late > 0 ? 'rose' : undefined} />
        <Stat label="막힘" value={stat.blocked} tone={stat.blocked > 0 ? 'amber' : undefined} />
        {/* progress() 가 notApplicable 을 아직 안 줄 수 있다 — 다른 에이전트가
            lib/launchTask.js 에 붙이는 중이다. 옵셔널하게 읽는다. */}
        {stat.notApplicable > 0 && <Stat label="해당없음" value={stat.notApplicable} />}
        <div className="ml-auto h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${stat.percent}%` }}
            aria-hidden
          />
        </div>
      </div>

      <LaunchBoard
        launch={launch}
        tasks={tasks}
        today={today}
        // 서버가 돌려준 한 줄만 갈아 끼운다. 통째로 다시 부르면 스크롤이
        // 튀고, 회의 중에 그러면 보던 자리를 잃는다.
        onChanged={(task) =>
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...task } : t)))
        }
      />
    </div>
  );
}

const TONE = {
  rose: 'text-rose-600',
  amber: 'text-amber-700',
};

function Stat({ label, value, sub, tone }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11.5px] text-slate-500">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${TONE[tone] ?? 'text-slate-800'}`}>
        {value}
        {sub && <span className="ml-1.5 text-xs font-normal text-slate-400">{sub}</span>}
      </span>
    </div>
  );
}
