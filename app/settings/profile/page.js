'use client';

import { useEffect, useState } from 'react';
import { useIdentity } from '@/components/IdentityProvider';
import { PropertyRow } from '@/components/ui/PropertyRow';

// 내 정보. 읽기만 한다.
//
// 고치는 칸을 안 두는 이유: 이름 · 소속 · 직무는 전체 관리자가 팀원 화면에서
// 고친다(TeamMemberEditDialog). 여기에 같은 칸을 또 만들면 같은 값을 고치는
// 길이 둘이 되고, 둘 중 어느 쪽이 이겼는지 아무도 모르게 된다.
//
// 이메일은 안 보인다. /api/me 가 주지 않는다 — 계정 메일은 Supabase auth 쪽에
// 있고 team_members 에는 없다. 없는 값을 지어내느니 줄을 안 만든다.
export default function ProfilePage() {
  const { identity } = useIdentity();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '내 정보를 불러오지 못했습니다.');
        setMe(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">내 정보</h1>
        <p className="mt-1 text-sm text-slate-500">
          이름 · 소속 · 직무는 전체 관리자가 팀원 화면에서 고칩니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex flex-col gap-px">
          {/* 로딩 중에도 이름은 이미 안다(identity). 세 줄이 통째로 비었다가
              채워지는 대신 이름 한 줄이 먼저 서 있게 둔다. */}
          <PropertyRow icon="◍" label="이름" value={me?.name ?? identity.name} />
          <PropertyRow icon="▤" label="소속" value={me?.affiliation ?? ''} />
          <PropertyRow icon="◈" label="직무" value={me?.jobRole ?? ''} />
        </div>
      </div>

      {/* 계정 메뉴가 이름 밑에 한 줄로 보이는 것과 같은 표시다. 전체 관리자가
          아닌 사람에게는 이 줄 자체가 없다 — '아니오'를 보여 줄 값어치가 없다. */}
      {me?.isGlobalAdmin && (
        <p className="text-xs text-slate-500">전체 관리자입니다.</p>
      )}
    </div>
  );
}
