'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { STATUS_META } from '@/lib/statusMeta';
import { menuTransitions } from '@/lib/statusActions';
import { MERGED_STATUS, REJECTED_STATUS, CANCELLED_STATUS } from '@/lib/statuses';
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
//   compact — 모바일. 주 버튼을 가로 전체로
export function RequirementStatusActions({
  status,
  identity,
  action,
  onPrimary,
  onTransition,
  onClose,
  onMerge,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(null); // null | '반려' | '취소'
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const primary = STATUS_META[status]?.primary ?? null;
  const transitions = menuTransitions({ status, identity });
  const merged = status === MERGED_STATUS;
  // 취소는 요청한 쪽이 거두는 것이라 4차도 한다. 반려는 IT 의 결정이라 3차
  // 이상이다. 그래서 취소는 메뉴 밖에 남기고 반려만 안으로 넣는다 —
  // 요청자에게는 취소가 이 화면에서 할 수 있는 유일한 행동이고, 메뉴에
  // 숨기면 길이 사라진다.
  const canReject = canProcess(identity) && !merged;
  const showMenu = !merged && (transitions.length > 0 || canReject || Boolean(onMerge));

  async function submitClose(event) {
    event.preventDefault();
    if (!reason.trim()) {
      setError('사유를 입력해 주세요.');
      return;
    }
    setSaving(true);
    const ok = await onClose(closing, reason.trim());
    setSaving(false);
    if (ok) {
      setClosing(null);
      setReason('');
      setError('');
    } else {
      setError('종결하지 못했습니다.');
    }
  }

  // 사유를 받는 동안에는 다른 버튼을 감춘다. 종결은 되돌리기 번거로운
  // 행동이라, 사유를 쓰다가 옆의 상태 버튼을 눌러 버리면 안 된다.
  if (closing) {
    return (
      <form onSubmit={submitClose} className="flex w-full flex-col gap-2">
        <label htmlFor="close-reason" className="text-xs text-slate-500">
          {closing} 사유
        </label>
        <textarea
          id="close-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="한 달 뒤에 읽어도 알 수 있게 적어 주세요."
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            {saving ? '처리 중...' : `${closing} 확정`}
          </Button>
          <Button type="button" variant="outline" onClick={() => setClosing(null)}>
            그만두기
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={`relative flex gap-1.5 ${compact ? 'w-full' : ''}`}>
      {action?.kind === 'primary' && primary && (
        <Button
          type="button"
          onClick={onPrimary}
          className={`${compact ? 'h-10 flex-1' : 'h-8'} ${
            primary.via === 'approve'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {primary.label}
        </Button>
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

      {showMenu && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="다른 상태로"
            aria-expanded={open}
            className={`${compact ? 'h-10' : 'h-8'} rounded border border-slate-300 px-2 text-sm text-slate-500 hover:bg-slate-50`}
          >
            ···
          </button>
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
                {canReject && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setClosing(REJECTED_STATUS);
                    }}
                    className="mt-1 border-t border-slate-100 px-3 py-1.5 pt-2 text-left text-sm text-rose-600 hover:bg-rose-50"
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
