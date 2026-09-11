'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { demoteImpact } from '@/lib/globalAdminDemote';
import { TIER_LABELS } from '@/lib/tiers';

// 전체관리자 해제를 한 번 세우는 창.
//
// 지금까지는 '⋯ → 전체관리자 해제'가 곧바로 서버로 갔다. 그런데 해제는
// 되돌리기 쉬운 행동처럼 보여서 위험하다 — 누르는 사람은 "관리자 깃발 하나를
// 내린다"고 읽는데, 실제로는 **저장된 브랜드 배치로 떨어진다.** 전체관리자는
// 모든 활성 브랜드에 들어가지만(lib/checkBrandAccess.js 첫 줄), 해제되면
// 배치가 있는 브랜드만 남는다.
//
// 그래서 창은 개수가 아니라 **이름**을 보여 준다. 개수만 보면 안전해 보이는
// 경우가 실제로 있다 — 배치 4개 중 둘은 브랜드가 비활성이라 못 들어간다.
//
// 세는 일은 lib/globalAdminDemote.js 가 한다. 여기는 그리기만 한다.
//
// 지정(전체관리자 주기)은 이 창을 안 지난다. 권한이 늘어나는 쪽은 누른
// 사람이 의도한 그대로고, 되돌리는 길도 같은 메뉴에 있다.

// 한 줄. 묶음이 비면 아예 안 그린다 — "없음"이라고 쓰면 읽을 것이 늘기만 한다.
function ImpactRow({ label, children, note }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">
        {children}
        {note && <span className="text-slate-400"> ({note})</span>}
      </dd>
    </div>
  );
}

// 창 본문. 따로 떼어 둔 이유는 테스트다.
//
// DialogContent 는 포털 안에 있어서 react-dom/server 로 그리면 빈 문자열이
// 나온다 — 창을 통째로 그려 봐도 글자를 확인할 수가 없다. 본문이 별개
// 부품이면 렌더 테스트가 실제로 무엇이 쓰였는지 본다.
export function DemoteImpactSummary({ name, impact }) {
  const { keep, lose, inactive } = impact;

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1.5">
        {keep.length > 0 && (
          <ImpactRow label="들어갈 수 있는 곳">
            {keep.map((k, i) => (
              <span key={k.name}>
                {i > 0 && <span className="text-slate-300"> · </span>}
                {k.name}
                {TIER_LABELS[k.tier] && (
                  <span className="text-slate-400"> ({TIER_LABELS[k.tier]})</span>
                )}
              </span>
            ))}
          </ImpactRow>
        )}

        {lose.length > 0 && (
          <ImpactRow label="들어갈 수 없게 되는 곳">{lose.join(' · ')}</ImpactRow>
        )}

        {inactive.length > 0 && (
          <ImpactRow label="배치가 있지만 못 들어감" note="브랜드가 비활성">
            {inactive.join(' · ')}
          </ImpactRow>
        )}
      </dl>

      {keep.length === 0 && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {name ? `${name} 님은` : '이 사람은'} 어느 브랜드에도 못 들어가게 됩니다.
        </p>
      )}
    </div>
  );
}

// props:
//   member   — 목록에서 받은 사람. brandRoles 로 배치를 읽는다
//   brands   — /api/brands 가 준 **전체** 목록이어야 한다. 활성만 넘기면
//              비활성 배치가 통째로 안 보여서 창이 거짓말을 한다
//   onConfirm(member) — 실제 해제. 페이지의 patchMember 로 간다
//   onClose()
export function DemoteAdminDialog({ member, brands, onConfirm, onClose }) {
  const [saving, setSaving] = useState(false);

  const impact = demoteImpact({ brandRoles: member?.brandRoles, brands });
  const name = member?.name ?? '';

  async function confirm() {
    setSaving(true);
    await onConfirm(member);
    setSaving(false);
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          {/* 닫기 X 가 absolute top-2 right-2 size-7 이라 오른쪽 36px 을
              먹는다. pr-8(32px)로는 4px 모자라 긴 이름이 X 밑으로 들어간다. */}
          <DialogTitle className="pr-10">
            {name ? `${name} 님의 ` : ''}전체관리자를 해제합니다
          </DialogTitle>
          <DialogDescription>해제하면 저장된 브랜드 배치로 돌아갑니다.</DialogDescription>
        </DialogHeader>

        <DemoteImpactSummary name={name} impact={impact} />

        {/* keep 이 비어도 막지 않는다. 그만두는 사람을 정리하려는 것일 수도
            있고, 그때 이 창이 유일한 길을 막으면 다른 길로 돌아가게 된다. */}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={saving}>
            {saving ? '해제 중...' : '해제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
