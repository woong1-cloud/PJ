'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { settingsGroupsFor } from '@/lib/settingsNav';

// 설정 레일.
//
// 폰(375px)에는 레일을 둘 자리가 없다. 같은 목록을 select 로 접는다 —
// 두 벌을 따로 만들지 않고 lib/settingsNav.js 하나를 함께 본다.
export function SettingsRail() {
  const { identity } = useIdentity();
  const pathname = usePathname();
  const router = useRouter();

  const groups = settingsGroupsFor(identity);

  // 브랜드 이름은 identity 에 없다(brandId 와 tier 뿐이다 — 확인함).
  // BrandSwitcher 가 하는 것과 같은 조회를 여기서도 한다.
  //
  // 이 이름을 굳이 붙이는 이유: 이 묶음의 화면들은 **지금 보고 있는
  // 브랜드**를 고친다. 어느 브랜드인지 모르는 채로 팀 배치를 건드리는 것이
  // 가장 위험하다 — BrandSwitcher 주석이 같은 말을 적어 뒀다.
  const [brandName, setBrandName] = useState('');
  useEffect(() => {
    if (!identity?.brandId) return undefined;
    let cancelled = false;
    fetch('/api/my-brands')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setBrandName(d.brands?.find((b) => b.id === identity.brandId)?.name ?? '');
      })
      // 못 받아도 그만이다. 제목이 「이 브랜드」로 남을 뿐 화면은 다 돈다.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [identity?.brandId]);

  const title = (group) =>
    group.id === 'brand' && brandName ? `이 브랜드 · ${brandName}` : group.title;

  return (
    <>
      {/* 폰 */}
      <div className="lg:hidden">
        <label className="sr-only" htmlFor="settings-nav">설정 화면</label>
        <select
          id="settings-nav"
          value={pathname}
          onChange={(e) => router.push(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          {groups.map((group) => (
            <optgroup key={group.id} label={title(group)}>
              {group.items.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 데스크톱 */}
      <nav aria-label="설정" className="hidden w-48 shrink-0 lg:block">
        <p className="px-2 pb-2 text-sm font-semibold text-slate-900">설정</p>
        {groups.map((group) => (
          <div key={group.id} className="mt-2 first:mt-0">
            <p className="px-2 py-1 text-[11px] font-medium text-slate-400">{title(group)}</p>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-lg px-2 py-1.5 text-sm ${
                    active ? 'bg-indigo-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
