'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { linksOf } from '@/lib/launchDeps';
import { isDone, isNotApplicable } from '@/lib/launchTask';
import { dDay, dDayLabel, dueDate } from '@/lib/launchDate';

// 한 항목의 연계를 한 화면에.
//
// 위로 한 줄, 아래로 여럿. 실제 자료가 그 모양이다 — 선행이 전부 1개씩
// 이라 거슬러 올라가면 줄이고, 내려오면 갈라진다.
//
// 줄의 어느 칸이든 눌러 그 항목으로 옮겨 간다. 창을 닫았다 다시 열게
// 하면 아무도 두 칸 이상 따라가지 않는다 — 9단짜리 줄이 있는데 그러면
// 그 줄을 볼 방법이 없다.
//
// props: open, task, tasks, openDate, today, onClose, onEdit(task)
export function TaskLinksDialog({ open, task, tasks = [], openDate, today, onClose, onEdit }) {
  // 어느 항목을 보고 있나. 처음 연 항목에서 시작해 줄을 따라 옮겨 다닌다.
  const [code, setCode] = useState(() => task?.code ?? null);

  // 목록이 새로 오면(상태를 바꾸고 돌아오면) 같은 코드의 최신 항목을 쓴다.
  const current = tasks.find((t) => t.code === code) ?? task;
  const links = linksOf({ task: current, tasks });
  const { prev, missing, up, next, unlock } = links;

  if (!open || !current) return null;

  const from = task?.code && task.code !== current.code ? task.code : null;

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="mr-1.5 text-sm tabular-nums text-slate-400">{current.code}</span>
            연계된 항목
          </DialogTitle>
          <DialogDescription>{current.title}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* 끊긴 선행이 맨 위다. 이건 자료의 흠이라 다른 무엇보다 먼저
              보여야 고쳐진다 — 조용히 무시하면 오타로 끊긴 줄과 안 가져온
              워크스트림을 구별할 수 없다. */}
          {missing.length > 0 && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
              선행 <b className="tabular-nums">{missing.join(', ')}</b> 이(가) 이 런칭에
              없습니다. 안 가져온 워크스트림이거나 코드가 틀렸습니다 — 대기로는 치지 않습니다.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            {up.line.length > 0 ? (
              <>
                <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                  선행 {up.line.length}단 — 위에서부터 순서대로
                </p>
                {up.line.map((node) => (
                  <div key={node.code}>
                    <LinkRow
                      node={node}
                      openDate={openDate}
                      today={today}
                      tasks={tasks}
                      onGo={setCode}
                    />
                    <Arrow />
                  </div>
                ))}
              </>
            ) : (
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                {up.branched
                  ? `선행이 ${prev.length}건이라 한 줄로 그릴 수 없습니다 — 아래에 나란히 둡니다`
                  : '선행 없음 — 다른 항목을 기다리지 않습니다'}
              </p>
            )}

            {/* 갈라지는 경우에만 선행을 나란히 보여준다. 한 줄이면 위에
                이미 나왔으니 두 번 쓰지 않는다. */}
            {up.branched &&
              prev.map((node) => (
                <div key={node.code}>
                  <LinkRow node={node} openDate={openDate} today={today} tasks={tasks} onGo={setCode} />
                  <Arrow />
                </div>
              ))}

            <LinkRow
              node={{ code: current.code, task: current }}
              openDate={openDate}
              today={today}
              tasks={tasks}
              self
            />

            <Arrow />
            {next.length > 0 ? (
              <>
                <p className="border-y border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                  후행 {next.length}건
                  {unlock > 0 && ` — 이걸 끝내면 ${unlock}건이 풀립니다`}
                </p>
                {next.map((t) => (
                  <LinkRow
                    key={t.code}
                    node={{ code: t.code, task: t }}
                    openDate={openDate}
                    today={today}
                    tasks={tasks}
                    onGo={setCode}
                  />
                ))}
              </>
            ) : (
              <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                후행 없음 — 이걸 기다리는 항목이 없습니다
              </p>
            )}
          </div>

          {from && (
            <button
              type="button"
              onClick={() => setCode(from)}
              className="mt-2 text-[11.5px] text-indigo-700 hover:underline"
            >
              ← {from} 으로 돌아가기
            </button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            닫기
          </Button>
          {onEdit && (
            <Button
              type="button"
              onClick={() => onEdit(current)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {current.code} 고치기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Arrow() {
  return (
    <p className="border-y border-slate-100 bg-slate-50/60 py-0.5 text-center text-xs text-slate-300" aria-hidden>
      ↓
    </p>
  );
}

// 줄의 한 칸. task 가 없으면 끊긴 자리다.
function LinkRow({ node, openDate, today, tasks, self = false, onGo }) {
  const { code, task } = node;

  if (!task) {
    return (
      <div className="flex items-start gap-2.5 border-b border-slate-100 px-3 py-2 text-[12.5px] last:border-b-0">
        <span className="w-14 shrink-0 tabular-nums text-xs text-slate-400">{code}</span>
        <span className="min-w-0 flex-1 text-slate-500">
          이 코드를 가진 항목이 이 런칭에 없습니다.
        </span>
        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">끊김</span>
      </div>
    );
  }

  const due = dueDate(openDate, task.day_offset);
  const days = dDay(due, today);
  const unlock = tasks ? countUnlock(task, tasks) : 0;
  const done = isDone(task);
  const na = isNotApplicable(task);

  const body = (
    <>
      <span className="w-14 shrink-0 tabular-nums text-xs text-slate-400">{code}</span>
      <span className="min-w-0 flex-1">
        <span className={done || na ? 'text-slate-400' : 'text-slate-800'}>{task.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
          {task.owner_role && <span>{task.owner_role}</span>}
          {task.assignee_name && <span className="text-slate-700">{task.assignee_name}</span>}
          {due && (
            <span className="tabular-nums">
              {due}
              {days !== null && <span className="ml-1 text-slate-400">{dDayLabel(days)}</span>}
            </span>
          )}
          {unlock >= 2 && <span className="text-indigo-700">풀림 {unlock}</span>}
        </span>
      </span>
      <StatusTag task={task} self={self} />
    </>
  );

  if (self) {
    return (
      <div className="flex items-start gap-2.5 border-b border-slate-100 bg-indigo-50 px-3 py-2 text-[12.5px] last:border-b-0">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onGo?.(code)}
      className="flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2 text-left text-[12.5px] last:border-b-0 hover:bg-slate-50"
    >
      {body}
    </button>
  );
}

function countUnlock(task, tasks) {
  const code = task?.code;
  if (!code) return 0;
  return (tasks ?? []).filter(
    (t) =>
      !isNotApplicable(t) &&
      !isDone(t) &&
      Array.isArray(t.depends_on) &&
      t.depends_on.includes(code),
  ).length;
}

const TAG = {
  완료: 'bg-emerald-50 text-emerald-700',
  '하는 중': 'bg-indigo-50 text-indigo-700',
  막힘: 'bg-amber-50 text-amber-700',
  해당없음: 'bg-slate-100 text-slate-500',
  '할 것': 'bg-slate-100 text-slate-500',
};

function StatusTag({ task, self }) {
  if (self) {
    return (
      <span className="shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">
        이 항목
      </span>
    );
  }
  const status = task?.status ?? '할 것';
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${TAG[status] ?? TAG['할 것']}`}>
      {status}
    </span>
  );
}
