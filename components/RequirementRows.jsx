'use client';

import Link from 'next/link';
import { StatusDot } from '@/components/ui/StatusDot';
import { RequirementEmpty } from '@/components/RequirementEmpty';
import { listRow } from '@/lib/listRow';
import { RowDispositionMenu } from '@/components/RowDispositionMenu';

// 목록(행) 뷰.
//
// 표를 대신하는 것이 아니라 나란히 두는 것이다. 표는 비교하려는 사람의 것이고
// 이쪽은 훑으려는 사람의 것이다.
//
// 한 줄 40px 을 지킨다. 두 줄이 되면 세로 리듬이 깨져 훑기가 느려지고, 47건이
// 한 화면에 안 들어온다.
//
// props: requirements, filtered, onCreate, identity, onClose, onMerge
//
// onClose·onMerge 가 없으면 '⋯' 이 안 그려진다. 이 뷰가 기본 화면인데
// 오랫동안 제목 링크 말고 아무 행동도 없었다 — 보류·반려는 전부 상세로
// 들어가야 했다.
export function RequirementRows({
  requirements = [],
  filtered = false,
  onCreate,
  identity,
  onClose,
  onMerge,
}) {
  if (requirements.length === 0) {
    return <RequirementEmpty filtered={filtered} onCreate={onCreate} />;
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      {requirements.map((r) => {
        // 정체와 종결 사유는 목록 API 가 계산해 실어 보낸다. 화면이 다시
        // 계산하면 두 숫자가 갈릴 자리가 하나 더 생긴다.
        const row = listRow({
          requirement: r,
          stalledDays: r.stalledDays,
          closure: r.closure,
          awaiting: r.awaiting,
        });
        const bar =
          row.flag === 'stall'
            ? 'border-l-rose-400'
            : row.flag === 'unassigned'
              ? 'border-l-amber-400'
              : 'border-l-transparent';
        return (
          <li
            key={r.id}
            className={`flex items-center border-b border-l-2 border-b-slate-100 pr-1.5 ${bar} last:border-b-0`}
          >
            {/* '⋯' 은 Link 밖이다. 앵커 안에 버튼을 넣으면 누를 때마다 상세로
                따라 들어간다. */}
            <Link
              href={`/requirements/${r.id}`}
              className="flex min-h-10 min-w-0 flex-1 items-center gap-3 py-1.5 pr-2 pl-2.5 hover:bg-slate-50"
            >
              <span className="w-20 shrink-0">
                <StatusDot status={r.status} tone={row.tone} />
              </span>
              {row.channelBadge && (
                <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">
                  {row.channelBadge}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{r.title}</span>
              {/* 메타는 좁은 화면에서 감춘다. 폰에서는 제목과 상태가 먼저다. */}
              <span className="hidden shrink-0 text-[11.5px] text-slate-400 lg:block">
                {row.meta.join(' · ')}
                {row.elapsed && (
                  <span className={row.flag === 'stall' ? 'text-rose-600' : ''}>
                    {row.meta.length > 0 ? ' · ' : ''}
                    {row.elapsed}
                  </span>
                )}
                {row.tail && <span className="text-slate-500"> · {row.tail}</span>}
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] ${
                  row.assignee
                    ? 'bg-slate-200 text-slate-600'
                    : 'border border-dashed border-slate-300 text-slate-300'
                }`}
                title={row.assignee?.name ?? '담당자 없음'}
              >
                {row.assignee?.initial ?? '＋'}
              </span>
            </Link>
            {onClose && (
              <RowDispositionMenu
                requirement={r}
                identity={identity}
                onClose={onClose}
                onMerge={onMerge ? () => onMerge(r) : undefined}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
