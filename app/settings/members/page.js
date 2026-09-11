'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { suggestTierFromOrg } from '@/lib/organizations';
import { filterMembers, memberCounts } from '@/lib/memberFilter';
import { mergeMemberParams, parseMemberParams } from '@/lib/memberParams';
import { PendingMembersSection } from '@/components/PendingMembersSection';
import { TeamMemberListSection } from '@/components/TeamMemberListSection';
import { TeamMemberFormDialog } from '@/components/TeamMemberFormDialog';
import { AccountCredentialDialog } from '@/components/AccountCredentialDialog';
import { BrandTeamAssignDialog } from '@/components/BrandTeamAssignDialog';
import { TeamMemberEditDialog } from '@/components/TeamMemberEditDialog';
import { MemberPanel } from '@/components/settings/MemberPanel';

// 타이핑마다 주소를 바꾸면 라우터가 계속 리렌더를 민다. 300ms 멈춘 뒤에만.
const SEARCH_DEBOUNCE_MS = 300;

// 툴바 상태를 주소에서 읽고 쓴다. components/useLaunchFilters.js 와 같은
// 모양이다 — 왜 주소인지는 lib/memberParams.js 참조.
//
// 반환: q(입력창 값) · f · brand · setQ · setParams
function useMemberFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ReadonlyURLSearchParams 는 렌더마다 새 객체다. 문자열 하나로 눌러서
  // 그것만 비교 기준으로 삼는다 — 안 그러면 effect 가 매 렌더 돈다.
  const searchKey = searchParams.toString();

  const parsed = useMemo(() => parseMemberParams(new URLSearchParams(searchKey)), [searchKey]);

  // 입력창은 즉시 반응해야 하므로 로컬 상태다. 목록도 이 값으로 좁힌다 —
  // 300ms 를 기다렸다가 좁히면 글자를 치는 동안 결과가 뒤늦게 따라온다.
  const [q, setQ] = useState(parsed.q);
  const [debouncedQ, setDebouncedQ] = useState(parsed.q);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // router.replace 는 비동기다. 호출한 직후 렌더에서도 useSearchParams 는 아직
  // 예전 쿼리스트링을 준다. 그 사이에 두 번째 쓰기가 일어나면 낡은 값을 기준으로
  // 병합해서 방금 쓴 변경이 되살아난다 — 검색어를 치자마자 칩을 누르면 검색어가
  // 되돌아온다. 병합 기준은 "주소에 쓰기로 한 마지막 값"으로 잡는다.
  const pendingRef = useRef(null);

  // 주소가 우리가 쓴 값을 따라잡았을 때만 기준을 놓아준다. 변화마다 비우면
  // 연속으로 두 번 쓴 뒤 첫 번째만 반영된 시점에 두 번째를 잃는다.
  useEffect(() => {
    if (pendingRef.current === searchKey) pendingRef.current = null;
  }, [searchKey]);

  const setParams = useCallback(
    (patch) => {
      const base = pendingRef.current ?? searchKey;
      const next = mergeMemberParams(base, patch);
      // 값이 그대로면 라우팅하지 않는다. 이 가드가 없으면 아래 q 동기화
      // effect 가 searchKey 변화마다 replace 를 다시 쏴 루프가 된다.
      if (next === base) return;
      pendingRef.current = next;
      // push 가 아니라 replace 다. 필터를 만질 때마다 히스토리가 쌓이면
      // 뒤로가기를 여러 번 눌러야 화면을 빠져나간다.
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchKey],
  );

  // 디바운스가 끝난 값만 주소로 옮긴다.
  useEffect(() => {
    setParams({ q: debouncedQ.trim() });
  }, [debouncedQ, setParams]);

  return { ...parsed, q, setQ, setParams };
}

// useSearchParams 를 쓰는 부분은 Suspense 경계 안에 있어야 한다. 없으면
// 프로덕션 빌드가 "Missing Suspense boundary with useSearchParams" 로 실패한다
// (요구사항 목록 페이지의 같은 주석 참조).
export default function AdminMembersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">불러오는 중...</p>}>
      <MembersScreen />
    </Suspense>
  );
}

// 이 화면은 "사람"만 다룬다. 배치 대기 → 전사 팀원 순서인 이유는 위계가 아니라
// 급한 순서다: 배치 대기는 누군가 기다리고 있는 대기열이고, 아래 목록은 언제
// 봐도 되는 명부다.
function MembersScreen() {
  const { identity } = useIdentity();
  const router = useRouter();
  const globalAdmin = isGlobalAdmin(identity);
  const { q, f, brand, setQ, setParams } = useMemberFilters();

  const [teamMembers, setTeamMembers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [accountDialogTarget, setAccountDialogTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  // 패널은 사람 자체가 아니라 id 만 들고 있는다. 객체를 들고 있으면 등급을
  // 바꾼 뒤 refresh() 가 돌아도 패널만 옛 값을 계속 그린다 — 아래 selectedMember.
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!globalAdmin) router.replace('/requirements');
  }, [globalAdmin, router]);

  useEffect(() => {
    if (!globalAdmin) return undefined;
    let cancelled = false;
    // includeInactive 를 빼면 API 가 재직자만 준다. 그러면 '비활성' 칩이 늘
    // 0 이 되고 '전체' 숫자도 거짓이 되는데, 오류는 안 난다.
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
    // 툴바의 브랜드 드롭다운도 같은 목록을 쓴다.
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

  // 패널의 Esc 리스너가 매 렌더 다시 붙지 않도록 고정한다.
  const closePanel = useCallback(() => setSelectedId(null), []);

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

  // 등급 변경은 team_members 가 아니라 user_brand_roles 를 고친다. 그래서
  // patchMember 를 쓰지 않고 brand-team 라우트로 간다 — 그 라우트에는 마지막
  // 브랜드 관리자를 강등하지 못하게 막는 검사가 들어 있다.
  //
  // 이 함수는 그대로다. 부르는 자리만 표의 줄에서 패널로 옮겼다.
  async function changeTier(member, brandId, tier) {
    setActionError('');
    const res = await fetch(`/api/brand-team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, tier }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '등급 변경 실패');
      return;
    }
    refresh();
  }

  // 배치 해제도 같은 라우트다(DELETE). 마지막 2차 관리자는 서버가 막는다 —
  // 여기서 다시 판정하지 않는다. 두 곳에서 같은 규칙을 세면 언젠가 갈린다.
  async function removeBrand(member, brandId) {
    setActionError('');
    const res = await fetch(`/api/brand-team/${member.id}?brandId=${brandId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '배치 해제 실패');
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

  // 칩 숫자는 전체 명단 기준이고, 표는 좁혀진 것을 그린다. 둘을 같은 목록으로
  // 세면 '재직중'을 누른 순간 '비활성 0' 이 되어 거기로 건너갈 수가 없다.
  const counts = memberCounts(teamMembers);
  const visibleMembers = filterMembers(teamMembers, { q, f, brand });

  // 패널이 그릴 사람은 매 렌더 목록에서 다시 찾는다. 줄에서 받은 객체를 들고
  // 있으면 등급을 바꾸고 refresh() 가 돌아도 패널만 옛 값을 그린다.
  const selectedMember = teamMembers.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">팀원 관리</h1>
        <p className="text-xs text-slate-500">
          전사 팀원을 등록하고, 계정을 발급하고, 브랜드에 배치합니다.
        </p>
      </div>
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <PendingMembersSection members={pendingMembers} onAssign={setAssignTarget} />

      <TeamMemberListSection
        members={visibleMembers}
        counts={counts}
        q={q}
        f={f}
        brand={brand}
        brands={activeBrands}
        currentBrandId={identity?.brandId ?? null}
        onSearch={setQ}
        onFilter={(key) => setParams({ f: key === f ? 'all' : key })}
        onBrand={(value) => setParams({ brand: value })}
        onCreate={() => setMemberDialogOpen(true)}
        onAccount={setAccountDialogTarget}
        onToggleGlobalAdmin={(m) =>
          patchMember(m, { isGlobalAdmin: !m.is_global_admin }, '전체관리자 권한 변경 실패')
        }
        onToggleActive={(m) => patchMember(m, { isActive: !m.is_active }, '재직여부 변경 실패')}
        onEdit={setEditTarget}
        onSelect={(m) => setSelectedId(m.id)}
        selectedId={selectedId}
      />

      {/* 닫혔을 때는 아예 안 그린다. 계속 그려 두면 지난 사람이 남는다 —
          이 저장소의 네 창이 모두 그 병을 앓았다. */}
      {selectedMember && (
        <MemberPanel
          member={selectedMember}
          onClose={closePanel}
          onEdit={setEditTarget}
          onAccount={setAccountDialogTarget}
          onAssignBrand={setAssignTarget}
          onChangeTier={changeTier}
          onRemoveBrand={removeBrand}
        />
      )}

      <TeamMemberEditDialog
        open={Boolean(editTarget)}
        onOpenChange={(v) => {
          if (!v) setEditTarget(null);
        }}
        member={editTarget}
        onSaved={() => {
          setEditTarget(null);
          refresh();
        }}
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
          눌러야 일어난다. 신청 값이 곧바로 권한이 되는 경로는 없다.
          패널의 '브랜드 추가'도 같은 창을 연다 — 배치를 만드는 길은 하나다. */}
      <BrandTeamAssignDialog
        open={Boolean(assignTarget)}
        onOpenChange={(v) => {
          if (!v) setAssignTarget(null);
        }}
        identity={identity}
        presetMember={assignTarget}
        targetBrandId={assignTarget?.organization?.brand_id ?? assignTarget?.requested_brand_id ?? null}
        presetTier={suggestTierFromOrg(assignTarget?.organization)}
        brands={activeBrands}
        onAssigned={() => {
          setAssignTarget(null);
          refresh();
        }}
      />
    </div>
  );
}
