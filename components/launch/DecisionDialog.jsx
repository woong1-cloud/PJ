'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// 결정을 기록하거나(record), 새 결정을 올린다(create).
//
// 두 창을 안 나눈다. '＋ 결정' 단추도 이 창을 쓴다 — 시트의 14건이 전부일
// 리 없고 회의 중에 계속 생기는데(그쪽이 실제로 더 많다), 창을 또 만들면
// 나중에 한쪽만 고쳐진다. TaskEditDialog 가 만들기·고치기를 하나로 쓰는 것과
// 같은 이유다.
//
// record 는 무엇으로 정했는지(decidedNote)가 없으면 서버가 400 을 낸다 —
// 화면에서 먼저 막는다. 저장 뒤에는 곧장 안 닫는다. 이 결정을 기다리던
// 막힌 항목을 그 자리에서 보여줘야 한다 — 상태는 자동으로 안 바뀌니
// "풀렸으면 보드에서 바꾸세요"를 사람에게 넘긴다.
//
// props: open, mode('record'|'create'), launchId, decision(record일 때),
//        onClose, onSaved(decision)
export function DecisionDialog({ open, mode = 'record', launchId, decision, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 저장 뒤 이 결정을 기다리던 항목들. null 이면 아직 저장 전이다.
  const [waiting, setWaiting] = useState(null);

  function close() {
    onClose();
    setNote('');
    setForm(emptyForm());
    setError('');
    setWaiting(null);
  }

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError('');
  }

  async function submitRecord(event) {
    event.preventDefault();
    const text = note.trim();
    if (!text) {
      setError('무엇으로 정했는지 적어야 저장됩니다.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/launch/${launchId}/decisions/${decision.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '결정', decidedNote: text }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '저장하지 못했습니다.');
      return;
    }
    const body = await res.json();
    onSaved?.(body.decision);
    setWaiting(body.waiting ?? []);
  }

  async function submitCreate(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError('결정 항목을 입력하세요.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/launch/${launchId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        when_text: form.when_text.trim(),
        impact: form.impact.trim(),
        owner_text: form.owner_text.trim(),
      }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '만들지 못했습니다.');
      return;
    }
    const body = await res.json();
    onSaved?.(body.decision);
    close();
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '결정 추가' : '결정 기록'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '시트의 14건이 전부가 아닙니다 — 회의 중에 생긴 것을 여기 올립니다.'
              : decision && (decision.when_text ? `[${decision.when_text}] ${decision.title}` : decision.title)}
          </DialogDescription>
        </DialogHeader>

        {waiting !== null ? (
          <div className="flex flex-col gap-3">
            {waiting.length > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                <p>
                  이 결정을 기다리던 <b className="tabular-nums">{waiting.length}건</b>입니다. 풀렸으면
                  보드에서 상태를 바꿔 주세요.
                </p>
                <ul className="mt-1.5 flex flex-col gap-1 text-[13px]">
                  {waiting.map((w) => (
                    <li key={w.id}>
                      <b className="tabular-nums">{w.code}</b> <span className="ml-1">{w.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">저장했습니다. 이 결정을 기다리던 항목은 없습니다.</p>
            )}
            <DialogFooter>
              <Button type="button" onClick={close} className="bg-indigo-600 hover:bg-indigo-700">
                닫기
              </Button>
            </DialogFooter>
          </div>
        ) : mode === 'create' ? (
          <form onSubmit={submitCreate} className="flex flex-col gap-2">
            <Field label="결정 항목" required htmlFor="dd-title">
              <input
                id="dd-title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                autoFocus
                placeholder="재고 운영 방식 — 통합재고 vs 채널별 실물 분리"
                className={input}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="시기" htmlFor="dd-when">
                <input
                  id="dd-when"
                  value={form.when_text}
                  onChange={(e) => set('when_text', e.target.value)}
                  placeholder="9월 중"
                  className={input}
                />
              </Field>
              <Field label="결정 주체" htmlFor="dd-owner">
                <input
                  id="dd-owner"
                  value={form.owner_text}
                  onChange={(e) => set('owner_text', e.target.value)}
                  placeholder="브랜드"
                  className={input}
                />
              </Field>
            </div>
            <Field label="미결 시 영향 — 왜 지금 답해야 하는지" htmlFor="dd-impact">
              <textarea
                id="dd-impact"
                value={form.impact}
                onChange={(e) => set('impact', e.target.value)}
                rows={2}
                placeholder="재고·주문 연동 설계 착수 불가"
                className={input}
              />
            </Field>
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
        ) : (
          <form onSubmit={submitRecord} className="flex flex-col gap-2">
            {decision?.impact && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                미결 시 · {decision.impact}
              </p>
            )}
            <label htmlFor="dd-note" className="text-[11.5px] text-slate-500">
              무엇으로 정했나요? <b>필수입니다</b>
            </label>
            <textarea
              id="dd-note"
              value={note}
              onChange={(e) => { setNote(e.target.value); if (error) setError(''); }}
              autoFocus
              rows={3}
              placeholder="예: 통합재고로 간다 (9/3 결정)"
              className={input}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                그만두기
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? '저장 중...' : '결정으로 저장'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return { title: '', when_text: '', impact: '', owner_text: '' };
}

const input =
  'w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none';

function Field({ label, required, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[11.5px] text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
