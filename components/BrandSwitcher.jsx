'use client';

import { useEffect, useState } from 'react';
import { useIdentity } from './IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { switchBrand } from '@/lib/identity';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function BrandSwitcher({ readOnly = false }) {
  const { identity } = useIdentity();
  const globalAdmin = isGlobalAdmin(identity);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    // my-brands 는 전체관리자면 활성 브랜드 전부를 tier '1차' 로 내려준다.
    // 그래서 여기서 관리자용 목록을 따로 부를 필요가 없다.
    fetch('/api/my-brands')
      .then((res) => res.json())
      .then((d) => setBrands(d.brands ?? []))
      .catch(() => {});
  }, []);

  const current = brands.find((b) => b.id === identity.brandId);

  function handlePick(brandId) {
    if (brandId === identity.brandId) return;
    const picked = brands.find((b) => b.id === brandId);
    if (!picked) return;
    // 전체관리자는 어느 브랜드에서든 1차로 동작한다. 그 외에는 배치된 등급을 쓴다.
    switchBrand(identity, brandId, globalAdmin ? '1차' : picked.tier);
    // identity 는 localStorage 에 있고 IdentityProvider 가 이를 구독하지 않는다.
    // 전체 새로고침이 가장 확실하며, 브랜드 전환은 드문 동작이라 비용이 문제되지 않는다.
    window.location.reload();
  }

  // 오갈 곳이 없으면 드롭다운을 띄울 이유가 없다.
  //
  // readOnly 는 모바일 상단바가 쓴다. 폰에서 브랜드를 바꾸는 사람은 전체
  // 관리자뿐이고 그 사람은 데스크톱에서 일한다. 다만 어느 브랜드를 보고
  // 있는지는 반드시 보여야 한다 — 모르는 채로 요구사항을 올리는 것이 가장
  // 위험하다. 그래서 전환만 막고 표시는 남긴다.
  if (readOnly || brands.length <= 1) {
    return <span className="text-sm font-medium text-slate-900">{current?.name ?? ''}</span>;
  }

  const items = brands.map((b) => ({ value: b.id, label: b.name }));
  return (
    <Select items={items} value={identity.brandId} onValueChange={handlePick}>
      <SelectTrigger className="h-8 w-36 text-sm font-medium">
        <SelectValue placeholder="브랜드" />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
