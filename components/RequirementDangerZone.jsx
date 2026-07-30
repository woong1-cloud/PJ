'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DELETE_CONFIRM_WORD, isDeleteConfirmed, deletionSummary } from '@/lib/deleteRequirement';

// 영구 삭제 영역.
//
// 상세 화면 맨 아래에만 둔다. 목록이나 보드 카드에 붙이면 다른 버튼을 누르려다
// 스치는 일이 생긴다 — 되돌릴 수 없는 동작에는 "여기까지 내려와서, 접힌 걸
// 펴고, 사유를 쓰고, 단어를 입력한다"는 네 단계를 요구한다.
//
// props: requirementId, summary({historyCount, commentCount, imageCount, mergedCount})
export function RequirementDangerZone({ requirementId, summary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const s = deletionSummary(summary);
  const ready = reason.trim() && isDeleteConfirmed(confirmText);

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '삭제에 실패했습니다.');
      // 지운 화면에 그대로 머무르면 다음 새로고침에 404 만 나온다.
      router.push('/requirements');
      router.refresh();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          이 요구사항 영구 삭제
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 break-keep">
      <h2 className="mb-2 text-sm font-medium text-red-700">영구 삭제</h2>
      <div className="mb-3 flex flex-col gap-1 text-xs text-red-800">
        <p>
          되돌릴 수 없습니다. 잘못 등록됐거나 테스트로 만든 건에만 쓰세요. 하지 않기로
          한 요청이라면 <b>반려</b>나 <b>취소</b>가 기록이 남아 더 낫습니다.
        </p>
        <p>
          함께 사라집니다 — 변경 이력 {s.historyCount}건, 코멘트 {s.commentCount}건, 첨부
          이미지 {s.imageCount}건, 하위 작업 전체.
        </p>
        {s.hasMergedSources && (
          <p className="font-medium">
            이 요청에 병합된 요청 {s.mergedCount}건의 병합 기록도 지워집니다. 그 건들은
            &lsquo;중복&rsquo; 상태로 남지만 어디에 병합됐는지는 알 수 없게 됩니다.
          </p>
        )}
        <p>제목·브랜드·요청자·삭제 사유는 삭제 기록으로 따로 남습니다.</p>
      </div>

      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="삭제 사유 (예: 같은 내용 중복 등록)"
          maxLength={200}
          className="h-9 rounded-lg border border-red-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
        />
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`확인을 위해 "${DELETE_CONFIRM_WORD}" 를 입력하세요`}
          className="h-9 rounded-lg border border-red-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || !ready}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm text-white hover:bg-red-700 disabled:opacity-40"
          >
            {submitting ? '삭제 중...' : '영구 삭제'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setReason('');
              setConfirmText('');
              setError('');
            }}
            className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-600 hover:bg-slate-50"
          >
            그만두기
          </button>
        </div>
      </form>
    </section>
  );
}
