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
import { isWorkstream, nextCode } from '@/lib/launchCode';
import { parseDeps } from '@/lib/launchImport';

// 가이드에 항목 하나를 손으로 더한다.
//
// 시트 열이 열다섯인데 필수는 셋뿐이다 — 워크스트림 · 체크 항목 · D-day.
// 열다섯을 다 필수로 받으면 회의 중에 아무도 안 넣는다. 나머지는 나중에
// 채워지고, 안 채워져도 항목은 항목이다.
//
// 코드는 안 받는다. 서버가 짓는다 — 손으로 적게 하면 중복이 나고, 중복은
// unique 제약에 걸려 저장이 통째로 실패한다.
//
// props: open, guideId, workstreams, roles, existingCodes, onClose, onCreated
export function GuideItemDialog({
  open,
  guideId,
  workstreams = [],
  roles = [],
  existingCodes = [],
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(() => empty(workstreams));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function empty(list) {
    return {
      workstream: list[0] ?? '',
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
      is_critical: false,
    };
  }

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError('');
  }

  function close() {
    onClose();
    setForm(empty(workstreams));
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

    setSaving(true);
    const res = await fetch(`/api/launch/guides/${guideId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        day_offset: Number(form.day_offset),
        depends_on: parseDeps(form.depends_on),
      }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '저장하지 못했습니다.');
      return;
    }
    const body = await res.json();
    onCreated?.(body.item);
    close();
  }

  if (!open) return null;

  // 서버가 지을 코드를 미리 보여준다. 어디에 들어가는지 알고 넣게 된다.
  const preview = nextCode({ workstream: form.workstream.trim(), existingCodes });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>가이드에 항목 추가</DialogTitle>
          <DialogDescription>
            필수는 셋입니다 — 워크스트림 · 체크 항목 · D-day. 여기 더한 것은{' '}
            <b>다음 런칭부터</b> 복제됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="체크 항목" required htmlFor="gi-title" className="col-span-full">
            <input
              id="gi-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              placeholder="예: 통신판매업 신고 (신규 법인 명의, 관할 지자체)"
              className={input}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="워크스트림" required htmlFor="gi-ws" className="col-span-2">
              <input
                id="gi-ws"
                list="gi-ws-list"
                value={form.workstream}
                onChange={(e) => set('workstream', e.target.value)}
                placeholder="01_신규법인"
                className={input}
              />
              <datalist id="gi-ws-list">
                {workstreams.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </Field>

            <Field label="D-day" required htmlFor="gi-d">
              <input
                id="gi-d"
                type="number"
                value={form.day_offset}
                onChange={(e) => set('day_offset', e.target.value)}
                className={input}
              />
            </Field>

            <div className="flex items-end pb-2 text-xs text-slate-400">
              {preview ? (
                <span className="tabular-nums">코드 {preview}</span>
              ) : (
                <span>코드는 저장할 때 붙습니다</span>
              )}
            </div>

            <Field label="주관 (수행)" htmlFor="gi-owner">
              <input
                id="gi-owner"
                list="gi-role-list"
                value={form.owner_role}
                onChange={(e) => set('owner_role', e.target.value)}
                placeholder="법무"
                className={input}
              />
              <datalist id="gi-role-list">
                {roles.map((r) => (
                  <option key={r.name} value={r.name} />
                ))}
              </datalist>
            </Field>

            <Field label="지원" htmlFor="gi-support">
              <input
                id="gi-support"
                list="gi-role-list"
                value={form.support_role}
                onChange={(e) => set('support_role', e.target.value)}
                className={input}
              />
            </Field>

            <Field label="결정권" htmlFor="gi-decision">
              <input
                id="gi-decision"
                value={form.decision_org}
                onChange={(e) => set('decision_org', e.target.value)}
                placeholder="브랜드"
                className={input}
              />
            </Field>

            <Field label="소속" htmlFor="gi-org">
              <input
                id="gi-org"
                value={form.owner_org}
                onChange={(e) => set('owner_org', e.target.value)}
                placeholder="지원조직"
                className={input}
              />
            </Field>

            <Field label="채널" htmlFor="gi-ch">
              <input
                id="gi-ch"
                value={form.channel}
                onChange={(e) => set('channel', e.target.value)}
                className={input}
              />
            </Field>

            <Field label="대분류" htmlFor="gi-cat">
              <input
                id="gi-cat"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="법인/자격"
                className={input}
              />
            </Field>

            <Field label="선행조건" htmlFor="gi-dep">
              <input
                id="gi-dep"
                value={form.depends_on}
                onChange={(e) => set('depends_on', e.target.value)}
                placeholder="01-01, 01-02"
                className={input}
              />
            </Field>

            <Field label="산출물·증빙" htmlFor="gi-out">
              <input
                id="gi-out"
                value={form.deliverable}
                onChange={(e) => set('deliverable', e.target.value)}
                placeholder="통신판매업신고증"
                className={input}
              />
            </Field>
          </div>

          <Field label="비고 — 왜 필요한지, 무엇을 조심할지" htmlFor="gi-note">
            <input
              id="gi-note"
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
              {saving ? '저장 중...' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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
