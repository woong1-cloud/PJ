import { Badge } from '@/components/ui/badge';
import { BOARD_STATUSES } from '@/lib/statuses';
import { STATUS_GUIDE, statusStyle } from '@/lib/statusMeta';

// 상태의 색·뜻·다음 행동을 한 화면에서 읽게 해주는 안내.
// 데이터는 lib/statusMeta.js 하나에서만 온다 — 목록 뱃지와 같은 출처라
// 가이드에 적힌 색이 실제 화면의 색과 어긋날 수 없다.
export function StatusGuide() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium text-slate-900">요구사항 상태</h2>
        <p className="mt-1 text-sm text-slate-500">
          상태 이름은 &ldquo;지금 누구 차례인지&rdquo;를 나타냅니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
        {BOARD_STATUSES.map((status, i) => (
          <span key={status} className="flex items-center gap-2">
            <Badge className={statusStyle(status)}>{status}</Badge>
            {i < BOARD_STATUSES.length - 1 && (
              <span aria-hidden="true" className="text-slate-300">
                →
              </span>
            )}
          </span>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="w-24 py-2">상태</th>
            <th className="py-2">뜻</th>
            <th className="w-36 py-2">다음 행동</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_GUIDE.map((row) => (
            <tr key={row.status} className="border-b border-slate-100">
              <td className="py-2">
                <Badge className={row.style}>{row.status}</Badge>
              </td>
              <td className="py-2 text-slate-600">{row.meaning}</td>
              <td className="py-2 text-slate-500">{row.next}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm break-keep text-slate-600">
        <h3 className="mb-1 font-medium text-slate-900">최종 승인</h3>
        <p>
          완료로 넘기려면 승인이 필요합니다. 그 요구사항을 볼 수 있는 사람이면
          브랜드·본부 누구든 한 명이 승인하면 되고, 순서는 없습니다.
        </p>
        <p className="mt-1">
          다만 <b>담당자 본인은 승인할 수 없습니다.</b> 만든 사람이 스스로 확인하면
          점검이 되지 않기 때문입니다.
        </p>
        <p className="mt-1">
          승인할 때 무엇을 확인했는지 적습니다. QA중·승인대기를 건너뛰고 바로 완료로
          보낼 수도 있지만, 건너뛴 사실은 상태 이력에 남습니다.
        </p>
      </div>

      <p className="text-xs text-slate-400">
        중복은 직접 지정할 수 없고 중복처리를 통해서만 만들어집니다.
      </p>
    </section>
  );
}
