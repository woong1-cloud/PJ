import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DONE_STATUS, MERGED_STATUS } from '@/lib/statuses';
import { statusStyle } from '@/lib/statusMeta';
import { isOverdue } from '@/lib/overdue';

function StatusBadge({ status }) {
  return <Badge className={statusStyle(status)}>{status}</Badge>;
}

function ConfidentialBadge() {
  return <Badge className="bg-rose-50 text-rose-600">비공개</Badge>;
}

function Meta({ req }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      {req.is_confidential && <ConfidentialBadge />}
      {req.image_count > 0 && <span>📎 {req.image_count}</span>}
      {req.status === MERGED_STATUS && <span>→ 병합됨</span>}
    </span>
  );
}

const PRIORITY_STYLES = { 상: 'text-rose-600', 중: 'text-amber-600', 하: 'text-slate-400' };

// 미완료면 예상일, 완료면 완료일. 두 컬럼으로 나누면 대부분 빈칸이 된다.
function DateCell({ req, today }) {
  if (req.status === DONE_STATUS && req.completed_at) {
    return <span className="text-slate-500">{req.completed_at.slice(5, 10)} 완료</span>;
  }
  if (!req.expected_release_date) return <span className="text-slate-400">—</span>;
  const short = req.expected_release_date.slice(5);
  if (isOverdue(req.expected_release_date, req.status, today)) {
    return <span className="font-medium text-rose-600">⚠ {short} 지연</span>;
  }
  return <span className="text-slate-500">{short} 예정</span>;
}

function SortableTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort?.key === sortKey;
  return (
    <th className={`px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <span className={active ? 'text-slate-900' : 'text-slate-300'}>
          {active && sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

export function RequirementList({ requirements, sort, onSort, today }) {
  if (requirements.length === 0) {
    return <p className="text-sm text-slate-500">등록된 요구사항이 없습니다.</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {/* 채널이 맨 앞이다. "어느 채널 건인가"는 줄을 묶어 읽는 기준이라
                  왼쪽 끝에 있을 때 목록이 채널별로 훑어진다. 카테고리 칸에
                  '미분류 · 공통' 처럼 붙여봤더니 한 덩어리로 읽혀서 아무도
                  채널로 인식하지 못했다. */}
              <th className="w-20 px-3 py-2">채널</th>
              <SortableTh label="상태" sortKey="status" sort={sort} onSort={onSort} className="w-24" />
              <th className="px-3 py-2">제목</th>
              <th className="w-28 px-3 py-2">카테고리</th>
              <SortableTh label="우선" sortKey="priority" sort={sort} onSort={onSort} className="w-16" />
              {/* 담당자는 뺐다. 배정 전인 건이 대부분이라 거의 비어 있었고,
                  화살표로 둘을 묶으니 좁은 칸에서 두 줄로 깨졌다.
                  누가 들고 있는지는 상세에서 본다. */}
              <th className="w-20 px-3 py-2">요청자</th>
              {/* 기본 정렬 기준이라 헤더가 있어야 한다. 다른 컬럼으로 정렬한 뒤
                  요청일 순서로 되돌아갈 방법이 없으면 정렬이 막다른 길이 된다. */}
              <SortableTh
                label="요청일"
                sortKey="request_date"
                sort={sort}
                onSort={onSort}
                className="w-24"
              />
              <SortableTh
                label="예상·완료"
                sortKey="expected_release_date"
                sort={sort}
                onSort={onSort}
                className="w-28"
              />
            </tr>
          </thead>
          <tbody>
            {requirements.map((req) => (
              <tr
                key={req.id}
                className={`border-t border-slate-200 hover:bg-slate-50 ${
                  req.status === MERGED_STATUS ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-2 text-slate-500">{req.channel ?? '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={req.status} />
                </td>
                {/* max-w-0 + truncate 조합이 제목을 남은 폭에 맞춰 말줄임 처리한다. */}
                <td className="max-w-0 px-3 py-2 text-slate-900">
                  <Link
                    href={`/requirements/${req.id}`}
                    className="block truncate hover:underline"
                    title={req.title}
                  >
                    {req.title}
                  </Link>
                  <Meta req={req} />
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {req.category?.category_name ?? '미분류'}
                </td>
                <td className={`px-3 py-2 ${PRIORITY_STYLES[req.priority] ?? 'text-slate-400'}`}>
                  {req.priority ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">{req.requester?.name ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{req.request_date}</td>
                <td className="px-3 py-2 text-xs">
                  <DateCell req={req} today={today} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {requirements.map((req) => (
          <Link
            key={req.id}
            href={`/requirements/${req.id}`}
            className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${
              req.status === MERGED_STATUS ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <StatusBadge status={req.status} />
              <span className="text-xs text-slate-500">{req.request_date}</span>
            </div>
            <p className="mt-2 font-medium text-slate-900">{req.title}</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {req.channel ?? '—'} · {req.category?.category_name ?? '미분류'} · {req.requester?.name ?? '—'}
              <DateCell req={req} today={today} />
              <Meta req={req} />
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
