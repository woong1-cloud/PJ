'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LAUNCH_KINDS, defaultWorkstreams } from '@/lib/launchKind';
import { dueDate } from '@/lib/launchDate';

// 런칭 만들기.
//
// 묻는 것은 넷이다 — 브랜드명 · 오픈일 · 유형 · 가져올 워크스트림.
// 유형을 고르면 워크스트림이 자동으로 정해진다(기존 법인이면 01·02 가 빠져
// 52건이 안 들어온다). 그래도 목록을 보여주고 손대게 두는 이유는, 유형이
// 딱 안 맞는 건이 반드시 나오기 때문이다.
//
// props: open, onClose, onCreated
export function NewLaunchDialog({ open, onClose, onCreated }) {
  const [guideId, setGuideId] = useState('');
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [kind, setKind] = useState(LAUNCH_KINDS[0]);
  // 고른 워크스트림은 상태로 안 둔다. 유형이 정하는 기본값에 사람이 손댄
  // 것만 얹어 계산한다 — 상태로 두면 유형이 바뀔 때마다 effect 에서 다시
  // 써야 하고, 그것이 곧 cascading render 다.
  const [overrides, setOverrides] = useState(() => new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 가이드와 그 항목을 불러온다. 워크스트림 목록과 건수가 여기서 나온다 —
  // "01_신규법인 27건"처럼 몇 건이 들어오는지 보여야 고르는 판단이 선다.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/launch/guides');
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? '가이드를 불러오지 못했습니다.');
        const first = (body.guides ?? [])[0];
        if (!first) throw new Error('가이드가 아직 없습니다. 먼저 가이드를 만들어 주세요.');

        const detail = await fetch(`/api/launch/guides/${first.id}/items`);
        const db = await detail.json();
        if (!detail.ok) throw new Error(db.error ?? '항목을 불러오지 못했습니다.');

        if (cancelled) return;
        setGuideId(first.id);
        setItems(db.items ?? []);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 워크스트림과 건수.
  const workstreams = useMemo(() => {
    const map = new Map();
    for (const item of items) map.set(item.workstream, (map.get(item.workstream) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [items]);

  // 유형이 정하는 기본값 + 사람이 손댄 것.
  const picked = useMemo(() => {
    const names = workstreams.map(([ws]) => ws);
    const set = new Set(defaultWorkstreams({ kind, workstreams: names }));
    for (const [ws, on] of overrides) {
      if (on) set.add(ws);
      else set.delete(ws);
    }
    return set;
  }, [kind, workstreams, overrides]);

  const total = useMemo(
    () => items.filter((i) => picked.has(i.workstream)).length,
    [items, picked],
  );

  // 가장 이른 항목이 언제부터인지. D-120 이면 오늘 만들어도 이미 지난 것이
  // 백 건일 수 있다 — 만들기 전에 그것을 알고 있어야 한다.
  const firstDue = useMemo(() => {
    const offsets = items.filter((i) => picked.has(i.workstream)).map((i) => i.day_offset);
    if (offsets.length === 0 || !openDate) return null;
    return dueDate(openDate, Math.min(...offsets));
  }, [items, picked, openDate]);

  function toggle(ws) {
    const next = !picked.has(ws);
    setOverrides((prev) => new Map(prev).set(ws, next));
  }

  // 유형을 다시 고른 것은 "처음부터 다시"라는 뜻이다. 손댄 것을 버린다 —
  // 남겨 두면 01 을 뺐다 넣었다 한 흔적이 다음 유형에 따라붙는다.
  function pickKind(next) {
    setKind(next);
    setOverrides(new Map());
  }

  function close() {
    onClose();
    setName('');
    setOpenDate('');
    setKind(LAUNCH_KINDS[0]);
    setOverrides(new Map());
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('브랜드명을 입력하세요.');
      return;
    }
    if (!openDate) {
      setError('오픈일을 골라 주세요.');
      return;
    }
    if (picked.size === 0) {
      setError('가져올 워크스트림을 하나 이상 고르세요.');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        openDate,
        kind,
        guideId,
        workstreams: [...picked],
      }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '만들지 못했습니다.');
      return;
    }
    const body = await res.json();
    onCreated?.(body.launch);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>런칭 만들기</DialogTitle>
          <DialogDescription>
            가이드에서 항목을 <b>복사해</b> 시작합니다. 만든 뒤에 가이드를 고쳐도 이 런칭은 안
            바뀝니다.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-slate-500">가이드를 읽는 중...</p>}

        {!loading && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="nl-name" className="text-[11.5px] text-slate-500">
                  브랜드명<span className="ml-0.5 text-rose-500">*</span>
                </label>
                <input
                  id="nl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  placeholder="예: 어반드로우"
                  className={input}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="nl-date" className="text-[11.5px] text-slate-500">
                  오픈일<span className="ml-0.5 text-rose-500">*</span>
                </label>
                <input
                  id="nl-date"
                  type="date"
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                  className={input}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-slate-500">유형</span>
              <div className="flex flex-wrap gap-2">
                {LAUNCH_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pickKind(k)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      kind === k
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                유형에 따라 필요 없는 워크스트림이 빠집니다. 아래에서 손댈 수 있습니다.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[11.5px] text-slate-500">가져올 워크스트림</span>
                <span className="text-xs tabular-nums text-slate-400">
                  {picked.size}/{workstreams.length} · {total}건
                </span>
              </div>
              <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {workstreams.map(([ws, count]) => (
                  <label
                    key={ws}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(ws)}
                      onChange={() => toggle(ws)}
                      className="h-4 w-4"
                    />
                    <span className="min-w-0 flex-1 truncate">{ws}</span>
                    <span className="text-xs tabular-nums text-slate-400">{count}</span>
                  </label>
                ))}
                {workstreams.length === 0 && (
                  <p className="p-2 text-sm text-slate-500">
                    가이드가 비어 있습니다. 가이드에서 엑셀을 먼저 가져오세요.
                  </p>
                )}
              </div>
              {firstDue && (
                <p className="text-xs text-slate-500">
                  가장 이른 항목의 기한은 <b className="tabular-nums">{firstDue}</b> 입니다.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                그만두기
              </Button>
              <Button
                type="submit"
                disabled={saving || workstreams.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? `${total}건 복사 중...` : `${total}건으로 시작`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const input =
  'h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm focus:border-indigo-400 focus:outline-none';
