'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

// 요구사항에 붙은 외부 링크(피그마 시안, GA4 대시보드, 슬랙 스레드 등).
//
// 여러 개가 붙으므로 별도 목록이다. 비고에 주소를 적어두면 클릭이 안 되고
// 어떤 것이 시안이고 어떤 것이 지표인지 알 수 없다.
//
// props: requirementId, brandId
export function RequirementLinks({ requirementId, brandId }) {
  const [links, setLinks] = useState([]);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!requirementId || !brandId) return;
    fetch(`/api/requirements/${requirementId}/links?brandId=${brandId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '링크를 불러오지 못했습니다.');
        setLinks(d.links ?? []);
      })
      .catch((e) => setError(e.message));
  }, [requirementId, brandId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(event) {
    event.preventDefault();
    if (!url.trim()) return;
    setError('');
    setSaving(true);
    const res = await fetch(`/api/requirements/${requirementId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, label, url }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '링크 추가 실패');
      return;
    }
    setLabel('');
    setUrl('');
    load();
  }

  async function remove(linkId) {
    setError('');
    const res = await fetch(
      `/api/requirements/${requirementId}/links/${linkId}?brandId=${brandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '링크 삭제 실패');
      return;
    }
    load();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-500">외부 링크</h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {links.length === 0 && <p className="text-sm text-slate-400">등록된 링크가 없습니다.</p>}
      <ul className="flex flex-col gap-1 text-sm">
        {links.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2">
            {/* 외부로 나가는 링크다. noopener 가 없으면 열린 쪽에서
                window.opener 로 이 창을 조작할 수 있다. */}
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-indigo-600 hover:underline"
              title={l.url}
            >
              {l.label}
            </a>
            <button
              type="button"
              onClick={() => remove(l.id)}
              className="shrink-0 text-xs text-slate-400 hover:text-rose-600"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="이름 (비우면 도메인)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="sm:w-44"
        />
        <Input
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <button
          type="submit"
          disabled={saving || !url.trim()}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? '추가 중...' : '추가'}
        </button>
      </form>
    </section>
  );
}
