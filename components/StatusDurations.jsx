import { statusStyle } from '@/lib/statusMeta';

// 상태별 소요일. "왜 늦었는지"를 IT 가 말할 수 있는 근거다.
//
// status===null 인 구간은 '구간 불명'으로 그린다 — 상태명 변경 마이그레이션
// 이전의 옛 이력이거나 로그가 빠진 구간이다. 아무 이름이나 붙이지 않는다.
//
// props: durations — GET /api/requirements/[id] 가 내려주는 statusDurations
export function StatusDurations({ durations }) {
  if (!durations || durations.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-500">상태 구간</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {durations.map((seg, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {seg.status === null ? (
              <span className="rounded border border-slate-300 bg-transparent px-1.5 py-0.5 text-xs text-slate-400">
                구간 불명
              </span>
            ) : (
              <span className={`rounded px-1.5 py-0.5 text-xs ${statusStyle(seg.status)}`}>
                {seg.status}
              </span>
            )}
            <span className="text-slate-600">
              {seg.days}일{seg.ongoing ? ' (진행 중)' : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
