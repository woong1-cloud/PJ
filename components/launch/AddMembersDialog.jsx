'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { memberCandidates } from '@/lib/launchMembers';

// 한 역할에 여럿을 한 번에 넣는다.
//
// 스펙: docs/superpowers/specs/2026-09-07-launch-members-step1-design.md
//
// 한 명씩 넣게 하면 15명이 15번이다. 역할 줄에서 체크로 골라 한 번에
// 보내면 5~6번으로 끝난다 — 초대제를 유지하면서 클릭을 줄이는 방법이다.
//
// props: open, roleName, launchName, taskCount, people, members,
//        onClose, onSubmit({ memberIds, canEdit })
export function AddMembersDialog({
  open, roleName, launchName, taskCount = 0, people = [], members = [], onClose, onSubmit,
}) {
  const [picked, setPicked] = useState(() => new Set());
  const [canEdit, setCanEdit] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function submit(event) {
    event.preventDefault();
    if (picked.size === 0) {
      setError('넣을 사람을 고르세요.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ memberIds: [...picked], canEdit });
    } catch (err) {
      setError(err?.message ?? '넣지 못했습니다.');
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{roleName} 에 넣기</DialogTitle>
          <DialogDescription>
            {launchName} · 활성 팀원만 보입니다
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              넣을 수 있는 사람이 없습니다 — 이 역할에 이미 다 들어와 있습니다.
            </p>
          ) : (
            // 두 줄로 세운다. 19명이 한 줄이면 창이 길어져 아래 단추가
            // 화면 밖으로 나간다.
            <div className="grid max-h-56 grid-cols-1 gap-x-3 gap-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {candidates.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50"
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
          )}

          {/* 라디오다. 체크박스로 두면 안 눌렀을 때 무엇이 되는지가 안 보인다. */}
          <fieldset className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="can-edit"
                checked={canEdit}
                onChange={() => setCanEdit(true)}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-indigo-600"
              />
              <span>
                <b className="font-medium text-slate-800">참여자</b>
                <span className="ml-1.5 text-xs text-slate-500">
                  자기 항목의 상태를 바꾸고 내용을 고칩니다
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="can-edit"
                checked={!canEdit}
                onChange={() => setCanEdit(false)}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-indigo-600"
              />
              <span>
                <b className="font-medium text-slate-800">참관</b>
                <span className="ml-1.5 text-xs text-slate-500">
                  보기만 합니다 — 주간 진척·간트·결정 대기
                </span>
              </span>
            </label>
          </fieldset>

          {/* 넣는 것이 유일한 통제 지점이라 여기서 한 번 멈추게 한다.
              1단계에는 권한이 아직 안 열려 실제로는 못 보지만, 이 문구를
              나중에 붙이면 이미 20명이 들어간 뒤가 된다. */}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
            권한이 열리면 이 사람들은 <b className="tabular-nums">{taskCount}건</b> 전부를 보게
            됩니다 — 법인 설립 · 양수도 계약 · 계약 조건 비교가 포함됩니다.
            엑셀 내보내기는 안 됩니다.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              그만두기
            </Button>
            <Button
              type="submit"
              disabled={saving || candidates.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? '넣는 중...' : picked.size > 0 ? `${picked.size}명 넣기` : '넣기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
