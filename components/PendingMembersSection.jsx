'use client';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// props: members(아직 어느 브랜드에도 배치되지 않은 활성 팀원), onAssign(member)
//
// 이 목록이 브랜드 화면이 아니라 팀원 화면에 있는 이유: 배치 대기는 브랜드의
// 속성이 아니라 "무언가를 기다리는 사람들의 대기열"이다. 사람을 관리하러 온
// 관리자가 가장 먼저 처리해야 할 일이라 맨 위에 둔다.
export function PendingMembersSection({ members, onAssign }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-slate-700">
        배치 대기 <span className="text-slate-400">({members.length})</span>
      </h2>
      {members.length === 0 ? (
        <p className="text-sm text-slate-500">배치를 기다리는 팀원이 없습니다.</p>
      ) : (
        <>
          {/* 이 문장을 지우면 안 된다. 아래 값들은 본인이 가입할 때 적은
              "신청"이지 시스템이 검증한 사실이 아니다. 표에 담겨 있다는 이유로
              확정된 권한처럼 읽히는 순간 잘못된 배치가 나온다. */}
          <p className="text-xs text-slate-500">
            아직 어느 브랜드에도 배치되지 않은 팀원입니다. 아래 소속·직무·신청 브랜드는 본인이
            적은 내용이라 그대로 권한이 되지는 않습니다 — 확인 후 배치해 주세요.
          </p>
          <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2">이름</th>
                <th className="py-2">이메일</th>
                <th className="py-2">소속</th>
                <th className="py-2">직무</th>
                <th className="py-2">신청 브랜드</th>
                <th className="py-2">신청일</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2">{m.name}</td>
                  <td className="py-2 text-slate-500">{m.email ?? ''}</td>
                  <td className="py-2 text-slate-500">{m.affiliation ?? ''}</td>
                  <td className="py-2 text-slate-500">{m.job_role ?? ''}</td>
                  <td className="py-2 text-slate-500">{m.requestedBrandName ?? ''}</td>
                  <td className="py-2 text-slate-500">{formatDate(m.signed_up_at)}</td>
                  <td className="py-2 text-right">
                    {m.hasAccount ? (
                      <button
                        type="button"
                        onClick={() => onAssign(m)}
                        className="rounded-lg bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700"
                      >
                        배치
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">계정 없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
    </section>
  );
}
