'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useIdentity } from './IdentityProvider';
import { BrandSwitcher } from './BrandSwitcher';
import { NotificationBell } from './NotificationBell';
import { MessageSquarePlusIcon } from 'lucide-react';
import { NewsMenu } from './NewsMenu';
import { FeedbackDialog } from './FeedbackDialog';
import { canManageBrand, canProcess, isGlobalAdmin } from '@/lib/tiers';

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
  // 의견 창의 열림 상태를 NewsMenu 가 아니라 여기서 갖는다. 입구가 둘이라
  // (소식 팝오버 하단, 계정 메뉴) 한쪽 안에 두면 다른 쪽에서 열 수 없다.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const manageBrand = canManageBrand(identity);
  const process = canProcess(identity);
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
          {/* 주간회의는 요구사항 바로 옆이다. 같은 브랜드의 같은 목록을 다른
              각도로 보는 화면이라 구분선 왼쪽에 있어야 한다.
              4차(요청자)에게는 안 보인다 — 담당자를 지정할 수 없어서 그
              화면에서 할 일이 없다. */}
          {process && (
            <NavLink href="/meeting" active={pathname.startsWith('/meeting')}>
              주간회의
            </NavLink>
          )}
          {/* 구분선이 여기 있는 이유: 브랜드 선택이 어디까지 영향을 주는지를
              위치만으로 알려준다. 왼쪽은 선택한 브랜드의 것, 오른쪽은 브랜드를
              넘어서 보는 화면이다. "브랜드 바꿨는데 왜 이 화면은 그대로지?"가
              가장 흔한 혼란이라 색을 더하는 대신 선을 옮겨 답한다. */}
          <span className="h-4 w-px bg-slate-300" />
          <NavLink href="/projects" active={pathname.startsWith('/projects')}>
            프로젝트
          </NavLink>
          {/* 브랜드 런칭. 403건짜리 새 개념이라 (beta) 를 붙여 무게를 낮춘다 —
              요구사항·주간회의와 같은 무게로 보이면 안 된다.
              1단계에서는 가이드와 가져오기뿐이라 전체 관리자에게만 보인다. */}
          {globalAdmin && (
            <NavLink href="/launch" active={pathname.startsWith('/launch')}>
              런칭 <span className="text-[10px] text-slate-400">beta</span>
            </NavLink>
          )}
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
        {/* 오른쪽으로 갈수록 "나" 쪽이다 — 아바타(나) · 이름(나) · 벨(나에게
            온 것) · 소식(앱이 나에게) · 의견(내가 앱에게) 순으로 멀어진다.
            소식을 벨에 합치지 않는 이유는 NewsMenu 주석에 있다.

            의견을 소식 팝오버 안에만 두었더니 안 보였다. 그 팝오버는 점이
            떠 있을 때만 열리는 자리라, 배포 직후 며칠만 존재하는 입구가 된
            셈이다. 소식은 가끔 밀어주는 것이고 의견은 아무 때나 열려 있어야
            하는 것이라, 밀어주는 쪽에 얹으면 그 주기를 따라가 버린다. */}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          aria-label="의견 보내기"
          title="의견 보내기"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <MessageSquarePlusIcon className="h-4 w-4" />
        </button>
        <NewsMenu />
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
                {process && (
                  <MenuLink
                    href="/meeting"
                    onClick={closeMenu}
                    active={pathname.startsWith('/meeting')}
                  >
                    주간회의
                  </MenuLink>
                )}
                <MenuLink
                  href="/projects"
                  onClick={closeMenu}
                  active={pathname.startsWith('/projects')}
                >
                  프로젝트
                </MenuLink>
                {globalAdmin && (
                  <MenuLink href="/launch" onClick={closeMenu} active={pathname.startsWith('/launch')}>
                    런칭 (beta)
                  </MenuLink>
                )}
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
              {globalAdmin && (
                <MenuLink href="/admin/feedback" onClick={closeMenu}>
                  받은 의견
                </MenuLink>
              )}
              {/* 등급과 무관하게 누구나 볼 수 있다 — 설명이 가장 필요한 사람이
                  권한이 가장 낮은 요청자이기 때문이다. */}
              <MenuLink href="/help" onClick={closeMenu}>
                도움말
              </MenuLink>
              {/* 주 입구는 소식 팝오버 하단이다. 여기에도 한 줄 남기는 이유:
                  "설정 비슷한 것"을 계정 메뉴에서 찾는 사람이 실제로 있고,
                  한 줄 값이면 두 곳에 두는 편이 낫다. 같은 창을 연다. */}
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  setFeedbackOpen(true);
                }}
                className="flex min-h-11 items-center px-3 text-left text-sm text-slate-600 hover:bg-slate-50 md:min-h-0 md:py-1.5"
              >
                의견 보내기
              </button>
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

      {/* 입구 둘이 같은 창을 연다. */}
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
