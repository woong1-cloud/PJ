'use client';

// props: members(전사 팀원, 비활성 포함), onCreate(), onAccount(member),
//        onToggleGlobalAdmin(member), onToggleActive(member)
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">이름</th>
            <th className="py-2">이메일</th>
            <th className="py-2">소속</th>
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
              <td className="py-2 text-slate-500">{m.affiliation ?? ''}</td>
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
      </table>
    </section>
  );
}
