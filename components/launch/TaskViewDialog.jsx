'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { linksOf } from '@/lib/launchDeps';
import { isDone, isNotApplicable } from '@/lib/launchTask';
import { dDay, dDayLabel, dueDate } from '@/lib/launchDate';
import { assigneeId } from '@/lib/launchMembers';
import {
  TaskActivity, TaskActivityComposer, TaskActivityList,
} from '@/components/launch/TaskActivity';

// 한 항목의 연계를 한 화면에.
//
// 위로 한 줄, 아래로 여럿. 실제 자료가 그 모양이다 — 선행이 전부 1개씩
// 이라 거슬러 올라가면 줄이고, 내려오면 갈라진다.
//
// 줄의 어느 칸이든 눌러 그 항목으로 옮겨 간다. 창을 닫았다 다시 열게
// 하면 아무도 두 칸 이상 따라가지 않는다 — 9단짜리 줄이 있는데 그러면
// 그 줄을 볼 방법이 없다.
//
// props: open, task(지금 보는 항목), tasks, myMemberId, launchName, openDate,
//        today, busy, launchId, memberId, activityKey, onNavigate(code), onClose,
//        onAssign(memberId|null), onEdit(task), onHelpRequest(task)
//
// activityKey 는 "활동을 다시 받아라"는 신호다. 협조 요청을 보내면 그 항목에
// 댓글이 한 줄 생기는데, 창이 열린 채로는 아무도 그것을 알려 주지 않는다.
// key 로 강제 리마운트하지 않는다 — 스크롤과 쓰다 만 댓글이 날아간다.
//
// memberId 는 myMemberId 와 같은 값이지만 이름을 따로 받는다 — 담당자 칸의
// '나'(맡을 수 있는 사람)와 활동의 '나'(자기 댓글만 고칠 수 있는 사람)는
// 뜻이 다르고, 한쪽만 바뀌는 날이 오면 이름이 같은 편이 더 위험하다.
export function TaskViewDialog({
  open, task, tasks = [], myMemberId, launchName, openDate, today, busy = false,
  launchId, memberId, activityKey,
  onNavigate, onClose, onAssign, onEdit, onHelpRequest,
}) {
  // 지금 보는 항목은 주소가 정한다(prop 으로 온다). 줄을 타면 주소가 바뀌고
  // 이 창이 다시 그려진다.
  const current = task;

  // 어디서 왔나. 주소는 '지금 보는 곳'만 가리키므로 되돌아갈 곳은 주소에 없다 —
  // 창이 스스로 기억한다. 주소를 replace 로 갈아서 브라우저 뒤로가기가 이 자리를
  // 대신하지 못한다(뒤로가기는 이 화면을 떠난다).
  const [from, setFrom] = useState(null);

  const links = linksOf({ task: current, tasks });
  const { prev, missing, up, next, unlock } = links;

  const due = dueDate(openDate, current?.day_offset);
  const days = dDay(due, today);

  // 줄을 탄다. 어디서 왔는지 남기고 주소를 바꾼다.
  function go(nextCode) {
    if (!nextCode || nextCode === current?.code) return;
    setFrom(current?.code ?? null);
    onNavigate?.(nextCode);
  }

  if (!open || !current) return null;

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          {/* pr-10 이 없으면 「고치기」가 DialogContent 의 기본 닫기 X 밑에 깔린다.
              그 X 는 absolute top-2 right-2 에 size-7 이라 오른쪽 36px 을 먹고,
              DOM 상 children 뒤에 그려져 위에 얹힌다 — 단추 오른쪽을 누르면
              고치기가 아니라 창이 닫힌다. pr-8(32px)로는 4px 모자란다. */}
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-10">
            <span className="text-sm tabular-nums text-slate-400">{current.code}</span>
            <span className="min-w-0 flex-1">{current.title}</span>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(current)}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-normal text-slate-600 hover:bg-slate-50"
              >
                고치기
              </button>
            )}
          </DialogTitle>
          <DialogDescription>
            {launchName}
            {current.workstream && ` · ${current.workstream}`}
          </DialogDescription>
        </DialogHeader>

        {/* 몸통과 발을 함께 감싼다. 목록은 몸통 맨 아래, 입력칸은 발에 놓이는데
            둘이 한 조회를 나눠 쓰기 때문이다(components/launch/TaskActivity.jsx).
            Provider 는 DOM 을 만들지 않으므로 2단계에서 잡아 둔 뼈대
            (머리 shrink-0 · 몸통 flex-1 스크롤 · 발 shrink-0)는 그대로다. */}
        <TaskActivity
          launchId={launchId}
          taskId={current.id}
          memberId={memberId}
          reloadKey={activityKey}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* 기한·주관·담당자. 지금까지 이 창은 연계만 보여줘서 무엇을 언제까지 누가
                하는지는 고치기 창을 열어야 알 수 있었다. */}
            <div className="mb-3 grid grid-cols-1 gap-x-4 gap-y-2 border-b border-slate-100 pb-3 sm:grid-cols-2">
              <Field label="기한">
                {due ? (
                  <span className="tabular-nums">
                    {due}
                    {days !== null && (
                      <span className={days < 0 ? 'ml-1 text-rose-600' : 'ml-1 text-slate-400'}>
                        {dDayLabel(days)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400">없음</span>
                )}
              </Field>

              <Field label="담당자">
                <Assignee task={current} myMemberId={myMemberId} busy={busy} onAssign={onAssign} />
              </Field>

              <Field label="주관">{current.owner_role || <span className="text-slate-400">없음</span>}</Field>
              <Field label="지원">{current.support_role || <span className="text-slate-400">없음</span>}</Field>
              <Field label="결정권">{current.decision_org || <span className="text-slate-400">없음</span>}</Field>
              <Field label="상태">{current.status}</Field>
            </div>

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
                        onGo={go}
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
                    <LinkRow node={node} openDate={openDate} today={today} tasks={tasks} onGo={go} />
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
                      onGo={go}
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
                onClick={() => {
                  const back = from;
                  setFrom(null);
                  onNavigate?.(back);
                }}
                className="mt-2 text-[11.5px] text-indigo-700 hover:underline"
              >
                ← {from} 으로 돌아가기
              </button>
            )}

            <TaskActivityList />
          </div>

          {/* 발을 세로로 쌓는다. 기본값은 flex-col-reverse + sm:flex-row
              sm:justify-end 이라, 그대로 두면 넓은 화면에서 입력칸과 「닫기」가
              한 줄에 나란히 서서 입력칸이 반 칸으로 줄어든다. 입력칸이 한 줄을
              다 쓰고 「닫기」가 그 아래 오른쪽에 붙게 뒤집지 않은 세로로 고정한다. */}
          <DialogFooter className="shrink-0 flex-col sm:flex-col sm:justify-start">
            <TaskActivityComposer />
            {/* 발은 items-stretch 라 단추가 한 줄을 다 먹는다. 한 겹 싸서
                오른쪽에 붙인다 — 「닫기」는 원래 자리와 같다. */}
            <div className="flex items-center justify-end gap-2">
              {/* 협조 요청은 머리가 아니라 여기다. 이건 항목의 값을 안 바꾼다 —
                  댓글과 같은 표에 같은 줄을 쓰고 request_roles 가 찼는지만
                  다르다. 형제는 「고치기」가 아니라 「등록」이라, 읽고 나서
                  눈이 닿는 자리인 입력칸 아래 왼쪽 끝에 둔다. 머리에서 빼면
                  긴 제목이 두 줄이어도 단추가 그 사이에 끼지 않는다.

                  말줄임표(…)는 바로 안 나간다는 신호다. 진짜 메일 앞에서 한 번
                  멈추게 한다 — 누르면 창이 열린다. */}
              {onHelpRequest && (
                <button
                  type="button"
                  onClick={() => onHelpRequest(current)}
                  className="mr-auto shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-normal text-indigo-700 hover:bg-indigo-50"
                >
                  협조 요청…
                </button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          </DialogFooter>
        </TaskActivity>
      </DialogContent>
    </Dialog>
  );
}

// 이름과 값 한 쌍. 이름 칸을 고정폭으로 두면 값이 세로로 줄맞춤된다.
function Field({ label, children }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-14 shrink-0 text-[11.5px] text-slate-400">{label}</span>
      <span className="min-w-0 text-[13px] text-slate-800">{children}</span>
    </div>
  );
}

// 담당자 칸.
//
// 비어 있으면 「나에게 맡기」 한 줄. 드롭다운으로는 471건의 0 을 못 채운다 —
// 드롭다운은 "내가 후보에 있나"부터 알아야 하고(assigneeCandidates 는 그 항목의
// 주관 역할 참여자만 준다), 없으면 왜 없는지도 모른다.
//
// 남이 맡고 있으면 이 링크를 안 그린다. 남의 일을 한 번 눌러 가져가는 자리가
// 되면 안 된다 — 그때는 고치기 창의 드롭다운으로 바꾼다.
function Assignee({ task, myMemberId, busy, onAssign }) {
  // assignee 는 목록 API 에서 객체로 온다({ id, name }). === 문자열로 견주면
  // 늘 거짓이다 — 1단계에서 「내 담당」이 그래서 영영 0이었다.
  const current = assigneeId(task);
  const name = task?.assignee?.name ?? task?.assignee_name ?? '';

  if (!current && !name) {
    if (!myMemberId) return <span className="text-slate-400">없음</span>;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onAssign?.(myMemberId)}
        className="text-[13px] text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:opacity-50"
      >
        나에게 맡기
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[12.5px] text-indigo-700">
        {name || '(이름 없음)'}
      </span>
      {current && current === myMemberId && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign?.(null)}
          className="text-[11px] text-slate-400 underline hover:text-slate-600 disabled:opacity-50"
        >
          놓기
        </button>
      )}
    </span>
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
