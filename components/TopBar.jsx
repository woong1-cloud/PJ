'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useIdentity } from './IdentityProvider';
import { BrandSwitcher } from './BrandSwitcher';
import { NotificationBell } from './NotificationBell';
import { canManageBrand, isGlobalAdmin } from '@/lib/tiers';

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`border-b-2 pb-1 text-sm transition-colors ${
        active
          ? 'border-indigo-600 font-medium text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </Link>
  );
}

function MenuLink({ href, onClick, children }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

export function TopBar() {
  const { identity, logout } = useIdentity();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const manageBrand = canManageBrand(identity);
  const globalAdmin = isGlobalAdmin(identity);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-5">
        {/* 앱 이름이자 홈 링크. 바로 옆이 브랜드 전환기라 둘이 헷갈리기 쉬워
            굵기·색·세로 구분선으로 확실히 갈라 둔다 — 왼쪽은 늘 '모아'로
            고정된 것, 오른쪽은 바뀌는 것이다. */}
        <Link
          href="/requirements"
          className="text-base font-semibold tracking-tight text-slate-900 hover:text-indigo-600"
        >
          모아 MOA
        </Link>
        <span className="h-4 w-px bg-slate-200" />
        {/* 순서는 위계가 아니라 사용 빈도를 따른다 — 요구사항은 하루에도 몇십 번,
            대시보드는 가끔 연다. 매일 쓰는 것이 가장 왼쪽이다.
            목록/보드는 페이지 안의 뷰 토글로 흡수했다. */}
        <BrandSwitcher />
        <NavLink href="/requirements" active={pathname.startsWith('/requirements')}>
          요구사항
        </NavLink>
        {/* 구분선이 여기 있는 이유: 브랜드 선택이 어디까지 영향을 주는지를
            위치만으로 알려준다. 왼쪽은 선택한 브랜드의 것, 오른쪽은 브랜드를
            넘어서 보는 화면이다. "브랜드 바꿨는데 왜 이 화면은 그대로지?"가
            가장 흔한 혼란이라 색을 더하는 대신 선을 옮겨 답한다. */}
        <span className="h-4 w-px bg-slate-300" />
        <NavLink href="/projects" active={pathname.startsWith('/projects')}>
          프로젝트
        </NavLink>
        {globalAdmin && (
          <NavLink href="/admin/dashboard" active={pathname.startsWith('/admin/dashboard')}>
            대시보드
          </NavLink>
        )}
      </div>

      <div className="relative flex items-center gap-3">
        {/* 벨은 계정 메뉴 왼쪽이다 — 이름/아바타는 "나"에 대한 것이고 벨은
            "나에게 온 것"이라 둘을 붙여 두되, 로그아웃 옆에 두면 잘못 누른다. */}
        <NotificationBell />
        <span className="text-sm text-slate-500">{identity.name}</span>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          aria-label="계정 메뉴"
        >
          {identity.name?.[0] ?? '?'}
        </button>
        {menuOpen && (
          <>
            {/* 바깥을 누르면 닫힌다 */}
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
              aria-label="메뉴 닫기"
            />
            <div className="absolute right-0 top-9 z-20 flex w-44 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {globalAdmin && (
                <span className="px-3 py-1.5 text-xs text-indigo-700">전체 관리자</span>
              )}
              {manageBrand && (
                <MenuLink href="/requirements/settings" onClick={() => setMenuOpen(false)}>
                  설정
                </MenuLink>
              )}
              {/* 관리 화면이 둘로 갈렸으니 입구도 둘이다. 하나로 묶어 두면
                  "팀원 관리는 어디였지"를 브랜드 화면에서 다시 찾게 된다. */}
              {globalAdmin && (
                <MenuLink href="/admin/brands" onClick={() => setMenuOpen(false)}>
                  브랜드 관리
                </MenuLink>
              )}
              {globalAdmin && (
                <MenuLink href="/admin/members" onClick={() => setMenuOpen(false)}>
                  팀원 관리
                </MenuLink>
              )}
              {/* 등급과 무관하게 누구나 볼 수 있다 — 설명이 가장 필요한 사람이
                  권한이 가장 낮은 요청자이기 때문이다. */}
              <MenuLink href="/help" onClick={() => setMenuOpen(false)}>
                도움말
              </MenuLink>
              <MenuLink href="/change-password" onClick={() => setMenuOpen(false)}>
                비밀번호 변경
              </MenuLink>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
