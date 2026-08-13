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

// 계정 메뉴 항목. 모바일에서는 44px 짜리 터치 타깃이어야 하고 데스크톱에서는
// 지금까지의 촘촘한 드롭다운이어야 한다. min-h 로 가른다 — padding 으로 잡으면
// 글자 위치가 위아래로 흔들린다.
function MenuLink({ href, onClick, children, active = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex min-h-11 items-center px-3 text-sm hover:bg-slate-50 md:min-h-0 md:py-1.5 ${
        active ? 'font-medium text-indigo-700' : 'text-slate-600'
      }`}
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
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 md:gap-5">
        {/* 앱 이름이자 홈 링크. 바로 옆이 브랜드 전환기라 둘이 헷갈리기 쉬워
            굵기·색·세로 구분선으로 확실히 갈라 둔다 — 왼쪽은 늘 '모아'로
            고정된 것, 오른쪽은 바뀌는 것이다.
            모바일에서는 'MOA' 를 떼고 가운뎃점으로 잇는다. 폰 폭에서는 한
            글자가 아쉽고, 이 화면에서 영문 표기가 하는 일이 없다. */}
        <Link
          href="/requirements"
          className="shrink-0 text-base font-semibold tracking-tight text-slate-900 hover:text-indigo-600"
        >
          모아<span className="hidden md:inline"> MOA</span>
        </Link>
        <span className="hidden h-4 w-px bg-slate-200 md:block" />
        <span className="text-slate-300 md:hidden">·</span>

        {/* 모바일에서는 전환을 막고 표시만 한다. 폰에서 브랜드를 바꾸는 사람은
            전체관리자뿐이고 그 사람은 데스크톱에서 일한다. 그래도 어느 브랜드를
            보고 있는지는 반드시 보여야 한다 — 모르는 채로 요구사항을 올리는
            것이 가장 위험하다. */}
        <div className="min-w-0 truncate md:hidden">
          <BrandSwitcher readOnly />
        </div>
        <div className="hidden md:block">
          <BrandSwitcher />
        </div>

        {/* 순서는 위계가 아니라 사용 빈도를 따른다 — 요구사항은 하루에도 몇십 번,
            대시보드는 가끔 연다. 매일 쓰는 것이 가장 왼쪽이다.
            목록/보드는 페이지 안의 뷰 토글로 흡수했다.

            모바일에서는 이 묶음이 통째로 계정 메뉴 안으로 들어간다. 375px 에
            링크 셋과 구분선 둘을 늘어놓으면 오른쪽이 잘려 나간다. */}
        <div className="hidden items-center gap-5 md:flex">
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
          {globalAdmin && (
            <NavLink
              href="/admin/organizations"
              active={pathname.startsWith('/admin/organizations')}
            >
              조직
            </NavLink>
          )}
        </div>
      </div>

      <div className="relative flex shrink-0 items-center gap-3">
        {/* 벨은 계정 메뉴 왼쪽이다 — 이름/아바타는 "나"에 대한 것이고 벨은
            "나에게 온 것"이라 둘을 붙여 두되, 로그아웃 옆에 두면 잘못 누른다. */}
        <NotificationBell />
        {/* 이름은 데스크톱에서만. 아바타에 첫 글자가 이미 들어 있고, 폰에서는
            그 한 조각이 브랜드명 자리를 뺏는다. */}
        <span className="hidden text-sm text-slate-500 md:inline">{identity.name}</span>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-medium text-indigo-700 hover:bg-indigo-100 md:h-7 md:w-7 md:text-xs"
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
              onClick={closeMenu}
              aria-label="메뉴 닫기"
            />
            <div className="absolute right-0 top-11 z-20 flex w-56 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg md:top-9 md:w-44">
              {/* 모바일에서만 보이는 이동 링크. 데스크톱에는 상단바에 있다.
                  현재 화면을 굵게 표시한다 — 상단바의 밑줄이 하던 일을 여기서
                  대신해야 어디에 있는지 알 수 있다. */}
              <div className="md:hidden">
                <MenuLink
                  href="/requirements"
                  onClick={closeMenu}
                  active={pathname.startsWith('/requirements')}
                >
                  요구사항
                </MenuLink>
                <MenuLink
                  href="/projects"
                  onClick={closeMenu}
                  active={pathname.startsWith('/projects')}
                >
                  프로젝트
                </MenuLink>
                {globalAdmin && (
                  <MenuLink
                    href="/admin/dashboard"
                    onClick={closeMenu}
                    active={pathname.startsWith('/admin/dashboard')}
                  >
                    대시보드
                  </MenuLink>
                )}
                <div className="my-1 border-t border-slate-100" />
              </div>
              {globalAdmin && (
                <span className="px-3 py-1.5 text-xs text-indigo-700">전체 관리자</span>
              )}
              {manageBrand && (
                <MenuLink href="/requirements/settings" onClick={closeMenu}>
                  설정
                </MenuLink>
              )}
              {/* 관리 화면이 둘로 갈렸으니 입구도 둘이다. 하나로 묶어 두면
                  "팀원 관리는 어디였지"를 브랜드 화면에서 다시 찾게 된다. */}
              {globalAdmin && (
                <MenuLink href="/admin/brands" onClick={closeMenu}>
                  브랜드 관리
                </MenuLink>
              )}
              {globalAdmin && (
                <MenuLink href="/admin/members" onClick={closeMenu}>
                  팀원 관리
                </MenuLink>
              )}
              {/* 등급과 무관하게 누구나 볼 수 있다 — 설명이 가장 필요한 사람이
                  권한이 가장 낮은 요청자이기 때문이다. */}
              <MenuLink href="/help" onClick={closeMenu}>
                도움말
              </MenuLink>
              <MenuLink href="/change-password" onClick={closeMenu}>
                비밀번호 변경
              </MenuLink>
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 items-center px-3 text-left text-sm text-slate-600 hover:bg-slate-50 md:min-h-0 md:py-1.5"
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
