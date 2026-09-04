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
import { parseDeps } from '@/lib/launchImport';
import { dueDate } from '@/lib/launchDate';

// 항목 하나를 만들거나 고친다.
//
// 두 창을 안 나눈다. 만들기와 고치기가 받는 필드가 거의 같고(코드만 다르다),
// 따로 두면 나중에 한쪽만 고쳐진다 — ①·② 과제 둘 다 이 창 하나를 쓴다.
//
// code 는 안 받는다. 엑셀 왕복의 못이라 여기서 못 건드리게 막는다
// (app/api/launch/[id]/tasks/[taskId]/route.js 의 PLAN_FIELDS 참고) — 고치기는
// 읽기 전용으로 보여주고, 만들기는 서버가 지을 자리를 비워 둔다.
//
// props: open, mode('create'|'edit'), launch, task(edit일 때만), workstreams,
//        roles, orgs, onClose, onSaved(task)
export function TaskEditDialog({
  open,
  mode = 'edit',
  launch,
  task,
  workstreams = [],
  roles = [],
  orgs = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => fromTask(task, workstreams));
  const [saving, setSaving] = useState(false);
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
      setError("워크스트림은 '01_신규법인' 처럼 두 자리 번호로 시작해야 합니다.");
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
      support_role: form.support_role,
      depends_on: parseDeps(form.depends_on),
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
              <input
                id="te-ws"
                list="te-ws-list"
                value={form.workstream}
                onChange={(e) => set('workstream', e.target.value)}
                placeholder="01_신규법인"
                className={input}
              />
              <datalist id="te-ws-list">
                {workstreams.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </Field>

            <Field label="D-day" required htmlFor="te-d">
              <input
                id="te-d"
                type="number"
                value={form.day_offset}
                onChange={(e) => set('day_offset', e.target.value)}
                className={input}
              />
              {/* '-90' 이 며칠인지 아무도 모른다. 오픈일 기준 실제 기한을 옆에 보여준다. */}
              {launch?.open_date && Number.isFinite(Number(form.day_offset)) && (
                <span className="text-xs text-slate-400">
                  {dueDate(launch.open_date, Number(form.day_offset))}
                </span>
              )}
            </Field>

            <div className="flex items-end pb-2 text-xs text-slate-400">
              {mode === 'create' ? (
                <span>코드는 저장할 때 붙습니다</span>
              ) : (
                <span className="tabular-nums">코드 {task?.code}</span>
              )}
            </div>

            <Field label="주관 (수행)" htmlFor="te-owner">
              <input
                id="te-owner"
                list="te-role-list"
                value={form.owner_role}
                onChange={(e) => set('owner_role', e.target.value)}
                placeholder="법무"
                className={input}
              />
              <datalist id="te-role-list">
                {roles.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>

            <Field label="지원" htmlFor="te-support">
              <input
                id="te-support"
                list="te-role-list"
                value={form.support_role}
                onChange={(e) => set('support_role', e.target.value)}
                className={input}
              />
            </Field>

            <Field label="결정권" htmlFor="te-decision">
              <input
                id="te-decision"
                list="te-org-list"
                value={form.decision_org}
                onChange={(e) => set('decision_org', e.target.value)}
                placeholder="브랜드"
                className={input}
              />
              <datalist id="te-org-list">
                {orgs.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>

            <Field label="소속" htmlFor="te-org">
              <input
                id="te-org"
                list="te-org-list"
                value={form.owner_org}
                onChange={(e) => set('owner_org', e.target.value)}
                placeholder="지원조직"
                className={input}
              />
            </Field>

            <Field label="채널" htmlFor="te-ch">
              <input
                id="te-ch"
                value={form.channel}
                onChange={(e) => set('channel', e.target.value)}
                className={input}
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

            <Field label="선행조건" htmlFor="te-dep">
              <input
                id="te-dep"
                value={form.depends_on}
                onChange={(e) => set('depends_on', e.target.value)}
                placeholder="01-01, 01-02"
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
// 숫자·배열은 입력칸에 맞게 문자열로 편다 — day_offset 은 빈 입력을
// 다루기 위해 문자열로, depends_on 은 쉼표 목록으로 보여준다.
function fromTask(task, workstreams) {
  if (!task) {
    return {
      workstream: workstreams[0] ?? '',
      title: '',
      owner_role: '',
      support_role: '',
      decision_org: '',
      owner_org: '',
      channel: '공통',
      category: '',
      day_offset: '-90',
      depends_on: '',
      deliverable: '',
      note: '',
      plain_text: '',
      is_critical: false,
    };
  }
  return {
    workstream: task.workstream ?? '',
    title: task.title ?? '',
    owner_role: task.owner_role ?? '',
    support_role: task.support_role ?? '',
    decision_org: task.decision_org ?? '',
    owner_org: task.owner_org ?? '',
    channel: task.channel ?? '',
    category: task.category ?? '',
    day_offset: String(task.day_offset ?? ''),
    depends_on: (task.depends_on ?? []).join(', '),
    deliverable: task.deliverable ?? '',
    note: task.note ?? '',
    plain_text: task.plain_text ?? '',
    is_critical: task.is_critical === true,
  };
}

const input =
  'h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm focus:border-indigo-400 focus:outline-none';

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
