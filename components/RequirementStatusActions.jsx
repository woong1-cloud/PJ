'use client';

import { useState } from 'react';
import { CloseReasonDialog } from '@/components/CloseReasonDialog';
import { STATUS_META } from '@/lib/statusMeta';
import { menuTransitions } from '@/lib/statusActions';
import { MERGED_STATUS, REJECTED_STATUS, CANCELLED_STATUS, HOLD_STATUS } from '@/lib/statuses';
import { canProcess } from '@/lib/tiers';

// 주 버튼 + '⋯' 메뉴 + 종결 창.
//
// 셀렉트를 없앤 이유: 그 목록에 성격이 다른 셋이 섞여 있었다. 즉시 반영되는
// 것, 창이 뜨는 것(착수·승인), 서버가 거부하는 것(완료). 고를 수 있어 보이는데
// 다른 일이 일어난다.
//
// props:
//   status, identity
//   action — lib/headline.js 가 정한 { kind: 'primary'|'cancel' } | null
//   onPrimary() — via 에 따라 부르는 쪽이 분기한다
//   onTransition(status) — 메뉴에서 고른 상태로
//   onClose(status, reason) => Promise<boolean>
//   onMerge — 중복 병합 창. 지금 상세 화면에는 그 기능이 없어 넘기지 않는다.
//     목록·보드에만 있다. 나중에 상세에도 붙이면 여기로 넘기면 된다.
//   onEdit — '수정'. 예전에는 화면에 한 줄을 통째로 차지하는 링크였다.
//   compact — 모바일. 주 버튼을 가로 전체로
export function RequirementStatusActions({
  status,
  identity,
  action,
  onPrimary,
  onTransition,
  onClose,
  onMerge,
  onEdit,
  onAsk,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  // 사유를 받을 상태. null | '보류' | '반려' | '취소'
  //
  // 예전에는 이 자리에 인라인 폼이 떴다. 그 자리가 상세 사이드바라 폭이
  // 200px 남짓인데, 사유는 두 줄짜리 예시를 보여줘야 쓸 수 있는 칸이라
  // 플레이스홀더가 통째로 안 보였다. 창으로 뺀다(CloseReasonDialog).
  const [closing, setClosing] = useState(null);

  const primary = STATUS_META[status]?.primary ?? null;
  const transitions = menuTransitions({ status, identity });
  const merged = status === MERGED_STATUS;
  // 취소는 요청한 쪽이 거두는 것이라 4차도 한다. 반려는 IT 의 결정이라 3차
  // 이상이다. 그래서 취소는 메뉴 밖에 남기고 반려만 안으로 넣는다 —
  // 요청자에게는 취소가 이 화면에서 할 수 있는 유일한 행동이고, 메뉴에
  // 숨기면 길이 사라진다.
  const canReject = canProcess(identity) && !merged;
  // 보류도 IT 의 판단이라 같은 문턱이다. 반려 바로 위에 둔다 — 반려하려던
  // 사람이 "이건 안 하는 게 아니라 지금 못 하는 것"임을 그 자리에서 고를 수
  // 있어야 한다. 그게 이 상태를 만든 이유다.
  // 이미 보류인 건에는 보류를 안 보여준다. 눌러도 같은 상태로 가고, 사유만
  // 덮어써진다.
  const canHold = canReject && status !== HOLD_STATUS;
  const showMenu =
    !merged &&
    (transitions.length > 0 ||
      canReject ||
      canHold ||
      Boolean(onAsk) ||
      Boolean(onMerge) ||
      Boolean(onEdit));

  const hasPrimary = action?.kind === 'primary' && primary;
  const tall = compact ? 'h-10' : 'h-8';
  // 주 버튼과 여는 손잡이를 붙여 하나로 보이게 한다.
  //
  // 예전에는 '···' 이 따로 떨어져 있었다. 그 기호는 관례적으로 '기타'를
  // 뜻해서, 상태 변경이 그 안에 있으리라 짐작할 근거가 화면에 없었다.
  // 주 버튼에 붙은 '▾' 는 "이 행동의 다른 선택지"로 읽힌다.
  const primaryTone =
    primary?.via === 'approve'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <div className={`relative flex gap-1.5 ${compact ? 'w-full' : ''}`}>
      {hasPrimary && (
        <div className={`flex ${compact ? 'flex-1' : ''}`}>
          <button
            type="button"
            onClick={onPrimary}
            className={`${tall} ${primaryTone} ${showMenu ? 'rounded-l-md' : 'rounded-md'} ${
              compact ? 'flex-1' : ''
            } px-3 text-sm font-medium text-white`}
          >
            {primary.label}
          </button>
          {showMenu && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="다른 선택지"
              aria-expanded={open}
              className={`${tall} ${primaryTone} rounded-r-md border-l border-white/30 px-2 text-sm text-white`}
            >
              ▾
            </button>
          )}
        </div>
      )}

      {action?.kind === 'cancel' && (
        <button
          type="button"
          onClick={() => setClosing(CANCELLED_STATUS)}
          className={`rounded px-2 text-xs text-rose-600 hover:bg-rose-50 ${compact ? 'h-10 flex-1' : 'h-8'}`}
        >
          요청 취소
        </button>
      )}

      {/* 주 버튼이 없는 사람에게는(요청자 등) 손잡이만 따로 둔다. */}
      {showMenu && !hasPrimary && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="다른 선택지"
          aria-expanded={open}
          className={`${tall} rounded border border-slate-300 px-2 text-sm text-slate-500 hover:bg-slate-50`}
        >
          ▾
        </button>
      )}

      <CloseReasonDialog
        status={closing}
        onSubmit={(reason) => onClose(closing, reason)}
        onClose={() => setClosing(null)}
      />

      {showMenu && (
        <>
          {open && (
            <>
              {/* 바깥을 눌러 닫는다. 메뉴 안에 되돌리기 어려운 것(반려)이
                  있어서, 열린 채로 두는 것보다 닫히는 편이 안전하다. */}
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 top-10 z-20 flex w-48 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {transitions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onTransition(s);
                    }}
                    className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {s}(으)로
                  </button>
                ))}
                {/* 요건 확인이 메뉴 맨 위다. 회의에서 가장 자주 나오는 결론이
                    "이게 뭔 얘기인지 확인이 필요하다"인데, 지금은 그걸 하려면
                    코멘트로 내려가 @멘션을 쳐야 했다. */}
                {onAsk && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onAsk();
                    }}
                    className="px-3 py-1.5 text-left text-sm text-sky-700 hover:bg-sky-50"
                  >
                    요건 확인 요청
                  </button>
                )}
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
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onEdit();
                    }}
                    className="mt-1 border-t border-slate-100 px-3 py-1.5 pt-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    내용 수정
                  </button>
                )}
                {canHold && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setClosing(HOLD_STATUS);
                    }}
                    className="mt-1 border-t border-slate-100 px-3 py-1.5 pt-2 text-left text-sm text-violet-700 hover:bg-violet-50"
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
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
