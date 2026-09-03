'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// 해당없음 사유를 받는다. 필수다.
//
// 컴플라이언스 도구가 통제 항목을 N/A 처리할 때 사유를 강제하는 것과 같은
// 이유다 — 다음 브랜드가 "HOKA는 왜 앱을 뺐지"에 답해야 한다.
//
// 빠른 선택지를 붙이는 이유: 451건에서 자유 입력만 받으면 아무도 안 쓴다.
// 누르면 채워지고 고칠 수 있다.
const QUICK = [
  '이 채널에 입점하지 않음',
  '2차로 미루기로 함',
  '다른 항목에서 관리 (중복)',
  '신규 법인이 아니라 불필요',
];

// props: open, title, onClose, onSubmit(reason)
export function NotApplicableDialog({ open, title, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function close() {
    onClose();
    setReason('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError('사유를 적어야 저장됩니다.');
      return;
    }
    setSaving(true);
    await onSubmit(text);
    setSaving(false);
    close();
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>해당없음으로 두기</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="na-reason" className="text-[11.5px] text-slate-500">
            왜 이 브랜드에는 해당이 없나요? <b>필수입니다</b>
          </label>
          <textarea
            id="na-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
            autoFocus
            rows={3}
            placeholder="예: 앱은 오픈 후 2차로 미루기로 함 (9/2 결정)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setReason(q)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] text-slate-600 hover:border-indigo-400 hover:text-indigo-700"
              >
                {q}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? '저장 중...' : '해당없음으로'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
