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
import { MAX_FEEDBACK_BODY } from '@/lib/feedback';

// 모아에 대한 의견을 보내는 창.
//
// 한 칸이다. 종류(오류/개선/문의)도 우선순위도 화면 경로도 묻지 않는다.
// 분류는 쓰는 사람보다 읽는 쪽이 잘하고, 칸이 늘수록 "이 버튼 좀 작아요"
// 같은 가벼운 말이 안 올라온다 — 그리고 이 창구가 받아야 할 것이 정확히
// 그런 말이다.
//
// 요구사항 흐름으로 받지 않은 이유: 등록 폼이 무겁다. As-Is · To-Be ·
// 카테고리 · 채널 · 우선순위를 다 채워야 하는데, 가벼운 의견을 남기려고
// 그것을 통과해야 하면 아무도 안 쓴다. 무거운 것만 관리 화면에서
// 요구사항으로 승격한다.
//
// props: open, onClose()
export function FeedbackDialog({ open, onClose }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function close() {
    onClose();
    // 다음에 열었을 때 지난번 글이 남아 있으면 안 된다. 보냈든 안 보냈든
    // 이 창은 한 번에 한 마디를 받는 자리다.
    setBody('');
    setError('');
    setSent(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setSent(true);
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sent ? '보냈습니다' : '의견 보내기'}</DialogTitle>
          <DialogDescription>
            {sent
              ? '읽고 반영되면 알려드리겠습니다.'
              : '모아를 쓰면서 불편한 점이나 바라는 것을 적어 주세요. 짧아도 괜찮습니다.'}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <DialogFooter>
            <Button type="button" onClick={close} className="bg-indigo-600 hover:bg-indigo-700">
              닫기
            </Button>
          </DialogFooter>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={MAX_FEEDBACK_BODY}
              autoFocus
              aria-label="의견"
              placeholder="예: 목록에서 제목이 잘려서 뭔지 알아보기 어렵습니다."
              className="rounded-lg border border-slate-300 p-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                그만두기
              </Button>
              <Button
                type="submit"
                disabled={saving || !body.trim()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? '보내는 중...' : '보내기'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
