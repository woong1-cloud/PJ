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
const SUB_ROLES = ['기획', '개발', '뷰어'];

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
  const [subRole, setSubRole] = useState(null);
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
      setSubRole(null);
      setError('');
    }
  }

  const pool = candidates ?? [];
  const results = search
    ? pool.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  async function handleAssign() {
    if (!targetId || !brandId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/brand-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          targetMemberId: targetId,
          tier,
          subRole,
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
                  >
                    <SelectTrigger className="w-full">
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
                  {targetBrandId && (
                    <p className="text-xs text-slate-500">
                      본인이 신청한 브랜드입니다. 확인하고 바꿀 수 있습니다.
                    </p>
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
                {/* 등급 이름은 지위를 말하는데, 고르는 사람이 알아야 하는 건
                    그 지위가 무엇을 여는가다. '실무자'와 '실무 관리자'는
                    이름만으로 한눈에 안 갈린다. */}
                <p className="text-xs text-slate-500">{TIER_HINTS[tier]}</p>
                {presetTier && (
                  <p className="text-xs text-slate-500">
                    신청한 소속을 근거로 제안한 등급입니다. 바꿀 수 있습니다.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label>역할</Label>
                <Select
                  items={SUB_ROLES.map((s) => ({ value: s, label: s }))}
                  value={subRole}
                  onValueChange={setSubRole}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUB_ROLES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
