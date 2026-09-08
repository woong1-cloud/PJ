'use client';

import Link from 'next/link';
import { dueDate, dDay, dDayLabel } from '@/lib/launchDate';
import { weeklyBuckets } from '@/lib/launchWeekly';

// 주간 진척 — 회의에서 위에서 아래로 읽는 순서 그대로 다섯 칸.
//
// 결정 대기가 맨 위인 것이 순서의 요점이다. 막힌 것의 원인이 대부분
// 미결이고, ②막힘이 ①결정 대기를 가리키고 있는 게 한 화면에 보여야
// 한다 — 그래서 막힌 줄에 blocked_decision_id 가 있으면 그 결정 제목을
// 함께 보여준다.
//
// ⑤이번 주 완료는 칭찬 자리가 아니라 확인 자리다. 완료로 옮겼는데 실제로는
// 안 끝난 것이 여기서 걸린다.
//
// 세는 규칙은 lib/launchWeekly.js(→ launchTask.js) 하나다. 여기서 새로
// 만들지 않는다 — 보드와 숫자가 갈리면 안 된다.
//
// props: launch, tasks, decisions, today
export function WeeklyProgress({ launch, tasks = [], decisions = [], today }) {
  const openDate = launch?.open_date;
  const decisionsById = new Map(decisions.map((d) => [d.id, d]));
  const buckets = weeklyBuckets({ tasks, decisions, openDate, today });

  return (
    <div className="flex flex-col gap-4">
      {/* 여기엔 '보드에서 열기'가 없다. 이 칸은 항목이 아니라 결정을 보여주는데,
          보드에는 결정에 대응하는 보기가 없다. */}
      <Section
        step="①"
        title="결정 대기"
        count={buckets.pendingDecisions.length}
        tone="indigo"
        empty="대기 중인 결정이 없습니다."
      >
        {buckets.pendingDecisions.map((d) => (
          <li key={d.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2">
            {d.when_text && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                {d.when_text}
              </span>
            )}
            <span className="text-sm text-slate-800">{d.title}</span>
            {d.waitingCount > 0 && (
              <span className="text-xs font-medium text-amber-700">
                막힌 항목 {d.waitingCount}건 대기
              </span>
            )}
          </li>
        ))}
      </Section>

      <Section
        step="②"
        title="막힘"
        count={buckets.blocked.length}
        tone="amber"
        empty="막힌 항목이 없습니다."
        href={`/launch/${launch.id}?view=blocked&role=`}
      >
        {buckets.blocked.map((t) => {
          const linked = t.blocked_decision_id ? decisionsById.get(t.blocked_decision_id) : null;
          return (
            <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2">
              <span className="text-xs tabular-nums text-slate-400">{t.code}</span>
              <span className="text-sm text-slate-800">{t.title}</span>
              {t.blocked_decision_id ? (
                <span className="text-xs text-indigo-700">
                  결정 대기 · {linked?.title ?? '(지워진 결정)'}
                </span>
              ) : (
                <span className="text-xs text-amber-700">{t.blocked_reason || '사유 없음'}</span>
              )}
            </li>
          );
        })}
      </Section>

      <Section
        step="③"
        title="기한 지남"
        count={buckets.late.length}
        tone="rose"
        empty="지난 항목이 없습니다."
        href={`/launch/${launch.id}?view=late&role=`}
      >
        {buckets.late.map((t) => (
          <TaskLine key={t.id} task={t} openDate={openDate} today={today} />
        ))}
      </Section>

      <Section
        step="④"
        title="이번 주 마감"
        count={buckets.thisWeek.length}
        tone="slate"
        empty="이번 주 마감인 항목이 없습니다."
        href={`/launch/${launch.id}?view=week&role=`}
      >
        {buckets.thisWeek.map((t) => (
          <TaskLine key={t.id} task={t} openDate={openDate} today={today} />
        ))}
      </Section>

      {/* 여기도 없다. 보드의 보기 여섯(이번 주·지남·막힘·착수 가능·해당없음·전체)에
          '완료'가 없어서 가리킬 주소가 없다. */}
      <Section
        step="⑤"
        title="이번 주 완료 — 확인"
        count={buckets.doneThisWeek.length}
        tone="emerald"
        empty="이번 주 완료한 항목이 없습니다."
      >
        {buckets.doneThisWeek.map((t) => (
          <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2">
            <span className="text-xs tabular-nums text-slate-400">{t.code}</span>
            <span className="text-sm text-slate-800">{t.title}</span>
          </li>
        ))}
      </Section>
    </div>
  );
}

const TONE = {
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

// href 를 받으면 머리 오른쪽에 보드로 가는 길을 낸다.
//
// href 마다 role= 를 빈 값으로 붙인다. 이 화면의 숫자는 런칭 전체 기준인데,
// 그냥 보내면 보드가 브라우저에 기억된 역할을 얹어 "기한 지남 2"를 눌렀더니
// 0건인 화면이 뜬다 — 숫자가 데려간 곳에 그 숫자가 없으면 안 된다.
// 주소의 role 은 localStorage 를 안 덮어쓰므로 그 사람의 기본 역할은 남는다.
//
// 이 화면은 읽는 자리라 상태를 못 바꾼다. 회의에서 "막힌 5건"을 보고 손을
// 대려면 보드로 가서 필터를 다시 걸어야 했다 — 그 두 걸음을 한 걸음으로.
function Section({ step, title, count, tone, empty, href, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className={`flex flex-wrap items-center gap-2 rounded-t-xl border-b px-4 py-2.5 ${TONE[tone]}`}>
        <span className="text-xs font-medium">{step}</span>
        <span className="text-sm font-medium">{title}</span>
        <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium tabular-nums">
          {count}
        </span>
        {/* 0건이면 안 그린다. 갈 곳이 빈 목록인 링크는 누르면 실망만 준다. */}
        {href && count > 0 && (
          <Link
            href={href}
            className="ml-auto shrink-0 rounded-md bg-white/70 px-2 py-0.5 text-[11.5px] font-medium hover:bg-white"
          >
            보드에서 열기 ↗
          </Link>
        )}
      </div>
      {count === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">{children}</ul>
      )}
    </section>
  );
}

function TaskLine({ task, openDate, today }) {
  const due = dueDate(openDate, task.day_offset);
  const days = dDay(due, today);
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2">
      <span className="text-xs tabular-nums text-slate-400">{task.code}</span>
      <span className="text-sm text-slate-800">{task.title}</span>
      {due && (
        <span className="text-xs tabular-nums text-slate-400">
          {due}
          {days !== null && (
            <span className={days < 0 ? 'ml-1 text-rose-600' : 'ml-1 text-slate-400'}>
              {dDayLabel(days)}
            </span>
          )}
        </span>
      )}
      {task.owner_role && <span className="text-xs text-slate-400">{task.owner_role}</span>}
    </li>
  );
}
