'use client';

import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { OrganizationSettings } from '@/components/OrganizationSettings';
import { JobRoleSettings } from '@/components/JobRoleSettings';

// 조직 관리.
//
// /admin/brands 에 섹션으로 붙이지 않은 이유: 그 화면은 이미 브랜드 목록·팀
// 배치·전체관리자 토글로 붐빈다. 조직은 가입 화면에 직접 노출되는 목록이라
// 따로 다룰 값어치가 있다.
//
// 화면 게이팅은 편의일 뿐이고 관문은 API 다(requireGlobalAdmin).
export default function OrganizationsPage() {
  const { identity } = useIdentity();
  if (!isGlobalAdmin(identity)) {
    return <p className="text-sm text-slate-500">전체 관리자만 볼 수 있는 화면입니다.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">조직 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          가입 화면의 소속 목록입니다. 브랜드를 연결하면 배치 화면이 그 브랜드를 미리 채웁니다.
        </p>
      </div>
      <OrganizationSettings />

      {/* 직무는 소속과 다른 축이다 — 소속이 '어느 조직인가'이고 직무는
          '무슨 일을 하는가'다. 큰 조직(온라인BU)에서는 기획자/개발자 구분이
          여전히 의미가 있어서 칸을 따로 둔다. 한 화면에 두는 이유는 둘 다
          가입 화면의 선택지이고 고치는 사람이 같기 때문이다. */}
      <div className="mt-6 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">직무 관리</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          가입 화면의 직무 목록입니다. 소속이 &apos;어느 조직인가&apos;라면 직무는 &apos;무슨
          일을 하는가&apos;입니다.
        </p>
        <JobRoleSettings />
      </div>
    </div>
  );
}
