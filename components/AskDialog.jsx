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

// 요청자에게 요건을 묻는 창.
//
// 왜 코멘트로 안 하고 따로 두나: 코멘트만 달면 그 건은 여전히 '검토대기
// 27일'로 남는다. 화면은 "IT 가 27일째 안 집었다"고 말하는데 공은 요청자에게
// 넘어가 있다. 이 창은 묻는 일과 그 사실을 기록하는 일을 한 번에 한다.
//
// 한 칸이다. 종류를 고르게 하지 않는다 — 무엇이 불명확한지는 문장 하나로
// 말하는 것이 가장 정확하고, 칸이 늘면 회의 중에 안 쓴다.
//
// props:
//   open, requesterName, onSubmit(question) → { ok } | { ok: false, error }, onClose
export function AskDialog({ open, requesterName, onSubmit, onClose }) {
  const [question, setQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function close() {
    onClose();
    setQuestion('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!question.trim()) {
      setError('무엇을 확인하고 싶은지 적어 주세요.');
      return;
    }
    setSaving(true);
    const result = await onSubmit(question.trim());
    setSaving(false);
    if (result?.ok) {
      close();
      return;
    }
    // 서버가 말한 이유를 그대로 띄운다. 이미 확인 대기인 건처럼, 사람이 알아야
    // 다음 행동이 정해지는 경우가 있다.
    setError(result?.error ?? '보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>요건 확인 요청</DialogTitle>
          <DialogDescription>
            {requesterName ? `${requesterName}님에게 ` : '요청자에게 '}메일이 갑니다. 답이 올
            때까지 이 건은 회의 안건과 &lsquo;멈춘 것&rsquo;에서 빠집니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="ask-question" className="text-xs text-slate-500">
            물어볼 것
          </label>
          <textarea
            id="ask-question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (e.target.value.trim()) setError('');
            }}
            rows={4}
            autoFocus
            placeholder={
              '무엇이 명확하지 않은지 적어 주세요.\n예: 선물포장이 상품 단위인가요, 주문 단위인가요? 포장비 결제 방식도 알려주세요.'
            }
            className="rounded-lg border border-slate-300 p-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-[11px] text-slate-400">
            코멘트로도 남습니다. 답이 오면 자동으로 안건에 다시 올라옵니다.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button
              type="submit"
              disabled={saving || !question.trim()}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {saving ? '보내는 중...' : '보내고 확인 대기로'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
