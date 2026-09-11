'use client';

import { useState } from 'react';
import { QuickFilterChips } from '@/components/QuickFilterChips';
import { FilterSelect } from '@/components/FilterSelect';
import { memberBrandLabel } from '@/lib/memberBrandLabel';
import { BRAND_NONE, MEMBER_FILTERS } from '@/lib/memberFilter';
import { TIER_LABELS } from '@/lib/tiers';
import { displayAffiliation } from '@/lib/organizations';
import { displayJobRole } from '@/lib/jobRoles';

// 칩에 적을 말. 순서는 여기가 아니라 MEMBER_FILTERS 가 정한다 — 칩을 하나
// 더 만들 때 순서와 이름을 서로 다른 파일에서 고치게 두지 않는다.
const FILTER_LABELS = { all: '전체', active: '재직중', off: '비활성', admin: '전체관리자' };
const CHIPS = MEMBER_FILTERS.map((key) => ({ key, label: FILTER_LABELS[key] ?? key }));

// 한 줄의 '⋯'.
//
// RequirementStatusActions 의 어법을 그대로 따른다: 손잡이 하나, 바깥을 덮는
// 투명 단추로 닫기, absolute 로 떨어지는 목록. 이 저장소에서 메뉴는 이미 그
// 모양이라, 여기만 다르면 같은 기호가 다르게 동작하는 셈이 된다.
//
// 줄 전체가 패널을 여는 단추라서 이 안의 클릭은 전부 여기서 멈춘다. 안
// 그러면 '⋯' 를 누를 때 메뉴와 패널이 같이 열린다.
function MemberRowMenu({ member, onAccount, onToggleGlobalAdmin, onToggleActive, onEdit }) {
  const [open, setOpen] = useState(false);

  function pick(run) {
    setOpen(false);
    run();
  }

  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${member.name} 다른 선택지`}
        aria-expanded={open}
        className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-500 hover:bg-slate-50"
      >
        ⋯
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-9 z-20 flex w-44 flex-col rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => pick(() => onEdit(member))}
              className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              정보 수정
            </button>
            <button
              type="button"
              onClick={() => pick(() => onAccount(member))}
              className="px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              {member.hasAccount ? '비밀번호 재설정' : '계정 발급'}
            </button>
            <button
              type="button"
              onClick={() => pick(() => onToggleGlobalAdmin(member))}
              className="mt-1 border-t border-slate-100 px-3 py-1.5 pt-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              {member.is_global_admin ? '전체관리자 해제' : '전체관리자 지정'}
            </button>
            <button
              type="button"
              onClick={() => pick(() => onToggleActive(member))}
              className={`px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                member.is_active ? 'text-rose-600' : 'text-slate-600'
              }`}
            >
              {member.is_active ? '비활성화' : '활성화'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// props:
//   members    이미 좁혀진 목록. 거르는 셈은 lib/memberFilter.js 가 한다
//   counts     memberCounts(전체) — 브랜드·검색을 뺀 수다. 이유는 그 파일에
//   q, f, brand     툴바에 그릴 현재 값(주소에서 온다)
//   brands          활성 브랜드 [{ id, name }]
//   currentBrandId  상단바에서 보고 있는 브랜드. memberBrandLabel 이 쓴다
//   onSearch(v) · onFilter(key) · onBrand(v)   툴바 조작
//   onCreate() · onAccount(m) · onToggleGlobalAdmin(m) · onToggleActive(m) · onEdit(m)
//   onSelect(m) · selectedId   줄을 눌러 패널을 연다
//
// onChangeTier 는 여기 없다. 등급은 사람 패널로 갔다 — 줄마다 셀렉트가 최대
// 여섯 개씩 붙어서, 22명이면 표 하나에 컨트롤이 백 개 가까이 깔렸다.
//
// member 객체는 GET /api/team-members 가 준 모양 그대로 넘겨야 한다.
// AccountCredentialDialog 가 member.hasAccount 로 생성/재설정 모드를 정하기
// 때문에, 여기서 필드를 골라 다시 만든 객체를 넘기면 조용히 반대 모드로 열린다.
export function TeamMemberListSection({
  members,
  counts,
  q,
  f,
  brand,
  brands,
  currentBrandId,
  onSearch,
  onFilter,
  onBrand,
  onCreate,
  onAccount,
  onToggleGlobalAdmin,
  onToggleActive,
  onEdit,
  onSelect,
  selectedId,
}) {
  // '배치 없음'을 브랜드 칸에 같이 넣는다. 지금은 배치가 없는 사람을 찾을
  // 방법이 아예 없다 — 그 사람들이야말로 이 화면에서 손대야 할 사람이다.
  const brandOptions = [
    ...(brands ?? []).map((b) => ({ value: b.id, label: b.name })),
    { value: BRAND_NONE, label: '배치 없음' },
  ];
  // 브랜드로 좁혀 볼 때는 그 브랜드의 등급을 보여준다. '배치 없음'은 브랜드가
  // 아니므로 넘기지 않는다 — 넘겨도 맞는 사람이 없어 전부 빈칸이 된다.
  const filterBrandId = brand && brand !== BRAND_NONE ? brand : '';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">전사 팀원</h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          + 새 직원
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="이름 · 이메일로 찾기"
          aria-label="이름 · 이메일로 찾기"
          className="h-8 w-56 rounded-lg border border-slate-300 px-3 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <QuickFilterChips chips={CHIPS} counts={counts} activeKey={f} onPick={onFilter} />
        <FilterSelect label="브랜드" options={brandOptions} current={brand} onPick={onBrand} />
        <div className="flex-1" />
        {/* 좁혀진 수는 칩 숫자와 다르다. 칩은 전체 기준이고 이쪽은 지금 보이는
            것이라, 둘이 어긋나 보일 때 이 문구가 답을 준다. */}
        <span className="shrink-0 text-xs text-slate-500">{members.length}명 보임</span>
      </div>

      {/* 표를 overflow-x-auto 로 감싸지 않는다. 한 축이 auto 면 다른 축도 같이
          잘려서, 아래쪽 줄의 '⋯' 메뉴가 표 안에 갇힌다. 대신 좁은 화면에서
          소속·직무 칸을 접는다. */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 font-medium">이름</th>
            <th className="hidden py-2 font-medium sm:table-cell">소속 · 직무</th>
            <th className="py-2 font-medium">브랜드 · 등급</th>
            <th className="py-2 font-medium">상태</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const label = memberBrandLabel(m.brandRoles, { currentBrandId, filterBrandId });
            return (
              <tr
                key={m.id}
                onClick={() => onSelect(m)}
                className={`cursor-pointer border-b border-slate-100 ${
                  m.id === selectedId ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                }`}
              >
                <td className="py-2">
                  {/* 줄 전체가 눌리지만 키보드로는 이 단추로 연다. tr 에는
                      포커스가 안 가서, 클릭 핸들러만 두면 마우스 없이 패널을
                      열 길이 없다. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(m);
                    }}
                    className="text-left font-medium text-slate-900 hover:underline"
                  >
                    {m.name}
                  </button>
                  {m.is_global_admin && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                      전체관리자
                    </span>
                  )}
                  {!m.hasAccount && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                      계정 없음
                    </span>
                  )}
                  <span className="block text-xs text-slate-400">{m.email || '—'}</span>
                </td>
                <td className="hidden py-2 text-slate-500 sm:table-cell">
                  {[displayAffiliation(m), displayJobRole(m)]
                    .filter((v) => v && v !== '—')
                    .join(' · ') || '—'}
                </td>
                <td className="py-2">
                  {/* 셀렉트가 아니라 문구다. 배치와 등급은 패널에서 바꾼다 —
                      무엇이 걸려 있는지 읽는 자리와 바꾸는 자리를 나눠야 22줄이
                      표로 읽힌다. */}
                  {label.empty ? (
                    <span className="text-slate-400">배치 없음</span>
                  ) : (
                    <span className="text-slate-600">
                      {label.name}
                      <span className="ml-1.5 text-xs text-slate-500">
                        {TIER_LABELS[label.tier] ?? label.tier}
                      </span>
                      {label.more > 0 && (
                        <span className="ml-1.5 text-xs text-slate-400">외 {label.more}</span>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      m.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {m.is_active ? '재직중' : '비활성'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <MemberRowMenu
                    member={m}
                    onAccount={onAccount}
                    onToggleGlobalAdmin={onToggleGlobalAdmin}
                    onToggleActive={onToggleActive}
                    onEdit={onEdit}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {members.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">찾는 조건에 맞는 직원이 없습니다.</p>
      )}
    </section>
  );
}
