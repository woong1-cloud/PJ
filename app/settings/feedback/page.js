'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { Button } from '@/components/ui/button';
import {
  ACKED_FEEDBACK_STATUS,
  NEW_FEEDBACK_STATUS,
  RESOLVED_FEEDBACK_STATUS,
  validateStatusChange,
} from '@/lib/feedback';

const STATUS_STYLE = {
  [NEW_FEEDBACK_STATUS]: 'bg-amber-50 text-amber-700',
  [ACKED_FEEDBACK_STATUS]: 'bg-slate-100 text-slate-600',
  [RESOLVED_FEEDBACK_STATUS]: 'bg-emerald-50 text-emerald-700',
};

function fmt(dt) {
  return dt ? new Date(dt).toLocaleDateString('ko-KR') : '';
}

// 받은 의견 — 전체 관리자 전용.
//
// 새로 온 것이 위다. 이 화면에 들어오는 이유가 "새 의견이 왔다"이므로 그것이
// 첫 줄이어야 한다.
//
// 분류·우선순위 칸을 만들지 않는다. 칸을 만들면 관리자가 매번 채워야 하고,
// 그 분류는 나중에 읽을 때 하면 된다.
export default function AdminFeedbackPage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const globalAdmin = isGlobalAdmin(identity);

  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!globalAdmin) router.replace('/requirements');
  }, [globalAdmin, router]);

  const load = useCallback(() => {
    if (!globalAdmin) return;
    fetch('/api/admin/feedback')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '의견을 불러오지 못했습니다.');
        setItems(d.feedback ?? []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [globalAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // 승격에 쓸 브랜드 목록. 의견에는 브랜드가 없어서 관리자가 골라야 한다.
  useEffect(() => {
    if (!globalAdmin) return;
    fetch('/api/brands')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setBrands(d.brands ?? []);
      })
      .catch(() => {});
  }, [globalAdmin]);

  if (!globalAdmin) return null;

  const fresh = items.filter((i) => i.status === NEW_FEEDBACK_STATUS).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold text-slate-900">받은 의견</h1>
        {fresh > 0 && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            새로 온 것 {fresh}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}

      {!loading && items.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
          아직 받은 의견이 없습니다.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <FeedbackRow
            key={item.id}
            item={item}
            brands={brands}
            onChanged={load}
            onError={setError}
          />
        ))}
      </ul>
    </div>
  );
}

function FeedbackRow({ item, brands, onChanged, onError }) {
  // '반영함' 을 고르면 한 줄을 받는다. 그 문장이 그대로 낸 사람에게 간다.
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState(item.admin_note ?? '');
  const [brandId, setBrandId] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patch(body) {
    setBusy(true);
    const res = await fetch(`/api/admin/feedback/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      onError(d?.error ?? '바꾸지 못했습니다.');
      return false;
    }
    onError('');
    onChanged();
    return true;
  }

  async function pickStatus(status) {
    // 서버도 같은 함수를 쓴다. 여기서 미리 막는 것은 편의일 뿐 관문이 아니다.
    if (!validateStatusChange({ status, note }).ok) {
      setResolving(true);
      return;
    }
    const ok = await patch({ status, note: status === RESOLVED_FEEDBACK_STATUS ? note : null });
    if (ok) setResolving(false);
  }

  async function promote() {
    if (!brandId) return;
    setPromoting(true);
    const res = await fetch(`/api/admin/feedback/${item.id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId }),
    }).catch(() => null);
    setPromoting(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      onError(d?.error ?? '요구사항으로 올리지 못했습니다.');
      return;
    }
    onError('');
    onChanged();
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-slate-900">{item.member?.name ?? '누군가'}</span>
        <span className="text-xs text-slate-400">{fmt(item.created_at)}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            STATUS_STYLE[item.status] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {item.status}
        </span>
      </div>

      <p className="text-sm leading-relaxed break-keep whitespace-pre-wrap text-slate-700">
        {item.body}
      </p>

      {item.requirement && (
        <p className="text-xs text-slate-500">
          요구사항으로 올림 →{' '}
          <Link
            href={`/requirements/${item.requirement.id}`}
            className="text-indigo-600 hover:underline"
          >
            {item.requirement.title}
          </Link>
        </p>
      )}

      {item.status === RESOLVED_FEEDBACK_STATUS && item.admin_note && (
        <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
          {item.admin_note}
        </p>
      )}

      {resolving && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`note-${item.id}`} className="text-xs text-slate-500">
            무엇을 반영했는지 한 줄 — 이 문장이 그대로 낸 사람에게 갑니다
          </label>
          <textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="목록에서 제목이 안 잘리게 했습니다."
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => pickStatus(RESOLVED_FEEDBACK_STATUS)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              반영함으로
            </Button>
            <Button type="button" variant="outline" onClick={() => setResolving(false)}>
              그만두기
            </Button>
          </div>
        </div>
      )}

      {!resolving && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          {item.status !== ACKED_FEEDBACK_STATUS && (
            <button
              type="button"
              disabled={busy}
              onClick={() => pickStatus(ACKED_FEEDBACK_STATUS)}
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              확인함
            </button>
          )}
          {item.status !== RESOLVED_FEEDBACK_STATUS && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setResolving(true)}
              className="rounded px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
            >
              반영함
            </button>
          )}

          {/* 승격은 브랜드를 골라야 한다. 의견에는 브랜드가 없으므로 자동으로
              정할 수 없다. 이미 올린 것은 다시 못 올린다. */}
          {!item.requirement_id && (
            <span className="ml-auto flex items-center gap-1.5">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                aria-label="브랜드"
                className="h-7 rounded border border-slate-300 px-1.5 text-xs text-slate-600"
              >
                <option value="">브랜드…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!brandId || promoting}
                onClick={promote}
                className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
              >
                {promoting ? '올리는 중...' : '요구사항으로'}
              </button>
            </span>
          )}
        </div>
      )}
    </li>
  );
}
