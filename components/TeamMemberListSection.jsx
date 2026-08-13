'use client';

import { TIER_LABELS } from '@/lib/tiers';
import { displayAffiliation } from '@/lib/organizations';

// props: members(전사 팀원, 비활성 포함), onCreate(), onAccount(member),
//        onToggleGlobalAdmin(member), onToggleActive(member),
//        onEdit(member), onChangeTier(member, brandId, tier)
//
// member 객체는 GET /api/team-members 가 준 모양 그대로 넘겨야 한다.
// AccountCredentialDialog 가 member.hasAccount 로 생성/재설정 모드를 정하기
// 때문에, 여기서 필드를 골라 다시 만든 객체를 넘기면 조용히 반대 모드로 열린다.
export function TeamMemberListSection({
  members,
  onCreate,
  onAccount,
  onToggleGlobalAdmin,
  onToggleActive,
  onEdit,
  onChangeTier,
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          전사 팀원 <span className="text-slate-400">({members.length})</span>
        </h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          + 새 직원
        </button>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">이름</th>
            <th className="py-2">이메일</th>
            <th className="py-2">소속·직무</th>
            {/* 등급이 여기 없어서 "이 사람 몇 차지"를 보려면 브랜드 설정으로
                들어가야 했다. 그러면 등급을 바꿀 곳도 못 찾는다. */}
            <th className="py-2">브랜드 배치</th>
            <th className="py-2">재직여부</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-slate-100">
              <td className="py-2">
                {m.name}
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
                {/* 배치 대기 표에 이미 올라와 있는 사람이지만, 전체 목록에서도
                    한눈에 보여야 "왜 이 사람은 아무것도 못 보지"에 답할 수 있다. */}
                {m.is_active && m.hasBrandAssignment === false && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                    미배치
                  </span>
                )}
              </td>
              <td className="py-2 text-slate-500">{m.email ?? ''}</td>
              <td className="py-2 text-slate-500">
                {[displayAffiliation(m), m.job_role].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="py-2">
                {(m.brandRoles ?? []).length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {(m.brandRoles ?? []).map((r) => (
                      <span key={r.brandId} className="flex items-center gap-1 text-xs">
                        <span className="text-slate-600">{r.brandName}</span>
                        {/* 등급만 셀렉트로 둔다. 브랜드 추가·해제는 배치
                            다이얼로그가 하고, 여기는 "이미 배치된 사람의 등급"만
                            건드린다 — 한 자리에서 다 하려 하면 마지막 브랜드
                            관리자를 실수로 지우는 길이 생긴다. */}
                        <select
                          value={r.tier}
                          onChange={(e) => onChangeTier(m, r.brandId, e.target.value)}
                          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-700"
                          aria-label={`${m.name} ${r.brandName} 등급`}
                        >
                          {/* 저장값은 '2차/3차/4차' 지만 화면에는 이름을 보여준다.
                              숫자만 있으면 그 사람이 무엇을 할 수 있는지 알 수
                              없다. 브랜드 목록·브랜드 설정·배치 다이얼로그가
                              이미 TIER_LABELS 를 쓰고 있어 여기만 달랐다. */}
                          {['2차', '3차', '4차'].map((t) => (
                            <option key={t} value={t}>
                              {TIER_LABELS[t] ?? t}
                            </option>
                          ))}
                        </select>
                      </span>
                    ))}
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
                <button
                  type="button"
                  onClick={() => onEdit(m)}
                  className="mr-3 text-indigo-600 hover:underline"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => onAccount(m)}
                  className="mr-3 text-indigo-600 hover:underline"
                >
                  {m.hasAccount ? '비밀번호 재설정' : '계정 만들기'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleGlobalAdmin(m)}
                  className="mr-3 text-indigo-600 hover:underline"
                >
                  {m.is_global_admin ? '전체관리자 해제' : '전체관리자 지정'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleActive(m)}
                  className="text-slate-500 hover:underline"
                >
                  {m.is_active ? '비활성화' : '활성화'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
  );
}
