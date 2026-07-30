'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { suggestTier } from '@/lib/signup';
import { AdminSectionNav } from '@/components/AdminSectionNav';
import { PendingMembersSection } from '@/components/PendingMembersSection';
import { TeamMemberListSection } from '@/components/TeamMemberListSection';
import { TeamMemberFormDialog } from '@/components/TeamMemberFormDialog';
import { AccountCredentialDialog } from '@/components/AccountCredentialDialog';
import { BrandTeamAssignDialog } from '@/components/BrandTeamAssignDialog';

// 이 화면은 "사람"만 다룬다. 배치 대기 → 전사 팀원 순서인 이유는 위계가 아니라
// 급한 순서다: 배치 대기는 누군가 기다리고 있는 대기열이고, 아래 목록은 언제
// 봐도 되는 명부다.
export default function AdminMembersPage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const globalAdmin = isGlobalAdmin(identity);

  const [teamMembers, setTeamMembers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [accountDialogTarget, setAccountDialogTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

  useEffect(() => {
    if (!globalAdmin) router.replace('/requirements');
  }, [globalAdmin, router]);

  useEffect(() => {
    if (!globalAdmin) return undefined;
    let cancelled = false;
    fetch('/api/team-members?includeInactive=true')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '팀원 목록을 불러오지 못했습니다.');
        setTeamMembers(d.teamMembers ?? []);
        setLoadError('');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    // 배치 다이얼로그에서 브랜드를 고칠 수 있어야 해서 목록이 필요하다.
    fetch('/api/brands')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '브랜드 목록을 불러오지 못했습니다.');
        setBrands(d.brands ?? []);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [globalAdmin, reloadToken]);

  function refresh() {
    setReloadToken((t) => t + 1);
  }

  async function patchMember(member, body, fallbackMessage) {
    setActionError('');
    const res = await fetch(`/api/team-members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? fallbackMessage);
      return;
    }
    refresh();
  }

  if (!globalAdmin) {
    return <p className="text-sm text-slate-500">권한이 없습니다. 목록으로 이동합니다...</p>;
  }
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  // "배치 대기"는 별도 상태가 아니라 그냥 브랜드 행이 하나도 없는 팀원이다.
  // 승인이라는 중간 단계를 만들면 "승인은 됐는데 배치는 안 된" 구간이 생기고
  // 그게 곧 버그가 된다.
  const pendingMembers = teamMembers.filter((m) => m.is_active && m.hasBrandAssignment === false);
  const activeBrands = brands.filter((b) => b.is_active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">팀원 관리</h1>
        <p className="text-xs text-slate-500">
          전사 팀원을 등록하고, 계정을 발급하고, 브랜드에 배치합니다.
        </p>
      </div>
      <AdminSectionNav />
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <PendingMembersSection members={pendingMembers} onAssign={setAssignTarget} />

      <TeamMemberListSection
        members={teamMembers}
        onCreate={() => setMemberDialogOpen(true)}
        onAccount={setAccountDialogTarget}
        onToggleGlobalAdmin={(m) =>
          patchMember(m, { isGlobalAdmin: !m.is_global_admin }, '전체관리자 권한 변경 실패')
        }
        onToggleActive={(m) => patchMember(m, { isActive: !m.is_active }, '재직여부 변경 실패')}
      />

      <TeamMemberFormDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        identity={identity}
        onCreated={refresh}
      />
      {/* member 객체는 목록에서 받은 모양 그대로 넘긴다 — 이 다이얼로그는
          member.hasAccount 로 생성/재설정 모드를 정한다. */}
      <AccountCredentialDialog
        open={Boolean(accountDialogTarget)}
        onOpenChange={(v) => {
          if (!v) setAccountDialogTarget(null);
        }}
        member={accountDialogTarget}
        onSaved={refresh}
      />
      {/* 신청 브랜드와 제안 등급을 미리 채워 열되, 실제 배치는 관리자가
          눌러야 일어난다. 신청 값이 곧바로 권한이 되는 경로는 없다. */}
      <BrandTeamAssignDialog
        open={Boolean(assignTarget)}
        onOpenChange={(v) => {
          if (!v) setAssignTarget(null);
        }}
        identity={identity}
        presetMember={assignTarget}
        targetBrandId={assignTarget?.requested_brand_id ?? null}
        presetTier={suggestTier(assignTarget?.affiliation)}
        brands={activeBrands}
        onAssigned={() => {
          setAssignTarget(null);
          refresh();
        }}
      />
    </div>
  );
}
