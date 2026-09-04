'use client';

import { useMemo } from 'react';
import { dDay } from '@/lib/launchDate';
import { ganttRows, ganttScale, monthTicks, offsetPercent } from '@/lib/launchGantt';

// 워크스트림 간트.
//
// 463줄을 한 줄씩 그리면 아무도 못 읽는다. 워크스트림 19줄로 묶은
// 값(lib/launchGantt.js)을 놓기만 한다 — 계산은 여기서 하지 않는다.
//
// 선행조건 화살표는 안 그린다. 19줄에 그으면 엉킨다. 대신 보드의
// '선행 01-01 대기' 표시가 그 자리를 대신한다.
//
// 이름 칸(170px) · 막대 칸(가변) · 건수 칸(고정)의 너비를 헤더와 각 줄이
// 똑같이 맞춰야 오늘·오픈 세로선이 줄마다 어긋나지 않는다. 그래서 세로선을
// 한 번에 긋는 대신(전체를 감싸는 오버레이는 그리드 스팬이 필요해 복잡하다)
// 줄마다 같은 위치에 다시 그린다 — 너비가 같으니 눈에는 이어진 선으로
// 보인다.
//
// props: launch, tasks, today, onPick
export function GanttView({ launch, tasks = [], today, onPick }) {
  const openDate = launch?.open_date;

  const rows = useMemo(() => ganttRows({ tasks, openDate, today }), [tasks, openDate, today]);
  const scale = useMemo(() => ganttScale(rows), [rows]);
  const ticks = useMemo(() => monthTicks(scale, openDate), [scale, openDate]);

  // 오늘의 상대일. dueDate 의 반대 방향이라 launchGantt.js 안 함수(offsetOf)와
  // 같은 계산인데, 여긴 launchDate.js 가 이미 내보낸 dDay 로 충분하다 —
  // dDay(openDate, today) 는 '오늘에서 오픈일까지 며칠'이니 부호만 뒤집으면
  // '오픈일에서 오늘까지 며칠'(오늘의 상대일)이 된다.
  const todayOffset = openDate && today ? -dDay(openDate, today) : null;
  const todayPercent = todayOffset !== null ? offsetPercent(todayOffset, scale) : null;
  const openPercent = offsetPercent(0, scale);

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-400">
        아직 항목이 없습니다. 엑셀에서 가져오거나 ＋ 항목으로 넣으세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[720px]">
          <GanttHeader ticks={ticks} todayPercent={todayPercent} openPercent={openPercent} />
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <GanttRow
                key={row.workstream}
                row={row}
                scale={scale}
                ticks={ticks}
                todayPercent={todayPercent}
                openPercent={openPercent}
                onPick={onPick}
              />
            ))}
          </ul>
        </div>
      </div>
      <Legend />
    </div>
  );
}

const NAME_WIDTH = 'w-[170px] shrink-0';
const LABEL_WIDTH = 'w-[128px] shrink-0';

function GanttHeader({ ticks, todayPercent, openPercent }) {
  return (
    <div className="flex items-end border-b border-slate-100 pb-1 pt-6">
      <div className={`${NAME_WIDTH} px-4 pb-1 text-xs font-medium text-slate-400`}>워크스트림</div>
      <div className="relative h-5 flex-1">
        {ticks.map((t) => (
          <span
            key={`${t.label}-${t.percent}`}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400"
            style={{ left: `${t.percent}%` }}
          >
            {t.label}
          </span>
        ))}
        {todayPercent !== null && (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-rose-600"
            style={{ left: `${todayPercent}%` }}
          >
            오늘
          </span>
        )}
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-indigo-600"
          style={{ left: `${openPercent}%` }}
        >
          오픈
        </span>
      </div>
      <div className={`${LABEL_WIDTH} px-4 pb-1 text-xs font-medium text-slate-400`}>완료/전체</div>
    </div>
  );
}

function GanttRow({ row, scale, ticks, todayPercent, openPercent, onPick }) {
  const hasBar = row.total > 0 && row.minOffset !== null && row.maxOffset !== null;
  const barTitle = hasBar
    ? [
        `${row.from} ~ ${row.to}`,
        `${row.done}/${row.total}`,
        row.late > 0 ? `지남 ${row.late}` : null,
        row.blocked > 0 ? `막힘 ${row.blocked}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : `해당없음 ${row.notApplicable}건`;

  return (
    <li
      className="flex cursor-pointer items-center py-2 hover:bg-slate-50"
      title={barTitle}
      onClick={() => onPick?.(row.workstream)}
    >
      <div className={`${NAME_WIDTH} truncate px-4 text-sm text-slate-700`}>{row.workstream}</div>

      <div className="relative h-6 flex-1">
        {ticks.map((t) => (
          <span
            key={`${t.label}-${t.percent}`}
            className="absolute inset-y-0 w-px bg-slate-100"
            style={{ left: `${t.percent}%` }}
          />
        ))}

        {hasBar && (
          <Bar
            fromPercent={offsetPercent(row.minOffset, scale)}
            toPercent={offsetPercent(row.maxOffset, scale)}
            donePercent={row.percent}
            late={row.late > 0}
          />
        )}

        {todayPercent !== null && (
          <span
            className="absolute inset-y-0 w-0.5 bg-rose-500/70"
            style={{ left: `${todayPercent}%` }}
          />
        )}
        <span
          className="absolute inset-y-0 w-0.5 bg-indigo-500/70"
          style={{ left: `${openPercent}%` }}
        />
      </div>

      <div className={`${LABEL_WIDTH} flex items-center gap-1.5 px-4 text-xs`}>
        {hasBar ? (
          <>
            <span className="font-medium tabular-nums text-slate-700">
              {row.done}/{row.total}
            </span>
            {row.late > 0 && <span className="text-rose-600">지남 {row.late}</span>}
            {row.notApplicable > 0 && (
              <span className="text-slate-400">(＋{row.notApplicable})</span>
            )}
          </>
        ) : (
          <span className="text-slate-400">해당없음 {row.notApplicable}</span>
        )}
      </div>
    </li>
  );
}

function Bar({ fromPercent, toPercent, donePercent, late }) {
  const width = Math.max(0, toPercent - fromPercent);
  return (
    <span
      className={`absolute inset-y-1 overflow-hidden rounded bg-slate-200 ${
        late ? 'ring-2 ring-rose-500' : ''
      }`}
      style={{ left: `${fromPercent}%`, width: `${width}%` }}
    >
      <span
        className="block h-full bg-emerald-400"
        style={{ width: `${donePercent}%` }}
      />
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-slate-500">
      <LegendDot className="bg-emerald-400" label="완료" />
      <LegendDot className="bg-slate-200" label="남은 기간" />
      <LegendDot className="bg-white ring-2 ring-rose-500" label="지남 있음" />
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 bg-rose-500/70" /> 오늘
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 bg-indigo-500/70" /> 오픈일
      </span>
    </div>
  );
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
