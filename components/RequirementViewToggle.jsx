'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// 목록 ↔ 보드 전환. 두 화면 모두에 같은 모양으로 놓는다.
//
// 예전에는 목록에만 '보드' 버튼이 있어서 한 번 보드로 가면 돌아올 길이
// 눈에 보이지 않았다. 상단 메뉴의 '요구사항'을 누르면 되긴 하지만, 보드도
// /requirements 하위라 그 메뉴가 이미 선택된 것처럼 보여서 눌러볼 생각이
// 들지 않는다. 왕복이 가능하다는 걸 화면이 스스로 보여줘야 한다.
//
// 현재 쿼리스트링을 그대로 들고 넘어간다. 이게 없으면 목록에서 걸어 둔
// 필터가 보드로 넘어가는 순간 사라져서, 뷰 전환처럼 생긴 버튼이 실제로는
// 초기화 버튼이 된다.
export function RequirementViewToggle({ current }) {
  const search = useSearchParams().toString();
  const suffix = search ? `?${search}` : '';
  return (
    <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
      <ToggleLink href={`/requirements${suffix}`} active={current === 'list'}>
        목록
      </ToggleLink>
      <ToggleLink href={`/requirements/board${suffix}`} active={current === 'board'}>
        보드
      </ToggleLink>
    </div>
  );
}

function ToggleLink({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1 text-sm transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  );
}
