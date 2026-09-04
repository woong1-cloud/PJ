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

// 서버가 자르는 자리(app/api/launch/[id]/route.js PATCH)와 맞춘다. 여기서
// 미리 막아야 "40줄 적었는데 왜 안 남았지"가 안 생긴다.
const MAX_ROWS = 40;

function init(context) {
  const list = context ?? [];
  return list.length > 0
    ? list.map((c) => ({ label: c.label ?? '', value: c.value ?? '' }))
    : [{ label: '', value: '' }];
}

// 전제를 손으로 고친다.
//
// 엑셀은 초안일 뿐이다 — 회의 중에 바뀐 것, 시트가 못 담은 것을 사람이
// 직접 적을 자리가 있어야 한다. 라벨 하나 값 하나뿐이라 다른 항목 창처럼
// 워크스트림·코드 같은 것을 안 받는다.
//
// 라벨은 브랜드마다 달라서 정해진 목록이 없다 — 자유 입력이다.
//
// props: open, launchId, context [{label, value}], onClose, onSaved(launch)
export function LaunchContextDialog({ open, launchId, context = [], onClose, onSaved }) {
  const [rows, setRows] = useState(() => init(context));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function close() {
    onClose();
    setRows(init(context));
    setError('');
  }

  function set(i, key, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    if (error) setError('');
  }

  function remove(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function add() {
    setRows((prev) => (prev.length >= MAX_ROWS ? prev : [...prev, { label: '', value: '' }]));
  }

  async function submit(event) {
    event.preventDefault();
    // 빈 라벨·빈 값은 서버도 버린다(app/api/launch/[id]/route.js). 여기서도
    // 걸러야 저장 뒤 화면에 남는 줄과 사람이 채운 줄이 어긋나지 않는다.
    const cleaned = rows
      .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
      .filter((r) => r.label && r.value);
    if (cleaned.length === 0) {
      setError('한 줄은 있어야 저장됩니다.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/launch/${launchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: cleaned }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '저장하지 못했습니다.');
      return;
    }
    const body = await res.json();
    onSaved?.(body.launch);
    close();
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>전제 고치기</DialogTitle>
          <DialogDescription>
            00_개요 의 [제반사항] 줄입니다.{' '}
            <b>엑셀을 다시 올리면 시트의 전제로 덮어씁니다</b> — 여기서 고쳐도 다음 가져오기가
            지웁니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                value={r.label}
                onChange={(e) => set(i, 'label', e.target.value)}
                placeholder="라벨 (예: 개발 주체)"
                aria-label="라벨"
                className={`${input} w-32 shrink-0 sm:w-40`}
              />
              <input
                value={r.value}
                onChange={(e) => set(i, 'value', e.target.value)}
                placeholder="값"
                aria-label="값"
                className={`${input} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-rose-600"
              >
                삭제
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={add}
            disabled={rows.length >= MAX_ROWS}
            className="self-start text-xs text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            ＋ 줄 추가
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              그만두기
            </Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const input =
  'h-9 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-indigo-400 focus:outline-none';
