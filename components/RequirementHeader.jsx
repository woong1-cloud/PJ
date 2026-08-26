'use client';

import { StatusDot } from '@/components/ui/StatusDot';
import { StatusStrip } from '@/components/StatusStrip';
import { HelpHint } from '@/components/HelpHint';

// 제목 · 뱃지 · 머리 줄 · 진행 스트립.
//
// 머리 줄 한 줄이 이 화면의 요점이다. 지금은 "이 건이 20일째 멈췄고 담당자가
// 없다"는 사실이 오른쪽 열의 회색 드롭다운 셋으로만 표시된다.
//
// props:
//   requirement, head(lib/headline 결과), durations
//   counts — { attachments, comments }
//   projectName, typeLabel, onEditType
//   actions — 데스크톱 오른쪽 끝과 모바일 아래에 같은 것이 들어간다
//   actionsCompact — 모바일용(주 버튼 전폭)
export function RequirementHeader({
  requirement: r,
  head,
  durations,
  counts,
  projectName,
  typeLabel,
  onEditType,
  actions,
  actionsCompact,
}) {
  const meta = [head.elapsed, head.assigneeText].filter(Boolean);
  if (counts?.attachments) meta.push(`첨부 ${counts.attachments}`);
  if (counts?.comments) meta.push(`대화 ${counts.comments}`);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {projectName && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            {projectName}
          </span>
        )}
        {/* 점선은 '누를 수 있다'는 뜻이다. 유형은 요청자도 바꾼다 —
            프로젝트는 3차 이상만 바꾸므로 오른쪽 열에 있다. 가르는 규칙은
            누가 바꾸는가다. */}
        <button
          type="button"
          onClick={onEditType}
          className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          {typeLabel ?? '유형 정하기'}
        </button>
      </div>

      <h1 className="text-lg font-semibold text-slate-900">{r.title}</h1>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusDot status={r.status} tone={head.tone} />
        <HelpHint anchor="status" label="상태" />
        {head.badges.map((badge) => (
          <span key={badge} className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">
            {badge}
          </span>
        ))}
        <span className={`text-sm ${head.tone === 'stall' ? 'text-rose-700' : 'text-slate-500'}`}>
          {meta.join(' · ')}
        </span>
        <div className="ml-auto hidden md:block">{actions}</div>
      </div>

      {/* 모바일에서는 주 버튼이 가로 전체다. 손가락 대상이라 h-10 이고,
          지금 승인 버튼이 h-11 인 것과 같은 이유다. */}
      <div className="md:hidden">{actionsCompact}</div>

      <StatusStrip durations={durations} current={r.status} />
    </div>
  );
}
