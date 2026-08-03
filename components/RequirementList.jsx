import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DONE_STATUS, MERGED_STATUS } from '@/lib/statuses';
import { statusStyle } from '@/lib/statusMeta';
import { isOverdue } from '@/lib/overdue';
import { redmineLinkState } from '@/lib/redmineLink';

function StatusBadge({ status }) {
  return <Badge className={statusStyle(status)}>{status}</Badge>;
}

function ConfidentialBadge() {
  return <Badge className="bg-rose-50 text-rose-600">비공개</Badge>;
}

function Meta({ req }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      {/* 프로젝트는 컬럼이 아니라 제목 아래 줄이다. 컬럼으로 만들면 이미 8개인
          표에 9번째가 붙는데, 폭이 밀리는 건 결국 max-w-0 인 제목 칸이다.
          프로젝트에 안 묶인 건도 많아서 담당자 컬럼을 뺐던 것과 같은 문제
          (대부분 빈칸)가 반복된다. 여기 있으면 있는 줄에만 보인다. */}
      {req.project?.name && (
        <span className="max-w-[16rem] truncate text-slate-500" title={req.project.name}>
          {req.project.name}
        </span>
      )}
      {req.is_confidential && <ConfidentialBadge />}
      {req.image_count > 0 && <span>📎 {req.image_count}</span>}
      {/* 레드마인 인계 상태. 'none'(아직 넘길 단계 아님)이면 아무것도 안 그린다 —
          작성중·검토대기에까지 배지를 깔면 목록 전체가 배지밭이 되고, 정작
          봐야 할 개발중 건에서 눈에 안 들어온다. */}
      {redmineLinkState(req) === 'linked' && <span className="text-slate-500">↗ 레드마인</span>}
      {redmineLinkState(req) === 'missing' && (
        <span className="rounded bg-amber-50 px-1.5 text-amber-700">미연결</span>
      )}
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

// props: requirements, sort, onSort, today, onMerge
//
// onMerge 를 주면 중복처리 열이 생긴다. 목록이 기본 뷰인데 중복처리가 보드에만
// 있어서, 목록으로 훑다가 같은 요청 둘을 발견하면 보드로 옮겨 가야 했다.
// 3차 미만에게는 주지 않는다(병합은 IT 판단이다).
export function RequirementList({ requirements, sort, onSort, today, onMerge }) {
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
              {/* 유형은 값이 2글자 고정이라 좁은 칸에 딱 맞는다. 제목 아래
                  줄에 배지로 두면 프로젝트명·첨부 표시와 섞여 눈에 안 든다 —
                  짧은 고정값은 컬럼, 긴 자유값은 제목 아래가 기준이다. */}
              <th className="w-16 px-3 py-2">유형</th>
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
              {onMerge && <th className="w-16 px-3 py-2" />}
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
                {/* 0019 이전 건은 값이 없다. 빈칸으로 두면 화면이 깨진 것처럼
                    보이므로 '—' 를 찍는다 — 다른 미지정 칸(예상·완료)과 같은 표기다. */}
                <td className="px-3 py-2 text-slate-500">
                  {req.requirement_type ?? <span className="text-slate-300">—</span>}
                </td>
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
                {onMerge && (
                  <td className="px-3 py-2 text-right">
                    {/* 이미 병합된 건은 다시 병합할 수 없다. 버튼을 남겨 두면
                        눌러서 400 을 받는 길만 생긴다. */}
                    {req.status !== MERGED_STATUS && (
                      <button
                        type="button"
                        onClick={() => onMerge(req)}
                        className="whitespace-nowrap text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        중복
                      </button>
                    )}
                  </td>
                )}
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
              {req.requirement_type ?? '미분류'} · {req.channel ?? '—'} ·{' '}
              {req.category?.category_name ?? '미분류'} · {req.requester?.name ?? '—'}
              <DateCell req={req} today={today} />
              <Meta req={req} />
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
