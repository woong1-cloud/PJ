'use client';

import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { memberCandidates, memberRows } from '@/lib/launchMembers';

// 참여자 명단 — 역할별로 누가 있고 몇 건을 맡나.
//
// 스펙: docs/superpowers/specs/2026-09-07-launch-members-step1-design.md
//
// 탭이 아니라 창이다. 탭 줄의 넷(보드·결정 대기·주간 진척·간트)은 전부
// 같은 471건을 다르게 비추는 렌즈인데, 명단은 471건을 비추지 않는다 —
// 이 런칭의 설정이다. 그래서 제목 줄(전제·내보내기·⋯)과 한 편이다.
//
// 넣기를 또 창으로 띄우지 않는다. 창 안의 창은 겹침이 까다롭고, 무엇보다
// 뒤의 역할 줄이 가려져 어디에 넣는 중인지를 놓친다. 줄이 그 자리에서
// 펼쳐진다.
//
// 참관(can_edit 거짓)은 안 만든다. 런칭에 들어오는 사람은 대개 일을 할
// 사람이고, 경영자는 보고로 받는다 — 보고 화면은 따로 고민한다. 고를 것이
// 하나면 물을 이유가 없다.
//
// can_edit 컬럼은 남겨 둔다. 화면에 남기면 거짓말이 되지만(참관으로 넣었는데
// 고칠 수 있으면), 컬럼을 지우면 되돌리기 어렵고 나중에 보고 메뉴를 만들
// 때 다시 쓸 자리다. 값은 전부 참으로 들어간다.
//
// props: open, launch, tasks, members, people, busy, onClose, onAdd, onRemove
export function MembersDialog({
  open, launch, tasks = [], members = [], people = [], busy = false,
  onClose, onAdd, onRemove,
}) {
  const [openRole, setOpenRole] = useState(null);
  const rows = useMemo(() => memberRows({ tasks, members }), [tasks, members]);
  const heads = useMemo(() => new Set(members.map((m) => m.member_id)).size, [members]);
  const seats = members.length;
  const taskCount = useMemo(() => tasks.filter((t) => t.status !== '해당없음').length, [tasks]);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>참여자</DialogTitle>
          <DialogDescription>
            {launch?.name}
            {heads > 0 && ` · ${heads}명`}
            {seats > heads && ` · 역할 ${seats}자리`}
          </DialogDescription>
        </DialogHeader>

        {/* 권한이 아직 안 열렸다는 사실을 화면이 말해야 한다. 안 그러면
            "넣었는데 왜 못 들어오지"가 된다. */}
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          지금은 명단만 만듭니다 — 참여자는 아직 런칭을 볼 수 없습니다.
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
            <span className="w-32 shrink-0">역할</span>
            <span className="flex-1">사람</span>
            <span className="w-10 shrink-0 text-right">주관</span>
            <span className="w-10 shrink-0 text-right">지원</span>
            <span className="w-14 shrink-0 text-right">담당자</span>
          </div>

          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              항목이 없어 역할을 뽑을 수 없습니다. 엑셀을 먼저 가져오세요.
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.role} className="border-b border-slate-100 last:border-b-0">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-3 py-2">
                  <span className="w-32 shrink-0 pt-1 text-[13px] font-medium text-slate-800">
                    {row.role}
                  </span>

                  <div className="flex min-w-[10rem] flex-1 flex-wrap items-center gap-1.5">
                    {row.members.length === 0 ? (
                      <span className="text-xs text-slate-400">아직 없습니다</span>
                    ) : (
                      row.members.map((m) => (
                        <span
                          key={`${m.member_id}-${m.role_name}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 py-0.5 pl-2.5 pr-1 text-xs text-indigo-700"
                        >
                          {m.member?.name ?? '(지워진 사람)'}
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
                      onClick={() => setOpenRole((prev) => (prev === row.role ? null : row.role))}
                      aria-expanded={openRole === row.role}
                      className={`rounded-full border border-dashed px-2.5 py-0.5 text-xs disabled:opacity-40 ${
                        openRole === row.role
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-700'
                      }`}
                    >
                      {openRole === row.role ? '닫기' : '＋'}
                    </button>
                  </div>

                  <span className="w-10 shrink-0 pt-1 text-right text-xs tabular-nums text-slate-600">
                    {row.ownerCount || <span className="text-slate-300">0</span>}
                  </span>
                  <span className="w-10 shrink-0 pt-1 text-right text-xs tabular-nums text-slate-400">
                    {row.supportCount || <span className="text-slate-300">0</span>}
                  </span>
                  {/* 이 칸의 0 이 곧 "아직 아무도 안 집었다"는 말이고,
                      그게 이 화면을 보는 이유다. 회색으로 죽이지 않는다. */}
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

                {openRole === row.role && (
                  <AddRow
                    roleName={row.role}
                    people={people}
                    members={members}
                    taskCount={taskCount}
                    busy={busy}
                    onCancel={() => setOpenRole(null)}
                    onSubmit={async (payload) => {
                      await onAdd?.({ roleName: row.role, ...payload });
                      setOpenRole(null);
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 역할 줄 아래에서 펼쳐지는 넣기 칸.
//
// 한 명씩 넣게 하면 15명이 15번이다. 체크로 골라 한 번에 보내면 5~6번으로
// 끝난다 — 초대제를 유지하면서 클릭을 줄이는 방법이다.
function AddRow({ roleName, people, members, taskCount, busy, onCancel, onSubmit }) {
  const [picked, setPicked] = useState(() => new Set());
  const [error, setError] = useState('');
  const candidates = memberCandidates({ people, members, roleName });

  function toggle(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (error) setError('');
  }

  async function submit() {
    if (picked.size === 0) {
      setError('넣을 사람을 고르세요.');
      return;
    }
    try {
      await onSubmit({ memberIds: [...picked] });
    } catch (err) {
      setError(err?.message ?? '넣지 못했습니다.');
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-3">
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-500">
          넣을 수 있는 사람이 없습니다 — 이 역할에 이미 다 들어와 있습니다.
        </p>
      ) : (
        <>
          {/* 두 줄로 세운다. 19명이 한 줄이면 창이 길어져 아래 단추가
              화면 밖으로 나간다. */}
          <div className="grid max-h-44 grid-cols-1 gap-x-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-3">
            {candidates.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={picked.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-3.5 w-3.5 shrink-0 accent-indigo-600"
                />
                <span className="min-w-0 truncate text-slate-700">{p.name}</span>
                {/* 소속을 옆에 쓴다. 동명이인과 '재무 조직 사람' 찾기를
                    같이 돕는다. */}
                <span className="shrink-0 text-[11px] text-slate-400">
                  {p.organization?.name ?? '소속없음'}
                </span>
              </label>
            ))}
          </div>

          {/* 넣는 것이 유일한 통제 지점이라 여기서 한 번 멈추게 한다.
              1단계에는 권한이 아직 안 열려 실제로는 못 보지만, 이 문구를
              나중에 붙이면 이미 20명이 들어간 뒤가 된다. */}
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            권한이 열리면 <b className="tabular-nums">{taskCount}건</b> 전부를 보게 됩니다 —
            법인 설립 · 양수도 계약 · 계약 조건 비교가 포함됩니다. 엑셀 내보내기는 안 됩니다.
          </p>

          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              그만두기
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? '넣는 중...' : picked.size > 0 ? `${picked.size}명 넣기` : '넣기'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
