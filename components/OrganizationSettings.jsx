'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIER_LABELS, TIER_HINTS } from '@/lib/tiers';

const TIERS = ['1차', '2차', '3차', '4차'];
// 셀렉트에서 "정하지 않음"을 고를 수 있어야 한다. 빈 문자열은 base-ui 가
// "선택 안 됨"과 구분하지 못해 항목이 늘 선택된 것처럼 보인다
// (lib/filterFields.js 의 CLEAR_FILTER_VALUE 와 같은 이유).
const NONE = '__none__';

// 조직 관리. 전체관리자 전용 화면에만 얹는다.
//
// 이 목록은 가입 화면에 그대로 노출되고 등급 제안까지 정한다. 그래서 여기서
// 조직을 지우지 않고 끄기만 한다 — 지우면 그 조직으로 가입한 사람의 소속
// 기록이 깨진다.
export function OrganizationSettings() {
  const [organizations, setOrganizations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 추가 폼
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(NONE);
  const [defaultTier, setDefaultTier] = useState(NONE);
  const [viewAll, setViewAll] = useState(false);

  // 수정 중인 행. id 하나만 들고 있으면 한 번에 한 줄만 열린다 — 여러 줄을
  // 동시에 열어 두면 어느 것을 저장했는지 헷갈린다.
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: '', brandId: NONE, defaultTier: NONE });

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/organizations').then((r) => r.json()),
      fetch('/api/brands').then((r) => r.json()),
    ])
      .then(([o, b]) => {
        setOrganizations(o.organizations ?? []);
        setBrands(b.brands ?? []);
      })
      .catch(() => setError('목록을 불러오지 못했습니다.'));
  }, []);

  useEffect(load, [load]);

  async function send(url, method, body) {
    setError('');
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '변경하지 못했습니다.');
      return false;
    }
    return true;
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await send('/api/organizations', 'POST', {
      name,
      brandId: brandId === NONE ? null : brandId,
      defaultTier: defaultTier === NONE ? null : defaultTier,
      defaultViewAllProjects: viewAll,
    });
    setBusy(false);
    if (!ok) return;
    setName('');
    setBrandId(NONE);
    setDefaultTier(NONE);
    setViewAll(false);
    load();
  }

  // 낙관적 갱신을 하지 않는다. 체크박스는 누른 상태가 바로 남아 있어서
  // 사용자가 이미 반영된 것으로 보는데, 실패했으면 그건 거짓말이다.
  // 다시 불러오면 값이 원래대로 돌아가고 배너가 이유를 말한다.
  async function patch(id, updates) {
    await send(`/api/organizations/${id}`, 'PATCH', updates);
    load();
  }

  function startEdit(o) {
    setEditingId(o.id);
    setDraft({
      name: o.name,
      brandId: o.brand_id ?? NONE,
      defaultTier: o.default_tier ?? NONE,
    });
    setError('');
  }

  async function saveEdit() {
    if (!draft.name.trim()) return;
    setBusy(true);
    const ok = await send(`/api/organizations/${editingId}`, 'PATCH', {
      name: draft.name,
      brandId: draft.brandId === NONE ? null : draft.brandId,
      defaultTier: draft.defaultTier === NONE ? null : draft.defaultTier,
    });
    setBusy(false);
    if (!ok) return;
    setEditingId(null);
    load();
  }

  const brandItems = [
    { value: NONE, label: '없음 (본부)' },
    ...brands.map((b) => ({ value: b.id, label: b.name })),
  ];
  const tierItems = [
    { value: NONE, label: '정하지 않음' },
    ...TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-900">조직 추가</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-name">이름</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 법무팀"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-brand">연결 브랜드</Label>
            <Select items={brandItems} value={brandId} onValueChange={setBrandId}>
              <SelectTrigger id="org-brand" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {brandItems.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">연결하면 배치 화면이 그 브랜드를 미리 채웁니다</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-tier">기본 등급</Label>
            <Select items={tierItems} value={defaultTier} onValueChange={setDefaultTier}>
              <SelectTrigger id="org-tier" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tierItems.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 등급 이름은 지위를 말하는데, 고르는 사람이 알아야 하는 건
                그 지위가 무엇을 여는가다. */}
            <p className="text-xs text-slate-500">
              {defaultTier === NONE ? '비우면 요청자로 제안됩니다' : TIER_HINTS[defaultTier]}
            </p>
          </div>
          <div className="flex flex-col justify-start gap-2">
            <Label>전사 열람</Label>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => setViewAll(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              전사 프로젝트를 본다
            </label>
            <Button onClick={create} disabled={!name.trim() || busy}>
              {busy ? '추가 중...' : '추가'}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">연결 브랜드</th>
              <th className="px-4 py-2 font-medium">기본 등급</th>
              <th className="px-4 py-2 text-center font-medium">전사 열람</th>
              <th className="px-4 py-2 text-center font-medium">사용</th>
              <th className="px-4 py-2 text-right font-medium">수정</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) =>
              editingId === o.id ? (
                // 수정 중인 줄. 다른 줄과 배경을 달리해서 지금 무엇을 고치고
                // 있는지가 표에서 바로 보이게 한다.
                <tr key={o.id} className="border-t border-slate-100 bg-indigo-50/40">
                  <td className="px-4 py-2">
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className="h-8"
                      aria-label="조직 이름"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      items={brandItems}
                      value={draft.brandId}
                      onValueChange={(v) => setDraft((d) => ({ ...d, brandId: v }))}
                    >
                      <SelectTrigger className="h-8 w-full" aria-label="연결 브랜드">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brandItems.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      items={tierItems}
                      value={draft.defaultTier}
                      onValueChange={(v) => setDraft((d) => ({ ...d, defaultTier: v }))}
                    >
                      <SelectTrigger className="h-8 w-full" aria-label="기본 등급">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tierItems.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* 체크박스 둘은 수정 모드에서도 그대로 둔다. 저장 버튼을
                      거치지 않고 바로 반영되는 값이라 여기 끌어들이면
                      "저장을 눌러야 하나"가 헷갈린다. */}
                  <td className="px-4 py-2 text-center text-xs text-slate-400">—</td>
                  <td className="px-4 py-2 text-center text-xs text-slate-400">—</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        onClick={saveEdit}
                        disabled={!draft.name.trim() || busy}
                        className="h-8 px-3"
                      >
                        저장
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        className="h-8 px-3"
                      >
                        취소
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={o.id}
                  className={`border-t border-slate-100 ${o.is_active ? '' : 'text-slate-400'}`}
                >
                  <td className="px-4 py-2">
                    <span className={o.is_active ? 'text-slate-900' : ''}>{o.name}</span>
                    {!o.is_active && <span className="ml-2 text-xs">(사용 안 함)</span>}
                  </td>
                  <td className="px-4 py-2">
                    {o.brand?.name ?? <span className="text-slate-400">본부</span>}
                  </td>
                  <td className="px-4 py-2">
                    {o.default_tier ? (
                      TIER_LABELS[o.default_tier]
                    ) : (
                      <span className="text-slate-400">요청자 (기본)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={o.default_view_all_projects}
                      onChange={(e) => patch(o.id, { defaultViewAllProjects: e.target.checked })}
                      className="h-4 w-4 accent-indigo-600"
                      aria-label={`${o.name} 전사 열람`}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={o.is_active}
                      onChange={(e) => patch(o.id, { isActive: e.target.checked })}
                      className="h-4 w-4 accent-indigo-600"
                      aria-label={`${o.name} 사용`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(o)}
                      className="text-xs text-indigo-600 underline hover:text-indigo-800"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              )
            )}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  아직 조직이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        조직은 지우지 않고 &apos;사용&apos;을 꺼서 감춥니다. 꺼진 조직은 가입 화면에서 빠지지만
        이미 그 조직으로 가입한 사람의 기록은 남습니다.
      </p>
    </div>
  );
}
