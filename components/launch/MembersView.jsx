'use client';

import { useMemo, useState } from 'react';
import { memberRows } from '@/lib/launchMembers';
import { AddMembersDialog } from '@/components/launch/AddMembersDialog';

// 참여자 명단 — 역할별로 누가 있고 몇 건을 맡나.
//
// 스펙: docs/superpowers/specs/2026-09-07-launch-members-step1-design.md
//
// 1단계라 권한은 안 연다. 참여자는 아직 이 화면을 못 본다 — 전체 관리자가
// 명단을 만드는 화면이다.
//
// 맨 오른쪽 '담당자' 칸이 이 화면의 요점이다. "역할은 정했는데 아직 아무도
// 안 집은 것"을 드러낸다 — 2026-09-07 기준 501건 중 0건이다.
//
// props: launch, tasks, members, people, busy, onAdd, onRemove, onToggleEdit
export function MembersView({
  launch, tasks = [], members = [], people = [], busy = false,
  onAdd, onRemove, onToggleEdit,
}) {
  const [addFor, setAddFor] = useState(null);
  const rows = useMemo(() => memberRows({ tasks, members }), [tasks, members]);
  const total = members.length;
  const heads = useMemo(() => new Set(members.map((m) => m.member_id)).size, [members]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-600">
          {heads === 0 ? (
            '아직 아무도 없습니다.'
          ) : (
            <>
              <b className="text-slate-800">{heads}명</b>
              {total > heads && <span className="text-slate-400"> · 역할 {total}자리</span>}
            </>
          )}
        </p>
        {/* 권한이 아직 안 열렸다는 사실을 화면이 말해야 한다. 안 그러면
            "넣었는데 왜 못 들어오지"가 된다. */}
        <span className="rounded-md bg-amber-50 px-2 py-1 text-[11.5px] text-amber-800">
          지금은 명단만 만듭니다 — 참여자는 아직 런칭을 볼 수 없습니다
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11.5px] text-slate-500">
          <span className="w-40 shrink-0">역할</span>
          <span className="flex-1">사람</span>
          <span className="w-12 shrink-0 text-right">주관</span>
          <span className="w-12 shrink-0 text-right">지원</span>
          <span className="w-14 shrink-0 text-right">담당자</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            항목이 없어 역할을 뽑을 수 없습니다. 엑셀을 먼저 가져오세요.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.role}
              className="flex flex-wrap items-start gap-x-3 gap-y-1.5 border-b border-slate-100 px-4 py-2.5 last:border-b-0"
            >
              <span className="w-40 shrink-0 pt-1 text-[13px] font-medium text-slate-800">
                {row.role}
              </span>

              <div className="flex min-w-[12rem] flex-1 flex-wrap items-center gap-1.5">
                {row.members.length === 0 ? (
                  <span className="text-xs text-slate-400">아직 없습니다</span>
                ) : (
                  row.members.map((m) => (
                    <span
                      key={`${m.member_id}-${m.role_name}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2.5 pr-1 text-xs ${
                        m.can_edit === false
                          ? 'border-slate-200 bg-slate-50 text-slate-500'
                          : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {m.member?.name ?? '(지워진 사람)'}
                      {/* 참여/참관을 글자로 늘 보여주고, 그 글자가 곧
                          바꾸는 단추다. 색이나 아이콘으로 하면 무슨 뜻인지
                          알 수 없고, 마우스를 올려야 나오게 하면 있는 줄도
                          모른다. */}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onToggleEdit?.(m, m.can_edit === false)}
                        title={m.can_edit === false ? '참여자로 바꾸기' : '참관으로 바꾸기'}
                        className="rounded px-1 text-[10px] opacity-70 hover:bg-white/70 hover:underline hover:opacity-100 disabled:opacity-40"
                      >
                        {m.can_edit === false ? '참관' : '참여'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRemove?.(m)}
                        aria-label={`${m.member?.name ?? ''} 빼기`}
                        className="px-0.5 leading-none opacity-60 hover:opacity-100 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAddFor(row.role)}
                  className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-40"
                >
                  ＋
                </button>
              </div>

              <span className="w-12 shrink-0 pt-1 text-right text-xs tabular-nums text-slate-600">
                {row.ownerCount || <span className="text-slate-300">0</span>}
              </span>
              <span className="w-12 shrink-0 pt-1 text-right text-xs tabular-nums text-slate-400">
                {row.supportCount || <span className="text-slate-300">0</span>}
              </span>
              {/* 0 을 회색으로 죽이지 않는다 — 이 칸의 0 이 곧 "아직 아무도
                  안 집었다"는 말이고, 그게 이 화면을 보는 이유다. */}
              <span
                className={`w-14 shrink-0 pt-1 text-right text-xs tabular-nums ${
                  row.ownerCount === 0
                    ? 'text-slate-300'
                    : row.assignedCount === 0
                      ? 'text-amber-600'
                      : 'text-slate-600'
                }`}
              >
                {row.ownerCount === 0 ? '—' : `${row.assignedCount}/${row.ownerCount}`}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 조건부로 그린다. 닫혀도 그리면 useState 초기화가 다시 안 돌아
          지난 역할의 고른 값이 남는다 — 이 병이 네 창에 있었다. */}
      {addFor && (
        <AddMembersDialog
          open
          roleName={addFor}
          launchName={launch?.name}
          taskCount={tasks.filter((t) => t.status !== '해당없음').length}
          people={people}
          members={members}
          onClose={() => setAddFor(null)}
          onSubmit={async (payload) => {
            await onAdd?.({ roleName: addFor, ...payload });
            setAddFor(null);
          }}
        />
      )}
    </div>
  );
}
