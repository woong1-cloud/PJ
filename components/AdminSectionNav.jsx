'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 전체관리자의 일은 늘 "이 브랜드를 관리한다" 아니면 "이 사람을 관리한다"로
// 시작한다. 둘을 한 화면에 겹쳐 두면 열 때마다 "지금 보는 게 뭐였지"부터
// 시작하게 되므로 화면을 갈라 놓았다. 대신 어느 쪽도 막다른 길이 되지 않도록
// 두 화면 모두 이 탭을 머리에 달고 있는다.
const TABS = [
  { href: '/admin/brands', label: '브랜드' },
  { href: '/admin/members', label: '팀원' },
];

export function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
