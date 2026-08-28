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
import { CANCELLED_STATUS, HOLD_STATUS, REJECTED_STATUS } from '@/lib/statuses';

// 보류·반려·취소의 사유를 받는 창.
//
// 원래는 상태 버튼 자리에 인라인 폼으로 떴다. 그 자리가 상세 사이드바라
// 폭이 200px 남짓인데, 사유는 두 줄짜리 예시를 보여줘야 쓸 수 있는 칸이다.
// 실제 화면에서 플레이스홀더가 통째로 안 보였다 — rows 를 늘려도 폭이
// 그대로라 해결되지 않는다.
//
// 창이 맞는 또 하나의 이유: 셋 다 되돌리기 번거로운 행동이다. 확인 단계가
// 있는 편이 맞고, 이 앱은 이미 착수(StartReviewDialog)와 중복 병합을 창으로
// 받고 있다.
//
// 상태마다 다른 것은 네 가지뿐이다. 나머지는 전부 같아서 한 창을 공유한다.
const COPY = {
  [HOLD_STATUS]: {
    title: '보류로 두기',
    // 무슨 일이 일어나는지 말해 준다. 이게 없으면 누른 사람은 건이 목록에서
    // 사라진 것을 보고 "없어졌다"고 읽는다.
    effect: '목록과 주간회의 안건에서 빠집니다. 60일이 지나도 그대로면 다시 드러납니다.',
    placeholder:
      '무엇이 풀려야 다시 움직이는지 적어 주세요.\n예: API 개편이 끝난 뒤 / 사업자 신고가 나온 뒤',
    confirm: '보류 확정',
    // 붉게 하지 않는다. 거절이 아니라 미루는 것이고, 붉은 확정 버튼은 누르는
    // 사람에게 "돌이킬 수 없는 일"로 읽힌다. 상태 뱃지와 같은 바이올렛이다.
    tone: 'bg-violet-600 hover:bg-violet-700',
    who: '요청자에게 이 문장이 그대로 전달됩니다.',
  },
  [REJECTED_STATUS]: {
    title: '반려하기',
    effect: '진행하지 않기로 하는 것입니다. 지금은 못 하는 것뿐이라면 보류가 맞습니다.',
    placeholder: '왜 진행하지 않는지 적어 주세요.\n예: 현재 정책과 맞지 않아 진행이 어렵습니다',
    confirm: '반려 확정',
    tone: 'bg-rose-600 hover:bg-rose-700',
    who: '요청자에게 이 문장이 그대로 전달됩니다.',
  },
  [CANCELLED_STATUS]: {
    title: '요청 취소',
    effect: '올린 요청을 거두는 것입니다.',
    placeholder: '왜 거두는지 적어 주세요.\n예: 다른 방식으로 해결되어 필요 없어졌습니다',
    confirm: '취소 확정',
    tone: 'bg-slate-700 hover:bg-slate-800',
    who: '담당자에게 이 문장이 그대로 전달됩니다.',
  },
};

// props:
//   status   — HOLD_STATUS | REJECTED_STATUS | CANCELLED_STATUS. null 이면 안 뜬다
//   onSubmit(reason) — { ok } 또는 { ok: false, error }
//   onClose
export function CloseReasonDialog({ status, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const copy = status ? COPY[status] : null;
  if (!copy) return null;

  function close() {
    onClose();
    // 다음에 열었을 때 지난번 글이 남아 있으면 안 된다. 반려하려다 그만두고
    // 보류를 열었는데 반려 사유가 적혀 있으면 그대로 확정될 수 있다.
    setReason('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) {
      setError('사유를 입력하세요.');
      return;
    }
    setSaving(true);
    const result = await onSubmit(reason.trim());
    setSaving(false);
    if (result?.ok) {
      close();
      return;
    }
    // 서버가 말한 이유를 그대로 띄운다.
    //
    // 예전에는 무엇이 실패했든 "종결하지 못했습니다"로 뭉갰다. 상태 CHECK 에
    // 걸려 저장이 안 되던 날, 화면만 보고는 원인을 알 방법이 없었다.
    setError(result?.error ?? '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.effect}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="close-reason" className="text-xs text-slate-500">
              사유
            </label>
            <span className="text-[11px] text-slate-400">{reason.trim().length}자</span>
          </div>
          <textarea
            id="close-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError('');
            }}
            rows={4}
            autoFocus
            placeholder={copy.placeholder}
            className="rounded-lg border border-slate-300 p-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-[11px] text-slate-400">{copy.who}</p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button type="submit" disabled={saving || !reason.trim()} className={copy.tone}>
              {saving ? '처리 중...' : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
