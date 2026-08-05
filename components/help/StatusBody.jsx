import { Badge } from '@/components/ui/badge';
import { BOARD_STATUSES } from '@/lib/statuses';
import { STATUS_GUIDE, statusStyle } from '@/lib/statusMeta';

// 상태의 색·뜻·다음 행동.
//
// 데이터는 lib/statusMeta.js 하나에서만 온다 — 목록 뱃지와 같은 출처라
// 가이드에 적힌 색이 실제 화면의 색과 어긋날 수 없다.
//
// 예전에는 데스크톱용 표와 모바일용 정의 목록을 따로 그렸다. 같은 내용을 두 벌
// 쓰면 문구를 고칠 때 한쪽만 고치게 되고, 이 파일 안에서만 스타일이 넷(흐름
// 박스·표·승인 박스·각주)이라 도움말 전체가 정리 안 된 것처럼 보였다.
// 지금은 한 벌이다. 좁으면 세로로, 넓으면 가로로 눕는다.
export function StatusBody() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
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

      <ul className="divide-y divide-slate-100 border-y border-slate-100">
        {STATUS_GUIDE.map((row) => (
          <li
            key={row.status}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="shrink-0 sm:w-20">
              <Badge className={row.style}>{row.status}</Badge>
            </span>
            <span className="flex-1 text-sm break-keep text-slate-600">{row.meaning}</span>
            <span className="text-xs break-keep text-slate-500 sm:w-36 sm:text-right">
              다음 · {row.next}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5 text-sm break-keep text-slate-600">
        <p className="font-medium text-slate-900">최종 승인</p>
        <p>
          완료로 넘기려면 승인이 필요합니다. 그 요구사항을 볼 수 있는 사람이면
          브랜드·본부 누구든 한 명이 승인하면 되고, 순서는 없습니다.
        </p>
        <p>
          다만 <b className="font-medium text-slate-900">담당자 본인은 승인할 수 없습니다.</b>{' '}
          만든 사람이 스스로 확인하면 점검이 되지 않기 때문입니다.
        </p>
        <p>
          승인할 때 무엇을 확인했는지 적습니다. QA중·승인대기를 건너뛰고 바로 완료로 보낼 수도
          있지만, 건너뛴 사실은 상태 이력에 남습니다.
        </p>
      </div>

      <p className="text-xs text-slate-400">
        중복은 직접 지정할 수 없고 중복처리를 통해서만 만들어집니다.
      </p>
    </div>
  );
}
