'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// 막힘으로 두기 — 종류를 가른다.
//
// 이유 없는 막힘은 회의를 "그래서 뭐가 문제죠"로 시작하게 만든다. 그래서
// 의사결정 때문인지 그 밖의 일인지부터 묻는다 — 전자면 결정 대기 목록에
// 잇는다(blockedDecisionId), 후자면 지금까지처럼 자유 사유(blockedReason)다.
// 회의에서 다투는 14건짜리 목록에 없는 결정이면 그 자리에서 새로 올릴 수
// 있다 — 이 길이 실제로 제일 많이 쓰일 것이다.
//
// 서버로는 patchTask 를 그대로 쓴다(onSubmit 이 LaunchBoard 의 patchTask를
// 부른다) — busy 표시·에러 처리를 두 군데서 따로 만들지 않는다.
//
// props: open, task, launchId, decisions(전체 — 대기만 여기서 거른다),
//        onClose, onSubmit({ blockedDecisionId, blockedReason }),
//        onDecisionCreated(decision)
export function BlockDialog({ open, task, launchId, decisions = [], onClose, onSubmit, onDecisionCreated }) {
  const [kind, setKind] = useState('decision'); // 'decision' | 'other'
  const [decisionId, setDecisionId] = useState('');
  const [reason, setReason] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pending = decisions.filter((d) => d.status === '대기');

  function close() {
    onClose();
    setKind('decision');
    setDecisionId('');
    setReason('');
    setCreating(false);
    setNewTitle('');
    setError('');
  }

  // 회의 중에 그 자리에서 결정 하나를 새로 올린다. 제목은 이 항목 제목을
  // 기본값으로 둔다 — 대개 막힌 이유가 곧 결정거리의 제목이다.
  async function createDecision() {
    const title = (newTitle.trim() || task?.title || '').trim();
    if (!title) {
      setError('결정 제목을 입력하세요.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/launch/${launchId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '만들지 못했습니다.');
      return;
    }
    const body = await res.json();
    onDecisionCreated?.(body.decision);
    setDecisionId(body.decision.id);
    setCreating(false);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();

    if (kind === 'decision') {
      if (!decisionId) {
        setError('어느 결정인지 골라 주세요.');
        return;
      }
      setSaving(true);
      // 명시적으로 둘 다 보낸다 — 이전에 자유 사유로 막혔던 항목을 결정
      // 연결로 바꿀 때, 지난 사유가 서버에 그대로 남지 않게 한다.
      await onSubmit({ blockedDecisionId: decisionId, blockedReason: null });
      setSaving(false);
      close();
      return;
    }

    const text = reason.trim();
    if (!text) {
      setError('무엇에 막혔는지 적어 주세요.');
      return;
    }
    setSaving(true);
    await onSubmit({ blockedReason: text, blockedDecisionId: null });
    setSaving(false);
    close();
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>막힘으로 두기</DialogTitle>
          <DialogDescription>{task ? `${task.code} · ${task.title}` : ''}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-[11.5px] text-slate-500">무엇에 막혔나요?</p>

          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 ${
              kind === 'decision' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
            }`}
          >
            <input
              type="radio"
              name="block-kind"
              checked={kind === 'decision'}
              onChange={() => { setKind('decision'); if (error) setError(''); }}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-slate-800">의사결정이 필요합니다</span>

              {kind === 'decision' && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <select
                    value={decisionId}
                    onChange={(e) => { setDecisionId(e.target.value); if (error) setError(''); }}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">어느 결정인가요?</option>
                    {pending.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.when_text ? `[${d.when_text}] ` : ''}
                        {d.title}
                      </option>
                    ))}
                  </select>

                  {creating ? (
                    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        autoFocus
                        placeholder={task?.title ?? '결정 제목'}
                        className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs focus:border-indigo-400 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={createDecision}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          만들고 고르기
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreating(false)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          그만두기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setCreating(true); setNewTitle(task?.title ?? ''); }}
                      className="self-start text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      ＋ 새 결정으로 올리기
                    </button>
                  )}
                </div>
              )}
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 ${
              kind === 'other' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
            }`}
          >
            <input
              type="radio"
              name="block-kind"
              checked={kind === 'other'}
              onChange={() => { setKind('other'); if (error) setError(''); }}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-slate-800">그 밖</span>
              {kind === 'other' && (
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
                  autoFocus
                  rows={2}
                  placeholder="예: 본사 회신 대기 중, 9/10 재요청"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                />
              )}
            </div>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? '저장 중...' : '막힘으로 두기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
