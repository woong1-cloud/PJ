'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { APPROVAL_PENDING_STATUS } from '@/lib/statuses';

const MAX_REASON = 500;

// 최종 승인 창. 보드와 상세가 같은 컴포넌트를 쓴다 — 두 벌로 만들면 한쪽만
// 고치는 날이 온다.
//
// 확인 내용을 필수로 받는 것이 이 창의 존재 이유다. 버튼 하나로 끝내면
// "누가 눌렀다"만 남고 "무엇을 확인했다"가 안 남는다. 마찰이 있는 것은 이
// 단계의 성질이지 결함이 아니다.
//
// props:
//   requirement — { id, title, status }
//   brandId     — 요청에 실을 브랜드(요구사항 자신의 브랜드)
//   onApproved  — 성공 시 호출. 부모가 목록/상세를 다시 불러온다
export function ApprovalDialog({ open, onOpenChange, requirement, brandId, onApproved }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 창이 열리는 렌더에서 초기화한다(useEffect 대신 파생 상태).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason('');
      setError('');
    }
  }

  // 승인대기를 거치지 않고 바로 완료로 오는 경우를 알려 준다. 막지는 않는다 —
  // 급한 건이나 사소한 건까지 QA를 강제하면 사람들은 우회로부터 찾는다.
  const skipped = Boolean(requirement) && requirement.status !== APPROVAL_PENDING_STATUS;

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/requirements/${requirement.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '승인에 실패했습니다.');
      onOpenChange(false);
      onApproved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>최종 승인</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3 break-keep text-sm">
          <p className="text-slate-600">
            <span className="font-medium text-slate-900">{requirement?.title}</span>
            {' 를 완료로 처리합니다.'}
          </p>

          {skipped && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              현재 상태는 <b>{requirement?.status}</b>입니다. QA중·승인대기를 거치지
              않았고, 그 사실은 상태 이력에 그대로 남습니다.
            </p>
          )}

          {error && <p className="text-red-600">{error}</p>}

          <div className="flex flex-col gap-1">
            <label htmlFor="approval-reason" className="text-slate-600">
              무엇을 확인하셨나요?
            </label>
            <textarea
              id="approval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={MAX_REASON}
              placeholder="예: 요청한 데이터 파이프라인이 설계대로 동작하는 것을 확인했습니다."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              required
            />
            <p className="text-xs text-slate-400">
              나중에 요구사항을 정리할 때 이 기록이 재료가 됩니다.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? '처리 중...' : '승인하고 완료'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
