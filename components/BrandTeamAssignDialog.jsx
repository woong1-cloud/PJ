'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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

const TIERS = ['3차', '4차'];

// '역할'(기획/개발/뷰어) 칸을 없앴다.
//
// 세 값 중 어느 것도 권한에 영향이 없었는데(표시용 sub_role 컬럼), '뷰어'는
// 읽기 전용으로 제한한다고 읽힌다. 실제로는 위에서 고른 등급 권한을 그대로
// 갖는다 — 없는 안전장치를 있다고 말하는 칸이었다.
//
// 기획/개발은 사람 단위 '직무'(job_roles)와 같은 말이라, 같은 정보를 두 곳에서
// 다르게 관리하는 셈이기도 했다.
//
// 화면에서만 뺐다. sub_role 컬럼과 그 안의 값은 그대로 둔다 — 지우면 되돌릴
// 수 없고, 남겨 두면 나중에 "예전에 무엇으로 적혀 있었나"를 확인할 수 있다.
// API 도 subRole 을 계속 받아 준다(보내는 화면은 이제 없다).

// props: open, onOpenChange, candidates(미배치 전사 활성 직원), identity, onAssigned()
//
// 배치 대기 목록에서 열 때는 대상과 브랜드가 이미 정해져 있다. 그때는
// presetMember / targetBrandId / presetTier / brands 를 넘긴다:
//   - presetMember: 검색 단계를 건너뛴다(누구를 배치할지 이미 안다).
//   - targetBrandId: 본인이 신청한 브랜드. 어디까지나 초기값이다 — 이 값
//     자체로는 아무 권한도 생기지 않고, 관리자가 확인하고 눌러야 배치된다.
//   - presetTier: 소속에서 계산한 제안 등급. 관리자가 바꿀 수 있다 — 제안이지
//     확정이 아니다.
//   - brands: 브랜드를 고칠 수 있게 목록을 준다. 넘기지 않으면(브랜드 설정
//     화면) 지금 보고 있는 브랜드에 그대로 배치한다.
export function BrandTeamAssignDialog({
  open,
  onOpenChange,
  candidates,
  identity,
  onAssigned,
  presetMember = null,
  targetBrandId = null,
  presetTier = null,
  brands = null,
}) {
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [tier, setTier] = useState('4차');
  const [allBrands, setAllBrands] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // 다이얼로그가 열릴 때마다 입력을 초기화한다. useEffect 안에서 직접 setState를 호출하지
  // 않고 렌더 중 이전 open 값과 비교해 파생시킨다(react-hooks/set-state-in-effect 회피).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch('');
      setTargetId(presetMember?.id ?? null);
      setBrandId(targetBrandId ?? identity?.brandId ?? null);
      setTier(presetTier ?? '4차');
      setAllBrands(false);
      setError('');
    }
  }

  const pool = candidates ?? [];
  const results = search
    ? pool.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  // '모든 브랜드'를 켜면 브랜드 셀렉트 대신 활성 브랜드 전부를 보낸다.
  // brands 를 못 받은 화면(브랜드 설정)에서는 체크박스 자체가 안 보이므로
  // 여기 값도 늘 false 다.
  const targetBrandIds = allBrands && brands ? brands.map((b) => b.id) : [brandId];

  async function handleAssign() {
    if (!targetId || targetBrandIds.filter(Boolean).length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/brand-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandIds: targetBrandIds,
          targetMemberId: targetId,
          tier,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error ?? '배치 실패');
      }
      onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const targetName = presetMember?.name ?? pool.find((m) => m.id === targetId)?.name ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>팀원 배치</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {error && <p className="text-red-600">{error}</p>}

          {presetMember ? (
            <p className="text-slate-600">
              <span className="font-medium text-slate-900">{targetName}</span> 님을 배치합니다.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <Label>직원 검색</Label>
              <Input placeholder="이름으로 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
              <ul className="mt-1 flex flex-col gap-1">
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setTargetId(m.id)}
                      className={`w-full rounded border px-2 py-1.5 text-left ${
                        targetId === m.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
                      }`}
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {targetId && (
            <>
              {!presetMember && <p className="text-slate-500">&lsquo;{targetName}&rsquo; 배치</p>}
              {brands && (
                <div className="flex flex-col gap-1">
                  <Label>브랜드</Label>
                  <Select
                    items={brands.map((b) => ({ value: b.id, label: b.name }))}
                    value={brandId}
                    onValueChange={setBrandId}
                    disabled={allBrands}
                  >
                    <SelectTrigger className="w-full" disabled={allBrands}>
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* 브랜드를 여럿 맡는 사람(온라인BU 기획자 등)을 다섯 번
                      배치하게 만들 이유가 없다. 켜면 셀렉트를 잠가서 "지금
                      고른 하나"와 "전부" 중 무엇이 적용되는지 헷갈리지 않게 한다. */}
                  <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={allBrands}
                      onChange={(e) => setAllBrands(e.target.checked)}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    모든 브랜드에 같은 등급으로 배치 ({brands.length}개)
                  </label>
                  {allBrands ? (
                    <p className="text-xs text-slate-500">
                      이미 배치된 브랜드가 있으면 배치되지 않습니다. 그 브랜드를 먼저 해제하거나
                      하나씩 배치해 주세요.
                    </p>
                  ) : (
                    targetBrandId && (
                      <p className="text-xs text-slate-500">
                        본인이 신청한 브랜드입니다. 확인하고 바꿀 수 있습니다.
                      </p>
                    )
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Label>권한 등급</Label>
                <Select
                  items={TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] }))}
                  value={tier}
                  onValueChange={setTier}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* 한 줄로 합친다. 예전에는 "무엇을 할 수 있는가"와 "제안값
                    이다"가 각각 한 줄씩 나와서, 화면에서는 회색 두 줄이
                    겹쳐 보이고 어느 쪽이 중요한지 알 수 없었다.
                    등급 이름은 지위를 말하는데 고르는 사람이 알아야 하는 건
                    그 지위가 무엇을 여는가다 — 그쪽을 앞에 둔다. */}
                <p className="text-xs text-slate-500">
                  {TIER_HINTS[tier]}
                  {presetTier && ' · 신청한 소속을 근거로 미리 고른 값이며 바꿀 수 있습니다'}
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!targetId || !brandId || submitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting ? '배치 중...' : '배치'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
