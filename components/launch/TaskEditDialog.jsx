'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isWorkstream } from '@/lib/launchCode';
import { byCode, scheduleConflicts } from '@/lib/launchDeps';
import { assigneeCandidates } from '@/lib/launchMembers';
import { dueDate, offsetFromDate } from '@/lib/launchDate';
import { PickOrType } from '@/components/launch/PickOrType';
import { DepPicker } from '@/components/launch/DepPicker';

// 항목 하나를 만들거나 고친다.
//
// 두 창을 안 나눈다. 만들기와 고치기가 받는 필드가 거의 같고(코드만 다르다),
// 따로 두면 나중에 한쪽만 고쳐진다 — ①·② 과제 둘 다 이 창 하나를 쓴다.
//
// code 는 안 받는다. 엑셀 왕복의 못이라 여기서 못 건드리게 막는다
// (app/api/launch/[id]/tasks/[taskId]/route.js 의 PLAN_FIELDS 참고) — 고치기는
// 읽기 전용으로 보여주고, 만들기는 서버가 지을 자리를 비워 둔다.
//
// props: open, mode('create'|'edit'), launch, task(edit일 때만), tasks, workstreams,
//        roles, orgs, channels, onClose, onSaved(task)
export function TaskEditDialog({
  open,
  mode = 'edit',
  launch,
  task,
  tasks = [],
  members = [],
  workstreams = [],
  roles = [],
  orgs = [],
  channels = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => fromTask(task, workstreams));
  // 달력칸에 넣을 값. 숫자칸이 비었거나 숫자가 아니면 빈 칸으로 둔다 —
  // 여기서 0 으로 떨어뜨리면 '-' 만 지운 순간 달력이 오픈일로 튄다.
  const offset = Number(form.day_offset);
  const dueValue =
    launch?.open_date && form.day_offset !== '' && Number.isFinite(offset)
      ? (dueDate(launch.open_date, offset) ?? '')
      : '';

  // 담당자 후보 — 이 항목의 주관 역할로 들어온 참여자들.
  //
  // 501건 중 담당자가 0건인 이유는 19명 중에서 손으로 골라 적게 되어
  // 있어서다. 후보가 2~3명이 되면 고를 만해진다.
  //
  // 주관 역할을 창 안에서 바꾸면 후보도 따라 바뀐다 — 저장 전의 값으로
  // 센다(task.owner_role 이 아니라 form.owner_role).
  const candidates = assigneeCandidates({ task: { owner_role: form.owner_role }, members });
  const pickedMember = candidates.find((m) => m.member_id === form.assignee);

  // 기한이 선행·후행과 어긋나나. 막지 않고 알리기만 한다 — 일부러 그렇게
  // 두는 경우가 있고, 그 판단은 이 창을 연 사람 몫이다.
  const conflicts = scheduleConflicts({
    code: task?.code,
    dayOffset: form.day_offset === '' ? NaN : offset,
    dependsOn: form.depends_on,
    tasks,
  });
  const [saving, setSaving] = useState(false);
  // 담당자를 목록에서 고르는 중인가, 직접 적는 중인가. 값으로 표현하지
  // 않는다 — 빈 문자열로는 '아직 안 골랐다'와 '적으려고 비웠다'를 못
  // 가른다(PickOrType 이 같은 이유로 상태를 따로 든다).
  const [assigneeTyping, setAssigneeTyping] = useState(
    () => Boolean(task?.assignee_name) && !task?.assignee,
  );
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError('');
  }

  function close() {
    onClose();
    setForm(fromTask(task, workstreams));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!isWorkstream(form.workstream.trim())) {
      setError('워크스트림을 입력하세요.');
      return;
    }
    if (!form.title.trim()) {
      setError('체크 항목을 입력하세요.');
      return;
    }
    if (!Number.isFinite(Number(form.day_offset))) {
      setError('D-day 를 숫자로 입력하세요.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      workstream: form.workstream.trim(),
      category: form.category,
      channel: form.channel,
      decision_org: form.decision_org,
      owner_org: form.owner_org,
      owner_role: form.owner_role,
      // 계정으로 고르면 uuid 로, 직접 적으면 글자로 보낸다. 둘이 같이
      // 차 있으면 화면이 어느 것을 보여줄지 정해야 하므로 한쪽만 남긴다.
      assignee: form.assignee || null,
      assigneeName: form.assignee ? '' : form.assignee_name,
      support_role: form.support_role,
      depends_on: form.depends_on,
      day_offset: Number(form.day_offset),
      deliverable: form.deliverable,
      note: form.note,
      plain_text: form.plain_text,
      is_critical: form.is_critical,
    };

    setSaving(true);
    const url =
      mode === 'create'
        ? `/api/launch/${launch.id}/tasks`
        : `/api/launch/${launch.id}/tasks/${task.id}`;
    const res = await fetch(url, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '저장하지 못했습니다.');
      return;
    }
    const body = await res.json();
    onSaved?.(body.task);
    close();
  }

  if (!open) return null;

  const already = mode === 'edit' && task?.source === 'manual';

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '항목 추가' : '항목 고치기'}</DialogTitle>
          <DialogDescription>
            {task ? `${task.code} ${task.title}` : '필수는 셋입니다 — 체크 항목 · 워크스트림 · D-day.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'create' ? (
          <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            손으로 넣은 항목은 엑셀이 건드리지 않습니다.
          </p>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {already ? (
              <>이미 <b>독립한 항목</b>입니다. 엑셀을 다시 올려도 이 줄은 안 바뀝니다.</>
            ) : (
              <>고치면 이 항목은 <b>엑셀에서 독립</b>합니다. 다음 업로드가 덮어쓰지 않습니다.</>
            )}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="체크 항목" required htmlFor="te-title" className="col-span-full">
            <input
              id="te-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              placeholder="예: 통신판매업 신고 (신규 법인 명의, 관할 지자체)"
              className={input}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="워크스트림" required htmlFor="te-ws" className="col-span-2">
              <PickOrType
                id="te-ws"
                value={form.workstream}
                options={workstreams}
                onChange={(v) => set('workstream', v)}
                placeholder="D01_법인·행정"
              />
            </Field>

            {/* 칸이 둘, 저장은 하나.
                사람은 'D-90'으로 생각하지 않고 '11월 3일까지'로 생각한다.
                그래서 달력으로도 찍게 하고, 저장은 여전히 day_offset 이다 —
                오픈일이 하루 밀리면 487건이 통째로 따라 움직여야 한다
                (lib/launchDate.js 맨 위 참고).

                숫자칸을 안 없앤다. 엑셀 양식이 D-day 열이라 그 감각으로
                일하는 사람이 있고, 'D-90 쯤'은 날짜보다 숫자가 빠르다. */}
            <Field label="D-day" required htmlFor="te-d" className="col-span-2">
              <div className="flex items-center gap-1.5">
                <input
                  id="te-d"
                  type="number"
                  value={form.day_offset}
                  onChange={(e) => set('day_offset', e.target.value)}
                  className={`${inputBase} w-20 shrink-0`}
                />
                <span className="shrink-0 text-xs text-slate-400">또는</span>
                <input
                  type="date"
                  aria-label="기한을 달력에서 고르기"
                  value={dueValue}
                  // 오픈일이 없으면 환산할 기준이 없다. 실제로는 not null 이라
                  // 안 생기지만, 그때 달력이 0 을 넣는 것보다 잠기는 편이 낫다.
                  disabled={!launch?.open_date}
                  onChange={(e) => {
                    const next = offsetFromDate(launch?.open_date, e.target.value);
                    if (next !== null) set('day_offset', String(next));
                  }}
                  className={`${inputBase} min-w-0 flex-1 disabled:bg-slate-50 disabled:text-slate-400`}
                />
              </div>
              {/* 코드 안내가 칸 하나를 통째로 쓰고 있었다. 한 줄에 접는다 —
                  D-day 가 두 칸을 쓰게 되면서 자리가 없기도 하고, 이 둘은
                  다 '읽기만 하는 것'이라 같은 줄이 맞다. */}
              <span className="text-xs text-slate-400">
                {launch?.open_date && `오픈 ${launch.open_date} 기준`}
                {launch?.open_date && ' · '}
                {mode === 'create' ? (
                  '코드는 저장할 때 붙습니다'
                ) : (
                  <span className="tabular-nums">코드 {task?.code}</span>
                )}
              </span>

              {/* 앞뒤가 어긋나면 그 자리에서 알린다.
                  저장한 뒤에는 아무도 안 본다 — 이 흠이 19건 쌓이도록
                  아무도 몰랐고, 찾아내는 데 쿼리 한 판이 필요했다.
                  막지는 않는다. 실제로 01-05 를 일부러 미루면서 생긴
                  건이 있고, 그것이 옳은 판단일 수 있다. */}
              <ScheduleWarning conflicts={conflicts} openDate={launch?.open_date} />
            </Field>

            <Field label="주관 (수행)" htmlFor="te-owner">
              <PickOrType
                id="te-owner"
                value={form.owner_role}
                options={roles}
                onChange={(v) => set('owner_role', v)}
                placeholder="법무팀"
              />
            </Field>

            {/* 참여자가 있으면 고르게, 없으면 지금처럼 적게 한다.
                명단이 비어 있는 역할에서 빈 드롭다운을 주면 '고를 것이
                없다'가 '적을 수도 없다'가 된다. */}
            <Field label="담당자" htmlFor="te-assignee">
              {candidates.length > 0 && !assigneeTyping ? (
                <select
                  id="te-assignee"
                  value={form.assignee}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM) {
                      // 직접 적기로 넘어간다. 고른 계정은 놓는다 — 둘이
                      // 같이 차 있으면 무엇이 저장될지 알 수 없다.
                      set('assignee', '');
                      setAssigneeTyping(true);
                    } else {
                      set('assignee', e.target.value);
                    }
                  }}
                  className={input}
                >
                  <option value="">담당자 없음</option>
                  {candidates.map((m) => (
                    <option key={m.member_id} value={m.member_id}>
                      {m.member.name}
                    </option>
                  ))}
                  <option value={CUSTOM}>직접 적기…</option>
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    id="te-assignee"
                    value={form.assignee_name}
                    onChange={(e) => set('assignee_name', e.target.value)}
                    placeholder="김지웅"
                    className={`${inputBase} min-w-0 flex-1`}
                  />
                  {candidates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        set('assignee_name', '');
                        setAssigneeTyping(false);
                      }}
                      className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      목록
                    </button>
                  )}
                </div>
              )}
              <span className="text-xs text-slate-400">
                {candidates.length > 0
                  ? `${form.owner_role} 참여자 ${candidates.length}명`
                  : form.owner_role
                    ? `${form.owner_role} 참여자가 없습니다 — 이름을 적으세요`
                    : '주관을 먼저 고르면 참여자에서 고를 수 있습니다'}
              </span>
            </Field>

            <Field label="지원" htmlFor="te-support">
              <PickOrType
                id="te-support"
                value={form.support_role}
                options={roles}
                onChange={(v) => set('support_role', v)}
                placeholder="재무팀"
              />
            </Field>

            <Field label="결정권" htmlFor="te-decision">
              <PickOrType
                id="te-decision"
                value={form.decision_org}
                options={orgs}
                onChange={(v) => set('decision_org', v)}
                placeholder="브랜드"
              />
            </Field>

            <Field label="소속" htmlFor="te-org">
              <PickOrType
                id="te-org"
                value={form.owner_org}
                options={orgs}
                onChange={(v) => set('owner_org', v)}
                placeholder="지원조직"
              />
            </Field>

            <Field label="채널" htmlFor="te-ch">
              <PickOrType
                id="te-ch"
                value={form.channel}
                options={channels}
                onChange={(v) => set('channel', v)}
                placeholder="공통"
              />
            </Field>

            <Field label="대분류" htmlFor="te-cat">
              <input
                id="te-cat"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="법인/자격"
                className={input}
              />
            </Field>

            <Field label="산출물·증빙" htmlFor="te-out">
              <input
                id="te-out"
                value={form.deliverable}
                onChange={(e) => set('deliverable', e.target.value)}
                placeholder="통신판매업신고증"
                className={input}
              />
            </Field>
          </div>

          {/* 선행조건은 그리드에서 뺐다. 네 칸 중 한 칸(151px)에 칩과
              검색 결과를 넣을 수 없다 — 넣으면 지난번 D-day 처럼 밖으로
              밀려난다. 창 전체 폭을 쓴다. */}
          <Field label="선행조건 — 이것이 끝나야 시작할 수 있는 일" htmlFor="te-dep">
            <DepPicker
              id="te-dep"
              code={task?.code}
              value={form.depends_on}
              tasks={tasks}
              openDate={launch?.open_date}
              onChange={(next) => set('depends_on', next)}
            />
          </Field>

          <Field label="쉬운 설명 — 무엇을 하는 일인지" htmlFor="te-plain">
            <input
              id="te-plain"
              value={form.plain_text}
              onChange={(e) => set('plain_text', e.target.value)}
              placeholder="쇼핑몰을 열려면 먼저 통신판매업을 신고해야 함"
              className={input}
            />
          </Field>

          <Field label="비고 — 왜 필요한지, 무엇을 조심할지" htmlFor="te-note">
            <input
              id="te-note"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="구매안전서비스 가입증명 선행 필요"
              className={input}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.is_critical}
              onChange={(e) => set('is_critical', e.target.checked)}
              className="h-4 w-4"
            />
            핵심 항목(★) — 늦으면 오픈이 밀리는 것
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? '저장 중...' : mode === 'create' ? '추가' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// task 가 있으면(고치기) 그 값으로, 없으면(만들기) 빈 값으로 채운다.
//
// day_offset 만 문자열이다 — 빈 입력('-' 만 지운 순간)을 다뤄야 해서다.
// depends_on 은 배열 그대로 든다. DepPicker 가 코드 배열로 주고받고
// 서버도 배열로 받는다(app/api/launch/[id]/tasks/[taskId]/route.js).
// 베끼는 이유: 원본 배열을 그대로 들면 '그만두기'가 안 되돌려진다.
function fromTask(task, workstreams) {
  if (!task) {
    return {
      workstream: workstreams[0] ?? '',
      title: '',
      assignee: '',
      assignee_name: '',
      owner_role: '',
      support_role: '',
      decision_org: '',
      owner_org: '',
      channel: '공통',
      category: '',
      day_offset: '-90',
      depends_on: [],
      deliverable: '',
      note: '',
      plain_text: '',
      is_critical: false,
    };
  }
  return {
    workstream: task.workstream ?? '',
    title: task.title ?? '',
    assignee: task.assignee?.id ?? '',
    assignee_name: task.assignee_name ?? '',
    owner_role: task.owner_role ?? '',
    support_role: task.support_role ?? '',
    decision_org: task.decision_org ?? '',
    owner_org: task.owner_org ?? '',
    channel: task.channel ?? '',
    category: task.category ?? '',
    day_offset: String(task.day_offset ?? ''),
    depends_on: [...(task.depends_on ?? [])],
    deliverable: task.deliverable ?? '',
    note: task.note ?? '',
    plain_text: task.plain_text ?? '',
    is_critical: task.is_critical === true,
  };
}

// 너비를 뺀 알맹이. D-day 처럼 한 줄에 칸이 둘인 자리는 여기서 시작해
// 제 너비를 붙인다.
//
// `${input} w-24` 라고 쓰면 안 된다 — 클래스 문자열의 순서가 아니라
// 스타일시트의 순서가 이기기 때문에 w-full 이 그대로 이긴다. 실제로
// 숫자칸이 100%를 먹고 달력을 창 바깥으로 밀어냈다.
// PickOrType 과 같은 뜻의 값. 드롭다운 안에서 '직접 적기'를 고르는 자리다.
const CUSTOM = '__custom__';

const inputBase =
  'h-9 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-indigo-400 focus:outline-none';

const input = `${inputBase} w-full`;

// 기한이 선행보다 이르거나 후행보다 늦을 때.
function ScheduleWarning({ conflicts, openDate }) {
  const { lateDeps, earlyFollowers } = conflicts;
  if (lateDeps.length === 0 && earlyFollowers.length === 0) return null;

  const line = (t, kind) => (
    <li key={`${kind}-${t.code}`} className="flex gap-1.5">
      <span className="shrink-0">{kind === 'dep' ? '선행' : '후행'}</span>
      <span className="shrink-0 tabular-nums">{t.code}</span>
      <span className="min-w-0 truncate">{t.title}</span>
      <span className="shrink-0 tabular-nums">
        {openDate ? dueDate(openDate, t.day_offset) : `D${t.day_offset}`}
      </span>
    </li>
  );

  return (
    <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
      <p className="font-medium">
        {lateDeps.length > 0 && '이 기한은 선행보다 이릅니다'}
        {lateDeps.length > 0 && earlyFollowers.length > 0 && ' · '}
        {earlyFollowers.length > 0 && '후행보다 늦습니다'}
      </p>
      <ul className="mt-0.5 flex flex-col gap-0.5 text-amber-700">
        {lateDeps.map((t) => line(t, 'dep'))}
        {earlyFollowers.map((t) => line(t, 'next'))}
      </ul>
      {/* 일부러 그렇게 두는 경우가 있다. 저장은 막지 않는다. */}
      <p className="mt-1 text-amber-600">그대로 저장할 수 있습니다.</p>
    </div>
  );
}

function Field({ label, required, htmlFor, className = '', children }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-[11.5px] text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
