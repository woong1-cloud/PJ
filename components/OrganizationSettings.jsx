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
const NO_TIER = '__none__';
const NO_BRAND = '__none__';

// 조직 관리. 전체관리자 전용 화면에만 얹는다.
//
// 이 목록은 가입 화면에 그대로 노출되고 등급 제안까지 정한다. 그래서 여기서
// 조직을 지우지 않고 끄기만 한다 — 지우면 그 조직으로 가입한 사람의 소속
// 기록이 깨진다.
export function OrganizationSettings() {
  const [organizations, setOrganizations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(NO_BRAND);
  const [defaultTier, setDefaultTier] = useState(NO_TIER);
  const [viewAll, setViewAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        brandId: brandId === NO_BRAND ? null : brandId,
        defaultTier: defaultTier === NO_TIER ? null : defaultTier,
        defaultViewAllProjects: viewAll,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '추가하지 못했습니다.');
      return;
    }
    setName('');
    setBrandId(NO_BRAND);
    setDefaultTier(NO_TIER);
    setViewAll(false);
    load();
  }

  // 낙관적 갱신을 하지 않는다. 체크박스는 누른 상태가 바로 남아 있어서
  // 사용자가 이미 반영된 것으로 보는데, 실패했으면 그건 거짓말이다.
  // 다시 불러오면 값이 원래대로 돌아가고 배너가 이유를 말한다.
  async function patch(id, updates) {
    setError('');
    const res = await fetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '변경하지 못했습니다.');
    }
    load();
  }

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
            <Select
              items={[
                { value: NO_BRAND, label: '없음 (본부·팀)' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={brandId}
              onValueChange={setBrandId}
            >
              <SelectTrigger id="org-brand" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BRAND}>없음 (본부·팀)</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              연결하면 배치 화면이 그 브랜드를 미리 채웁니다
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-tier">기본 등급</Label>
            <Select
              items={[
                { value: NO_TIER, label: '정하지 않음' },
                ...TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] })),
              ]}
              value={defaultTier}
              onValueChange={setDefaultTier}
            >
              <SelectTrigger id="org-tier" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TIER}>정하지 않음</SelectItem>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 등급 이름은 지위를 말하는데, 고르는 사람이 알아야 하는 건
                그 지위가 무엇을 여는가다. */}
            <p className="text-xs text-slate-500">
              {defaultTier === NO_TIER ? '비우면 요청자로 제안됩니다' : TIER_HINTS[defaultTier]}
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
              <th className="px-4 py-2 font-medium">전사 열람</th>
              <th className="px-4 py-2 font-medium">사용</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">{o.name}</td>
                <td className="px-4 py-2 text-slate-600">{o.brand?.name ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">
                  {o.default_tier ? TIER_LABELS[o.default_tier] : '요청자 (기본)'}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={o.default_view_all_projects}
                    onChange={(e) => patch(o.id, { defaultViewAllProjects: e.target.checked })}
                    className="h-4 w-4 accent-indigo-600"
                    aria-label={`${o.name} 전사 열람`}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={o.is_active}
                    onChange={(e) => patch(o.id, { isActive: e.target.checked })}
                    className="h-4 w-4 accent-indigo-600"
                    aria-label={`${o.name} 사용`}
                  />
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
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
