'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { AdminSectionNav } from '@/components/AdminSectionNav';
import { BrandListSection } from '@/components/BrandListSection';
import { BrandFormDialog } from '@/components/BrandFormDialog';

// 이 화면은 "브랜드"만 다룬다. 예전에는 브랜드·전사 팀원·배치 대기가 한 화면에
// 겹쳐 있어서, 열 때마다 지금 보고 있는 게 셋 중 무엇인지부터 골라내야 했다.
// 사람에 대한 일은 전부 /admin/members 로 옮겼다.
export default function AdminBrandsPage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const globalAdmin = isGlobalAdmin(identity);

  const [brands, setBrands] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);

  useEffect(() => {
    if (!globalAdmin) router.replace('/requirements');
  }, [globalAdmin, router]);

  useEffect(() => {
    if (!globalAdmin) return undefined;
    let cancelled = false;
    fetch('/api/brands')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '브랜드 목록을 불러오지 못했습니다.');
        setBrands(d.brands ?? []);
        setLoadError('');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    // 새 브랜드의 초기 관리자 선택과 브랜드별 팀 배치 후보로 쓴다 —
    // 둘 다 "지금 일할 수 있는 사람"이라 활성 팀원만 있으면 된다.
    fetch('/api/team-members')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '팀원 목록을 불러오지 못했습니다.');
        setTeamMembers(d.teamMembers ?? []);
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

  async function toggleBrandActive(brand) {
    setActionError('');
    const res = await fetch(`/api/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !brand.is_active }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '브랜드 상태 변경 실패');
      return;
    }
    refresh();
  }

  if (!globalAdmin) {
    return <p className="text-sm text-slate-500">권한이 없습니다. 목록으로 이동합니다...</p>;
  }
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">브랜드 관리</h1>
        <p className="text-xs text-slate-500">
          브랜드를 만들고 고칩니다. 브랜드 이름을 누르면 그 브랜드에 배치된 팀원이 펼쳐집니다.
        </p>
      </div>
      <AdminSectionNav />
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <BrandListSection
        brands={brands}
        teamMembers={teamMembers}
        identity={identity}
        onCreate={() => {
          setEditingBrand(null);
          setBrandDialogOpen(true);
        }}
        onEdit={(brand) => {
          setEditingBrand(brand);
          setBrandDialogOpen(true);
        }}
        onToggleActive={toggleBrandActive}
      />

      <BrandFormDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        brand={editingBrand}
        teamMembers={teamMembers}
        identity={identity}
        onSaved={refresh}
      />
    </div>
  );
}
