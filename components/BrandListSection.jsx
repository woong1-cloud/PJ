'use client';

import { Fragment, useEffect, useState } from 'react';
import { BrandTeamAssignDialog } from '@/components/BrandTeamAssignDialog';
import { TIER_LABELS } from '@/lib/tiers';

// props: brands(전체 브랜드), teamMembers(전사 활성 직원 = 배치 후보 풀),
//        identity, onCreate(), onEdit(brand), onToggleActive(brand)
//
// 브랜드 행을 누르면 그 브랜드의 팀이 펼쳐진다. "미쏘 팀에 누가 있지?"는
// 브랜드를 관리하다 가장 자주 나오는 질문인데, 예전에는 그 브랜드로 전환해
// 설정 화면까지 들어가야 답이 나왔다.
export function BrandListSection({ brands, teamMembers, identity, onCreate, onEdit, onToggleActive }) {
  const [expandedId, setExpandedId] = useState(null);
  // team 은 { brandId, members } 또는 { brandId, error } 형태로만 갱신한다.
  // 이펙트 본문에서 곧바로 setState 하지 않고 응답이 온 뒤에만 쓰기 위해서다
  // (react-hooks/set-state-in-effect 회피). 어느 브랜드의 결과인지 함께 들고
  // 있으므로 펼친 브랜드를 바꾸면 이전 결과는 자동으로 "아직 안 온 것"이 된다.
  const [team, setTeam] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    if (!expandedId) return undefined;
    let cancelled = false;
    fetch(`/api/brand-team?brandId=${expandedId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) {
          setTeam({ brandId: expandedId, error: d.error ?? '팀원을 불러오지 못했습니다.' });
          return;
        }
        setTeam({ brandId: expandedId, members: d.members ?? [] });
      })
      .catch((e) => {
        if (!cancelled) setTeam({ brandId: expandedId, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [expandedId, reloadToken]);

  const loaded = team && team.brandId === expandedId;
  const brandMembers = loaded ? (team.members ?? []) : [];
  const assignedIds = new Set(brandMembers.map((m) => m.id));
  const candidates = teamMembers.filter((m) => !assignedIds.has(m.id));

  function toggleExpand(brandId) {
    setExpandedId((prev) => (prev === brandId ? null : brandId));
  }

  async function unassign(targetMemberId) {
    const res = await fetch(`/api/brand-team/${targetMemberId}?brandId=${expandedId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const d = await res.json();
      setTeam({ brandId: expandedId, members: brandMembers, error: d.error ?? '해제 실패' });
      return;
    }
    setReloadToken((t) => t + 1);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          브랜드 <span className="text-slate-400">({brands.length})</span>
        </h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          + 새 브랜드
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">이름</th>
            <th className="py-2">코드</th>
            <th className="py-2">워크플로</th>
            <th className="py-2">상태</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => {
            const expanded = expandedId === b.id;
            return (
              <Fragment key={b.id}>
                <tr className="border-b border-slate-100">
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(b.id)}
                      aria-expanded={expanded}
                      className="flex items-center gap-1.5 text-left font-medium text-slate-900 hover:text-indigo-600"
                    >
                      <span
                        className={`inline-block text-[10px] text-slate-400 transition-transform ${
                          expanded ? 'rotate-90' : ''
                        }`}
                      >
                        ▶
                      </span>
                      {b.name}
                    </button>
                  </td>
                  <td className="py-2 text-slate-500">{b.code}</td>
                  <td className="py-2 text-slate-500">{b.workflow_template}</td>
                  <td className="py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        b.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {b.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(b)}
                      className="mr-3 text-indigo-600 hover:underline"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(b)}
                      className="text-slate-500 hover:underline"
                    >
                      {b.is_active ? '비활성화' : '활성화'}
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-medium text-slate-600">
                            {b.name} 팀
                            {loaded && !team.error && (
                              <span className="ml-1 text-slate-400">({brandMembers.length})</span>
                            )}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setAssignOpen(true)}
                            className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                          >
                            + 배치
                          </button>
                        </div>
                        {loaded && team.error && <p className="text-xs text-red-600">{team.error}</p>}
                        {!loaded ? (
                          <p className="text-xs text-slate-500">불러오는 중...</p>
                        ) : brandMembers.length === 0 ? (
                          <p className="text-xs text-slate-500">아직 배치된 팀원이 없습니다.</p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {brandMembers.map((m) => (
                              <li
                                key={m.id}
                                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                              >
                                <span className="font-medium text-slate-800">{m.name}</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                                  {TIER_LABELS[m.tier] ?? m.tier}
                                </span>
                                <span className="text-slate-500">{m.subRole ?? '역할 미지정'}</span>
                                {!m.isActive && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                                    비활성
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => unassign(m.id)}
                                  className="ml-auto text-rose-600 hover:underline"
                                >
                                  해제
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* brands 를 넘기지 않으므로 다이얼로그에 브랜드 선택은 뜨지 않는다 —
          지금 펼쳐 둔 브랜드에 그대로 배치된다. */}
      <BrandTeamAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        candidates={candidates}
        identity={identity}
        targetBrandId={expandedId}
        onAssigned={() => {
          setAssignOpen(false);
          setReloadToken((t) => t + 1);
        }}
      />
    </section>
  );
}
