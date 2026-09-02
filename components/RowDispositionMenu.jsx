'use client';

import { useState } from 'react';
import { CloseReasonDialog } from '@/components/CloseReasonDialog';
import { CANCELLED_STATUS, CLOSED_STATUSES, HOLD_STATUS, MERGED_STATUS, REJECTED_STATUS } from '@/lib/statuses';
import { canProcess } from '@/lib/tiers';

// 목록 행의 '⋯' — 상세로 안 들어가고 처분한다.
//
// 왜 필요한가: 보류·반려·취소가 어느 목록 뷰에도 없었다. 전부 상세로 들어가야
// 했고, 목록(행) 뷰는 제목 링크 말고 아무 행동도 없었다. 매일 보는 화면이
// 그런데 회의 화면부터 고치려던 것이 순서가 틀렸다.
//
// 사유가 필요한 것은 CloseReasonDialog 를 그대로 쓴다. 상세와 같은 창이라
// 문구·검증·서버 오류 표시가 갈리지 않는다.
//
// props:
//   requirement — { id, status, requester }
//   identity
//   onClose(status, reason) → { ok } | { ok: false, error }
//   onMerge() — 없으면 중복 병합을 안 보여준다
export function RowDispositionMenu({ requirement, identity, onClose, onMerge }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(null);

  const status = requirement?.status;
  const merged = status === MERGED_STATUS;
  const closed = CLOSED_STATUSES.includes(status);
  const process = canProcess(identity);

  // 상세와 같은 규칙이다. 보류·반려는 IT 의 판단이고, 취소는 자기 요청을
  // 거두는 것이라 요청자 본인에게만 준다(lib/headline.js 의 resolveAction).
  const canHold = process && !merged && status !== HOLD_STATUS;
  const canReject = process && !merged;
  const requesterId =
    typeof requirement?.requester === 'string'
      ? requirement.requester
      : (requirement?.requester?.id ?? null);
  const canCancel = !closed && requesterId && requesterId === identity?.memberId;

  const items = canHold || canReject || canCancel || Boolean(onMerge);
  // 병합된 건은 서버가 상태 변경 자체를 막는다. 버튼을 주면 눌렀을 때 400 이다.
  if (merged || !items) return null;

  return (
    <span className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label={`${requirement.title ?? '요구사항'} 다른 처분`}
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600"
      >
        ⋯
      </button>

      {open && (
        <>
          {/* 바깥을 눌러 닫는다. 메뉴 안에 되돌리기 번거로운 것이 있어서,
              열린 채로 두는 것보다 닫히는 편이 안전하다. */}
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute top-8 right-0 z-20 flex w-40 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {onMerge && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onMerge();
                }}
                className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                중복 병합
              </button>
            )}
            {canHold && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setClosing(HOLD_STATUS);
                }}
                className="px-3 py-1.5 text-left text-sm text-violet-700 hover:bg-violet-50"
              >
                보류
              </button>
            )}
            {canReject && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setClosing(REJECTED_STATUS);
                }}
                className="px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                반려
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setClosing(CANCELLED_STATUS);
                }}
                className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                요청 취소
              </button>
            )}
          </div>
        </>
      )}

      <CloseReasonDialog
        status={closing}
        onSubmit={(reason) => onClose(requirement, closing, reason)}
        onClose={() => setClosing(null)}
      />
    </span>
  );
}
