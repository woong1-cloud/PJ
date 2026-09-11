'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { canManageBrand } from '@/lib/tiers';
import { BrandTeamSection } from '@/components/BrandTeamSection';

// 이 브랜드의 팀 배치.
//
// 예전에는 카테고리와 한 페이지(/requirements/settings)에 있었다. 둘은 고치는
// 사람은 같아도 고치는 때가 다르다 — 배치는 사람이 오갈 때, 분류는 일이
// 늘어날 때다. 레일이 생기면서 한 줄씩 가질 자리가 났다.
//
// 문지기는 원본 그대로다. canManageBrand 가 아니면 /requirements 로 보낸다 —
// 화면 게이팅은 편의일 뿐이고 관문은 API 다.
export default function BrandTeamPage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const manageBrand = canManageBrand(identity);

  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!manageBrand) router.replace('/requirements');
  }, [manageBrand, router]);

  useEffect(() => {
    if (!manageBrand) return undefined;
    let cancelled = false;
    fetch(`/api/brand-team?brandId=${identity.brandId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '팀원 배치를 불러오지 못했습니다.');
        setMembers(d.members ?? []);
        setLoadError('');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    // 배치 후보. 못 받아도 화면은 돈다 — 원본과 같이 조용히 넘긴다.
    fetch('/api/team-members')
      .then((res) => res.json())
      .then((d) => {
        if (!cancelled) setTeamMembers(d.teamMembers ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [manageBrand, identity.brandId, reloadToken]);

  function refresh() {
    setReloadToken((t) => t + 1);
  }

  if (!manageBrand) {
    return <p className="text-sm text-slate-500">권한이 없습니다. 목록으로 이동합니다...</p>;
  }
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <BrandTeamSection
      members={members}
      teamMembers={teamMembers}
      identity={identity}
      onChanged={refresh}
    />
  );
}
