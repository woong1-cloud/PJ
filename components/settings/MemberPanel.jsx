'use client';

import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIER_LABELS } from '@/lib/tiers';
import { displayAffiliation } from '@/lib/organizations';
import { displayJobRole } from '@/lib/jobRoles';

// 브랜드 배치에서 고를 수 있는 등급. 1차는 없다 — 전체관리자는 브랜드에
// 매인 값이 아니라 사람에 붙는 값이고, 그건 목록의 '⋯' 에서 준다.
// API(PATCH /api/brand-team/[id])도 이 셋만 받는다.
const TIERS = ['2차', '3차', '4차'];

function Section({ title, action, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

// 사람 하나를 여는 오른쪽 패널.
//
// 표의 줄에서 걷어낸 것이 여기로 온다. 줄은 "누가 있나"를 읽는 자리고, 여기가
// "이 사람을 어떻게 하나"를 하는 자리다.
//
// 다이얼로그 넷을 흡수하지 않는다 — 연다. 정보 수정·계정·브랜드 추가는 이미
// 있는 창이 하고, 패널은 그 창을 여는 손잡이와 등급만 직접 갖는다.
//
// props:
//   member        페이지의 teamMembers 에서 id 로 다시 찾은 것이어야 한다.
//                 목록에서 받은 객체를 패널이 들고 있으면, 등급을 바꾸고
//                 refresh() 가 돌아도 패널만 옛 값을 계속 그린다.
//   onClose()
//   onEdit(member)         TeamMemberEditDialog
//   onAccount(member)      AccountCredentialDialog
//   onAssignBrand(member)  BrandTeamAssignDialog
//   onChangeTier(member, brandId, tier)
//   onRemoveBrand(member, brandId)
export function MemberPanel({
  member,
  onClose,
  onEdit,
  onAccount,
  onAssignBrand,
  onChangeTier,
  onRemoveBrand,
}) {
  // Esc 로 닫는다. 패널이 화면 오른쪽을 덮고 있어서, 닫는 길이 오른쪽 위
  // × 하나뿐이면 마우스를 거기까지 가져가야 한다.
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const roles = Array.isArray(member?.brandRoles) ? member.brandRoles : [];

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col gap-5 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{member?.name ?? '—'}</h2>
            {member?.is_global_admin && (
              <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                전체관리자
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">{member?.email || '이메일 없음'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          ×
        </button>
      </div>

      <Section
        title="정보"
        action={
          <button
            type="button"
            onClick={() => onEdit(member)}
            className="text-xs text-indigo-600 hover:underline"
          >
            고치기
          </button>
        }
      >
        {/* 읽기 전용이다. 같은 값을 두 자리에서 고칠 수 있으면 어느 쪽이
            진짜인지 알 수 없어진다 — 고치는 곳은 기존 창 하나다. */}
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">소속</dt>
            <dd className="text-right text-slate-800">{displayAffiliation(member)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">직무</dt>
            <dd className="text-right text-slate-800">{displayJobRole(member)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">재직</dt>
            <dd className="text-right text-slate-800">
              {member?.is_active ? '재직중' : '비활성'}
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        title="브랜드 배치"
        action={
          <button
            type="button"
            onClick={() => onAssignBrand(member)}
            className="text-xs text-indigo-600 hover:underline"
          >
            브랜드 추가
          </button>
        }
      >
        {roles.length === 0 ? (
          <p className="text-sm text-slate-400">아직 배치된 브랜드가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {roles.map((role) => (
              <li key={role.brandId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {role.brandName}
                </span>
                {/* 목록의 줄에서 걷어낸 셀렉트가 여기 하나씩 선다. 한 사람을
                    열었을 때만 보이므로, 화면에 한 번에 여섯 개가 한계다. */}
                <Select
                  items={TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] ?? t }))}
                  value={role.tier}
                  onValueChange={(v) => onChangeTier(member, role.brandId, v)}
                >
                  <SelectTrigger
                    className="h-8 w-28 text-xs"
                    aria-label={`${member?.name ?? ''} ${role.brandName} 등급`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIER_LABELS[t] ?? t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => onRemoveBrand(member, role.brandId)}
                  className="shrink-0 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="계정">
        <button
          type="button"
          onClick={() => onAccount(member)}
          className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          {member?.hasAccount ? '비밀번호 재설정' : '계정 발급'}
        </button>
      </Section>
    </aside>
  );
}
